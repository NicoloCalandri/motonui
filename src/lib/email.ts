/**
 * Email sending via Resend.
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.
 * Falls back to a no-op log if keys are not configured (dev / preview).
 */

import { escapeFields } from '@/lib/html';
import { log } from './log';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'motonui <reminders@motonui.app>';

const REMINDER_FOOTER = `Ricevi questa email perché hai un promemoria attivo su motonui · il tuo compagno di viaggio di coppia`;

/** Formats an ISO date in Italian, or returns null when the value is missing or invalid. */
function formatDate(value: string, options: Intl.DateTimeFormatOptions, withTime = false): string | null {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return withTime ? date.toLocaleString('it-IT', options) : date.toLocaleDateString('it-IT', options);
}

export interface EmailPayload {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        // The subject carries trip content (hotels, routes): never logged (T-4.3).
        log.warn('[motonui][email] RESEND_API_KEY not set — email skipped');
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
    // Every field may come from trip data entered by either member (SR-INT-07).
    const safe = escapeFields(opts);
    const dep = formatDate(opts.departureAt, {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }, true);
    const checkin = formatDate(opts.checkinOpensAt, {
        weekday: 'long', day: '2-digit', month: 'long',
        hour: '2-digit', minute: '2-digit',
    }, true);

    return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
      <div style="background:#C4622D;border-radius:16px;padding:24px;color:white;text-align:center;margin-bottom:24px">
        <div style="font-size:36px;margin-bottom:8px">✈️</div>
        <h1 style="margin:0;font-size:22px">Check-in aperto!</h1>
        <p style="margin:8px 0 0;opacity:0.85">${safe.carrier}</p>
      </div>

      <p style="font-size:16px">Ciao ${safe.userName},</p>
      <p>Secondo i dati del viaggio, il check-in online del tuo volo dovrebbe essere aperto.</p>

