import { describe, expect, it } from 'vitest';
import { activityReminderEmail, flightCheckinEmail, paymentDeadlineEmail, restaurantReminderEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/html';

// What a trip partner could type into carrier, hotel, restaurant or PNR fields.
const INJECTION = '<a href="https://phish.example">Accedi</a><img src=x onerror=alert(1)>';

function expectNoInjectedMarkup(html: string) {
    expect(html).not.toContain('<a href="https://phish.example">');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain(escapeHtml(INJECTION));
}

describe('email templates escape user data (SR-INT-07)', () => {
    it('flight check-in', () => {
        expectNoInjectedMarkup(flightCheckinEmail({
            userName: INJECTION, from: INJECTION, to: 'Santiago', carrier: INJECTION, pnr: INJECTION,
            departureAt: '2026-10-01T10:00:00Z', checkinOpensAt: '2026-09-30T10:00:00Z',
        }));
    });

    it('payment / cancellation deadline', () => {
        for (const type of ['payment_deadline', 'cancellation_deadline'] as const) {
            expectNoInjectedMarkup(paymentDeadlineEmail({
                userName: INJECTION, hotelName: INJECTION, bookingRef: INJECTION, deadline: '2026-10-01', type,
            }));
        }
    });

    it('restaurant and activity reminders', () => {
        const opts = { userName: 'Giorgia', bookingRef: INJECTION, date: '2026-10-01', time: '"><script>alert(1)</script>' };
        const restaurant = restaurantReminderEmail({ ...opts, restaurantName: INJECTION });
        const activity = activityReminderEmail({ ...opts, activityName: INJECTION });
        for (const html of [restaurant, activity]) {
            expectNoInjectedMarkup(html);
            expect(html).not.toContain('<script>');
        }
    });

    it('keeps normal text readable', () => {
        const html = restaurantReminderEmail({ userName: 'Nicolò', restaurantName: "L'Osteria & Co", bookingRef: null, date: '2026-10-01', time: '20:30' });
        expect(html).toContain('Ciao Nicolò');
        expect(html).toContain('L&#39;Osteria &amp; Co');
        expect(html).not.toContain('Prenotazione</td>');
    });
});

describe('escapeHtml', () => {
    it('escapes the five HTML metacharacters', () => {
        expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
    });
});
