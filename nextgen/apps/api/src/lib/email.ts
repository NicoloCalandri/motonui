/**
 * Email sending via Resend.
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.
 * Falls back to a no-op log if keys are not configured (dev / preview).
 */

const FROM = process.env.RESEND_FROM_EMAIL ?? 'motonui <reminders@motonui.app>';

export interface EmailPayload {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        console.warn('[motonui][email] RESEND_API_KEY not set — email skipped:', payload.subject);
        return;
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
        from: FROM,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
    });

    if (error) {
        throw new Error(`[motonui][email] ${error.message}`);
    }
}

// ─── Email templates ──────────────────────────────────────────────────────────

export function flightCheckinEmail(opts: {
    userName: string;
    from: string;
    to: string;
    carrier: string;
    pnr: string | null;
    departureAt: string;
    checkinOpensAt: string;
}): string {
    const dep = new Date(opts.departureAt).toLocaleString('it-IT', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
    const checkin = new Date(opts.checkinOpensAt).toLocaleString('it-IT', {
        weekday: 'long', day: '2-digit', month: 'long',
        hour: '2-digit', minute: '2-digit',
    });

    return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
      <div style="background:#C4622D;border-radius:16px;padding:24px;color:white;text-align:center;margin-bottom:24px">
        <div style="font-size:36px;margin-bottom:8px">✈️</div>
        <h1 style="margin:0;font-size:22px">Check-in aperto!</h1>
        <p style="margin:8px 0 0;opacity:0.85">${opts.carrier}</p>
      </div>

      <p style="font-size:16px">Ciao ${opts.userName},</p>
      <p>Il check-in online per il tuo volo è ora disponibile.</p>

      <div style="background:#f5f5f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Volo</td><td style="padding:6px 0;font-weight:700">${opts.from} → ${opts.to}</td></tr>
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Compagnia</td><td style="padding:6px 0;font-weight:700">${opts.carrier}</td></tr>
          ${opts.pnr ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Codice prenotazione</td><td style="padding:6px 0;font-weight:700;letter-spacing:2px;font-size:18px;color:#C4622D">${opts.pnr}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Check-in aperto</td><td style="padding:6px 0;font-weight:700">${checkin}</td></tr>
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Partenza</td><td style="padding:6px 0;font-weight:700">${dep}</td></tr>
        </table>
      </div>

      <p style="color:#666;font-size:13px">Ricorda di avere un documento valido e di seguire le istruzioni della compagnia per il bagaglio a mano.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">Inviato da motonui · il tuo diario di viaggio</p>
    </div>`;
}

export function paymentDeadlineEmail(opts: {
    userName: string;
    hotelName: string;
    bookingRef: string | null;
    deadline: string;
    type: 'payment_deadline' | 'cancellation_deadline';
}): string {
    const date = new Date(opts.deadline).toLocaleDateString('it-IT', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
    const isPayment = opts.type === 'payment_deadline';
    const emoji = isPayment ? '💳' : '⚠️';
    const label = isPayment ? 'Scadenza pagamento' : 'Scadenza cancellazione gratuita';
    const action = isPayment
        ? 'Assicurati di completare il pagamento prima della scadenza per non perdere la prenotazione.'
        : 'Se non intendi procedere con il soggiorno, cancella entro questa data per non incorrere in penali.';

    return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
      <div style="background:${isPayment ? '#1a1a1a' : '#b91c1c'};border-radius:16px;padding:24px;color:white;text-align:center;margin-bottom:24px">
        <div style="font-size:36px;margin-bottom:8px">${emoji}</div>
        <h1 style="margin:0;font-size:22px">${label}</h1>
        <p style="margin:8px 0 0;opacity:0.85">${opts.hotelName}</p>
      </div>

      <p style="font-size:16px">Ciao ${opts.userName},</p>
      <p>${action}</p>

      <div style="background:#f5f5f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Struttura</td><td style="padding:6px 0;font-weight:700">${opts.hotelName}</td></tr>
          ${opts.bookingRef ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Ref. prenotazione</td><td style="padding:6px 0;font-weight:700">${opts.bookingRef}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#666;font-size:14px">${label}</td><td style="padding:6px 0;font-weight:700;color:${isPayment ? '#C4622D' : '#b91c1c'}">${date}</td></tr>
        </table>
      </div>

      <p style="color:#aaa;font-size:12px;margin-top:32px">Inviato da motonui · il tuo diario di viaggio</p>
    </div>`;
}

export function restaurantReminderEmail(opts: {
    userName: string;
    restaurantName: string;
    bookingRef: string | null;
    date: string;
    time: string;
}): string {
    const dateStr = new Date(opts.date).toLocaleDateString('it-IT', {
        weekday: 'long', day: '2-digit', month: 'long',
    });

    return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
      <div style="background:#ea580c;border-radius:16px;padding:24px;color:white;text-align:center;margin-bottom:24px">
        <div style="font-size:36px;margin-bottom:8px">🍽️</div>
        <h1 style="margin:0;font-size:22px">Prenotazione ristorante</h1>
        <p style="margin:8px 0 0;opacity:0.85">${opts.restaurantName}</p>
      </div>

      <p style="font-size:16px">Ciao ${opts.userName},</p>
      <p>Promemoria per la tua prenotazione al ristorante.</p>

      <div style="background:#f5f5f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Ristorante</td><td style="padding:6px 0;font-weight:700">${opts.restaurantName}</td></tr>
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Data</td><td style="padding:6px 0;font-weight:700">${dateStr}</td></tr>
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Orario</td><td style="padding:6px 0;font-weight:700;color:#ea580c">${opts.time}</td></tr>
          ${opts.bookingRef ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Prenotazione</td><td style="padding:6px 0;font-weight:700">${opts.bookingRef}</td></tr>` : ''}
        </table>
      </div>

      <p style="color:#aaa;font-size:12px;margin-top:32px">Inviato da motonui · il tuo diario di viaggio</p>
    </div>`;
}

export function activityReminderEmail(opts: {
    userName: string;
    activityName: string;
    bookingRef: string | null;
    date: string;
    time: string;
}): string {
    const dateStr = new Date(opts.date).toLocaleDateString('it-IT', {
        weekday: 'long', day: '2-digit', month: 'long',
    });

    return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
      <div style="background:#7c3aed;border-radius:16px;padding:24px;color:white;text-align:center;margin-bottom:24px">
        <div style="font-size:36px;margin-bottom:8px">🎟️</div>
        <h1 style="margin:0;font-size:22px">Attività in arrivo</h1>
        <p style="margin:8px 0 0;opacity:0.85">${opts.activityName}</p>
      </div>

      <p style="font-size:16px">Ciao ${opts.userName},</p>
      <p>Promemoria per la tua attività programmata.</p>

      <div style="background:#f5f5f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Attività</td><td style="padding:6px 0;font-weight:700">${opts.activityName}</td></tr>
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Data</td><td style="padding:6px 0;font-weight:700">${dateStr}</td></tr>
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Orario</td><td style="padding:6px 0;font-weight:700;color:#7c3aed">${opts.time}</td></tr>
          ${opts.bookingRef ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Prenotazione</td><td style="padding:6px 0;font-weight:700">${opts.bookingRef}</td></tr>` : ''}
        </table>
      </div>

      <p style="color:#666;font-size:13px">Ricorda di avere con te il biglietto o la conferma di prenotazione.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">Inviato da motonui · il tuo diario di viaggio</p>
    </div>`;
}