      <div style="background:#f5f5f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Volo</td><td style="padding:6px 0;font-weight:700">${safe.from} → ${safe.to}</td></tr>
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Compagnia</td><td style="padding:6px 0;font-weight:700">${safe.carrier}</td></tr>
          ${safe.pnr ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Codice prenotazione</td><td style="padding:6px 0;font-weight:700;letter-spacing:2px;font-size:18px;color:#C4622D">${safe.pnr}</td></tr>` : ''}
          ${checkin ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Check-in aperto</td><td style="padding:6px 0;font-weight:700">${checkin}</td></tr>` : ''}
          ${dep ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Partenza</td><td style="padding:6px 0;font-weight:700">${dep}</td></tr>` : ''}
        </table>
      </div>

      <p style="color:#666;font-size:13px">Ricorda di avere un documento valido e di seguire le istruzioni della compagnia per il bagaglio a mano.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">${REMINDER_FOOTER}</p>
    </div>`;
}

export function tripInviteEmail(opts: {
    inviterName: string;
    tripTitle: string;
    destination: string;
    inviteUrl: string;
}): string {
    // Trip fields are user input; the URL is built by the server but escaped too.
    const safe = escapeFields(opts);

    return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
      <div style="background:#C4622D;border-radius:16px;padding:24px;color:white;text-align:center;margin-bottom:24px">
        <div style="font-size:36px;margin-bottom:8px">🏝️</div>
        <h1 style="margin:0;font-size:22px">Un viaggio ti aspetta</h1>
        <p style="margin:8px 0 0;opacity:0.85">${safe.tripTitle} · ${safe.destination}</p>
      </div>

      <p style="font-size:16px">${safe.inviterName} ti ha invitato a pianificare insieme il viaggio <strong>${safe.tripTitle}</strong> su motonui.</p>

      <p style="text-align:center;margin:32px 0">
        <a href="${safe.inviteUrl}" style="background:#1a1a1a;color:white;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700">Accetta l'invito</a>
      </p>

      <p style="color:#666;font-size:13px">Il link vale 7 giorni e funziona solo con l'account registrato con questo indirizzo email. Se non conosci chi ti ha invitato, ignora questa email.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">Inviato da motonui · il tuo compagno di viaggio di coppia</p>
    </div>`;
}

export function paymentDeadlineEmail(opts: {
    userName: string;
    hotelName: string;
    bookingRef: string | null;
    deadline: string;
    type: 'payment_deadline' | 'cancellation_deadline';
}): string {
    // Every field may come from trip data entered by either member (SR-INT-07).
    const safe = escapeFields(opts);
    const date = formatDate(opts.deadline, {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
    const isPayment = opts.type === 'payment_deadline';
    const emoji = isPayment ? '💳' : '⚠️';
    const label = isPayment ? 'Scadenza pagamento' : 'Scadenza cancellazione gratuita';
    const action = isPayment
        ? 'Completa il pagamento entro questa data per non perdere la prenotazione.'
        : 'Se hai cambiato programma, cancella entro questa data: dopo potrebbe non essere più gratuito.';

    return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
      <div style="background:${isPayment ? '#1a1a1a' : '#b91c1c'};border-radius:16px;padding:24px;color:white;text-align:center;margin-bottom:24px">
        <div style="font-size:36px;margin-bottom:8px">${emoji}</div>
        <h1 style="margin:0;font-size:22px">${label}</h1>
        <p style="margin:8px 0 0;opacity:0.85">${safe.hotelName}</p>
      </div>

      <p style="font-size:16px">Ciao ${safe.userName},</p>
      <p>${action}</p>

      <div style="background:#f5f5f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Struttura</td><td style="padding:6px 0;font-weight:700">${safe.hotelName}</td></tr>
          ${safe.bookingRef ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Codice prenotazione</td><td style="padding:6px 0;font-weight:700">${safe.bookingRef}</td></tr>` : ''}
          ${date ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">${label}</td><td style="padding:6px 0;font-weight:700;color:${isPayment ? '#C4622D' : '#b91c1c'}">${date}</td></tr>` : ''}
        </table>
      </div>

      <p style="color:#aaa;font-size:12px;margin-top:32px">${REMINDER_FOOTER}</p>
    </div>`;
}

export function restaurantReminderEmail(opts: {
    userName: string;
    restaurantName: string;
    bookingRef: string | null;
    date: string;
    time: string;
}): string {
    // Every field may come from trip data entered by either member (SR-INT-07).
    const safe = escapeFields(opts);
    const dateStr = formatDate(opts.date, {
        weekday: 'long', day: '2-digit', month: 'long',
    });

    return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
      <div style="background:#ea580c;border-radius:16px;padding:24px;color:white;text-align:center;margin-bottom:24px">
        <div style="font-size:36px;margin-bottom:8px">🍽️</div>
        <h1 style="margin:0;font-size:22px">Prenotazione ristorante</h1>
        <p style="margin:8px 0 0;opacity:0.85">${safe.restaurantName}</p>
      </div>

      <p style="font-size:16px">Ciao ${safe.userName},</p>
      <p>Tavolo prenotato: ecco i dettagli da tenere a portata di mano.</p>

      <div style="background:#f5f5f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Ristorante</td><td style="padding:6px 0;font-weight:700">${safe.restaurantName}</td></tr>
          ${dateStr ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Data</td><td style="padding:6px 0;font-weight:700">${dateStr}</td></tr>` : ''}
          ${safe.time ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Orario</td><td style="padding:6px 0;font-weight:700;color:#ea580c">${safe.time}</td></tr>` : ''}
          ${safe.bookingRef ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Codice prenotazione</td><td style="padding:6px 0;font-weight:700">${safe.bookingRef}</td></tr>` : ''}
        </table>
      </div>

      <p style="color:#aaa;font-size:12px;margin-top:32px">${REMINDER_FOOTER}</p>
    </div>`;
}

export function activityReminderEmail(opts: {
    userName: string;
    activityName: string;
    bookingRef: string | null;
    date: string;
    time: string;
}): string {
    // Every field may come from trip data entered by either member (SR-INT-07).
    const safe = escapeFields(opts);
    const dateStr = formatDate(opts.date, {
        weekday: 'long', day: '2-digit', month: 'long',
    });

    return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
      <div style="background:#7c3aed;border-radius:16px;padding:24px;color:white;text-align:center;margin-bottom:24px">
        <div style="font-size:36px;margin-bottom:8px">🎟️</div>
        <h1 style="margin:0;font-size:22px">Attività in arrivo</h1>
        <p style="margin:8px 0 0;opacity:0.85">${safe.activityName}</p>
      </div>

      <p style="font-size:16px">Ciao ${safe.userName},</p>
      <p>Manca poco: qui sotto trovi tutto quello che serve.</p>

      <div style="background:#f5f5f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666;font-size:14px">Attività</td><td style="padding:6px 0;font-weight:700">${safe.activityName}</td></tr>
          ${dateStr ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Data</td><td style="padding:6px 0;font-weight:700">${dateStr}</td></tr>` : ''}
          ${safe.time ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Orario</td><td style="padding:6px 0;font-weight:700;color:#7c3aed">${safe.time}</td></tr>` : ''}
          ${safe.bookingRef ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Codice prenotazione</td><td style="padding:6px 0;font-weight:700">${safe.bookingRef}</td></tr>` : ''}
        </table>
      </div>

      <p style="color:#666;font-size:13px">Ricorda di avere con te il biglietto o la conferma di prenotazione.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">${REMINDER_FOOTER}</p>
    </div>`;
}
