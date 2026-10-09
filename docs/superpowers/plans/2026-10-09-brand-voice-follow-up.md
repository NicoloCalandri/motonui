# Brand Voice Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three code items left open by the brand review: reminder emails that show the wrong time off-UTC, raw provider errors in the mobile app, and the stale, unescaped email templates in `nextgen/`.

**Architecture:** Three independent fixes, each a pure function with its own test. No new abstraction beyond one mobile helper (`friendlyError`). The work continues on branch `claude/brand-voice-copy`, which already holds the first round of copy changes this plan builds on.

**Tech Stack:** TypeScript, Vitest. Root app (Next.js 15), `mobile/` (Expo, no test runner of its own), `nextgen/apps/api` (Hono, own Vitest config).

**Spec:** `docs/brand-voice.md`

## Global Constraints

- UI copy and user-facing messages: Italian. Code, comments, identifiers: English.
- The product name is always lowercase: `motonui`.
- A provider's message (Supabase, Resend) is never shown to the user as it arrives.
- Error message shape: what failed, in first person plural + what to do + `🏝️` at the end. On mobile the alert title is `Ops!` and the body does not repeat it.
- TypeScript strict: no `any` added, no `// @ts-ignore`.
- One booking label everywhere: `Codice prenotazione`.
- Product tagline: `il tuo compagno di viaggio di coppia`.
- `npm run type-check`, `npm run lint` (zero warnings) and `npm run test` stay green.

## Out of scope (decisions for the owner, not tasks)

- Privacy policy page and its links.
- Which domain `support@` uses (`motonui.com` vs `motonui.app`).
- Whether the "motonui Passport" card and the "Membro Premium" badge stay.
- "poetici" vs "caldo e personale" in the AI prompts.
- Admin placeholder "Almeno 6 caratteri" vs the 10-character policy.
- Mobile login by email code vs ADR-06 ("niente magic link").

## Review Focus

- A reminder for a flight at 23:30: the email must show 23:30 and the same weekday, on a server in any time zone.
- A date-only value (`2026-10-01`, restaurant or activity) must show 1 October on a server west of UTC.
- A mobile error with no message at all (`null`, a string, an object) must still produce a readable Italian sentence.
- A mobile validation error written by the app ("Inserisci il nome del viaggio.") must reach the user unchanged.
- A trip field containing HTML (`<script>`) must never reach a `nextgen` email unescaped.

---

### Task 1: Reminder emails show the time the user typed

Flight times are saved as naive strings (`2026-10-01T14:30:00`, see `src/components/trip/leg-form.ts:56`) into `TIMESTAMPTZ` columns, so Postgres stores them as 14:30 UTC. `formatDate` in `src/lib/email.ts` formats with the server's time zone: correct on Vercel (UTC), two hours off on a machine in Italy. Pin the formatter to UTC.

**Files:**
- Modify: `src/lib/email.ts` (`formatDate`)
- Test: `src/lib/email.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: nothing used by other tasks (Task 3 copies the finished file)

- [ ] **Step 1: Write the failing tests** — add inside the first `describe` of `src/lib/email.test.ts`, importing `flightCheckinEmail` if it is not imported yet:

```ts
    describe('times are shown as the user typed them', () => {
        const originalTz = process.env.TZ;
        afterEach(() => {
            process.env.TZ = originalTz;
        });

        it.each(['Europe/Rome', 'America/Los_Angeles', 'Pacific/Auckland'])('flight at 23:30 on a server in %s', (tz) => {
            process.env.TZ = tz;
            const html = flightCheckinEmail({
                userName: 'Giorgia', from: 'Roma', to: 'Santiago', carrier: 'LATAM', pnr: null,
                departureAt: '2026-10-01T23:30:00+00:00', checkinOpensAt: '2026-09-30T23:30:00+00:00',
            });
            expect(html).toContain('giovedì 01 ottobre 2026');
            expect(html).toContain('23:30');
            expect(html).toContain('mercoledì 30 settembre');
        });

        it.each(['Europe/Rome', 'America/Los_Angeles'])('date-only value on a server in %s', (tz) => {
            process.env.TZ = tz;
            const html = restaurantReminderEmail({ userName: 'Nicolò', restaurantName: 'Osteria', bookingRef: null, date: '2026-10-01', time: '20:30' });
            expect(html).toContain('giovedì 01 ottobre');
        });
    });
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/lib/email.test.ts`
Expected: FAIL in at least the `America/Los_Angeles` cases (hour and day shifted).

- [ ] **Step 3: Pin the formatter to UTC** — in `src/lib/email.ts`:

```ts
/**
 * Formats an ISO date in Italian, or returns null when the value is missing or invalid.
 * Times are saved without an offset and stored as UTC, so UTC is the wall-clock time the user typed.
 */
function formatDate(value: string, options: Intl.DateTimeFormatOptions, withTime = false): string | null {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const utc = { ...options, timeZone: 'UTC' };
    return withTime ? date.toLocaleString('it-IT', utc) : date.toLocaleDateString('it-IT', utc);
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx vitest run src/lib/email.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email.ts src/lib/email.test.ts
git commit -m "fix(backend): show reminder times as typed, on any server time zone"
```

---

### Task 2: Mobile shows Italian errors, never the provider's

About thirty `Alert.alert('Errore', err.message)` calls show whatever arrives: the app's own Italian validation messages, but also Supabase messages in English.

**Files:**
- Create: `mobile/lib/errors.ts`, `mobile/lib/errors.test.ts`
- Modify: `mobile/app/auth/login.tsx`, `mobile/app/profile/{personal,security,delete-account}.tsx`, `mobile/app/trips/new.tsx`, `mobile/app/trips/[id]/index.tsx`, `mobile/lib/validation.ts`
- Modify: `package.json` (script `test:mobile`), `.github/workflows/ci.yml` (run it in the Unit Tests job)

**Interfaces:**
- Produces: `friendlyError(error: unknown, fallback?: string): string` and the constants `SAVE_ERROR`, `DELETE_ERROR`, `GENERIC_ERROR` from `@/lib/errors` (mobile alias).

Rules of `friendlyError`:
1. Supabase Auth error (`__isAuthError === true`): message by `code`, else `fallback`.
2. Network failure (`TypeError` whose message matches `/network request failed|failed to fetch/i`): connection message.
3. Plain `Error` (`name === 'Error'`, no `code` property, non-empty message): the app wrote it, return it unchanged.
4. Anything else (PostgREST, Storage, Functions errors, non-errors): `fallback`.

- [ ] **Step 1: Write the failing test** — `mobile/lib/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DELETE_ERROR, GENERIC_ERROR, SAVE_ERROR, friendlyError } from './errors';

function authError(code: string | undefined, message: string) {
    return Object.assign(new Error(message), { name: 'AuthApiError', __isAuthError: true, code, status: 400 });
}

describe('friendlyError', () => {
    it('keeps a validation message written by the app', () => {
        expect(friendlyError(new Error('Inserisci il nome del viaggio.'))).toBe('Inserisci il nome del viaggio.');
    });

    it('maps a Supabase Auth code to Italian', () => {
        expect(friendlyError(authError('otp_expired', 'Token has expired or is invalid')))
            .toBe('Il codice è scaduto o non è valido. Richiedine uno nuovo 🏝️');
        expect(friendlyError(authError('over_email_send_rate_limit', 'Email rate limit exceeded')))
            .toContain('Ti abbiamo già scritto da poco');
    });

    it('never shows an unknown Auth message', () => {
        expect(friendlyError(authError('unexpected_failure', 'Database error'), SAVE_ERROR)).toBe(SAVE_ERROR);
    });

    it('never shows a database error', () => {
        const pg = Object.assign(new Error('new row violates row-level security policy'), { name: 'PostgrestError', code: '42501', details: null, hint: null });
        expect(friendlyError(pg, DELETE_ERROR)).toBe(DELETE_ERROR);
    });

    it('recognises a dropped connection', () => {
        expect(friendlyError(new TypeError('Network request failed'))).toContain('connessione');
    });

    it.each([null, undefined, 'boom', 42, {}, new Error('')])('falls back for %p', (value) => {
        expect(friendlyError(value)).toBe(GENERIC_ERROR);
    });

    it('messages do not repeat the alert title', () => {
        for (const message of [SAVE_ERROR, DELETE_ERROR, GENERIC_ERROR]) {
            expect(message.startsWith('Ops')).toBe(false);
            expect(message.endsWith('🏝️')).toBe(true);
        }
    });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run --root mobile lib/errors.test.ts`
Expected: FAIL, cannot resolve `./errors`.

- [ ] **Step 3: Write `mobile/lib/errors.ts`**

```ts
/**
 * User-facing error messages for the mobile app (see docs/brand-voice.md).
 * Alerts use the title "Ops!", so these messages do not repeat it.
 */

export const GENERIC_ERROR = 'Qualcosa è andato storto. Riprova tra poco 🏝️';
export const SAVE_ERROR = 'Non riusciamo a salvare. Riprova tra poco 🏝️';
export const DELETE_ERROR = 'Non riusciamo a eliminare. Riprova tra poco 🏝️';
const NETWORK_ERROR = 'Sembra che manchi la connessione. Riprova quando torni online 🏝️';

const AUTH_MESSAGES: Record<string, string> = {
    otp_expired: 'Il codice è scaduto o non è valido. Richiedine uno nuovo 🏝️',
    invalid_credentials: 'Email o codice non corrispondono. Riprova 🏝️',
    over_request_rate_limit: 'Troppi tentativi di fila. Aspetta qualche minuto e riprova 🏝️',
    over_email_send_rate_limit: 'Ti abbiamo già scritto da poco. Controlla la posta e riprova tra qualche minuto 🏝️',
    email_address_invalid: 'Controlla l’indirizzo email: sembra che manchi qualcosa 🏝️',
    validation_failed: 'Controlla l’indirizzo email: sembra che manchi qualcosa 🏝️',
    email_exists: 'Questa email è già usata da un altro account 🏝️',
    user_banned: 'Il tuo account è in pausa. Scrivici se pensi che sia un errore.',
    session_expired: 'La sessione è scaduta. Accedi di nuovo 🏝️',
};

function field(error: object, key: string): unknown {
    return (error as Record<string, unknown>)[key];
}

/** Italian message for any thrown value; a provider's own wording is never returned. */
export function friendlyError(error: unknown, fallback: string = GENERIC_ERROR): string {
    if (!(error instanceof Error)) return fallback;

    if (field(error, '__isAuthError') === true) {
        const code = field(error, 'code');
        return (typeof code === 'string' && AUTH_MESSAGES[code]) || fallback;
    }
    if (error instanceof TypeError && /network request failed|failed to fetch/i.test(error.message)) {
        return NETWORK_ERROR;
    }
    // A plain Error is one the app threw itself, with an Italian message.
    if (error.name === 'Error' && !('code' in error) && error.message.trim()) {
        return error.message;
    }
    return fallback;
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx vitest run --root mobile lib/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it at every call site**

  - Every `Alert.alert('Errore', err.message)` / `Alert.alert('Errore', error.message)` becomes `Alert.alert('Ops!', friendlyError(err, X))`, where `X` is `SAVE_ERROR` when the mutation's `onSuccess` calls `onSaved()`, `DELETE_ERROR` when it calls `onDeleted?.()`, and omitted otherwise.
  - `mobile/app/trips/[id]/index.tsx:392` → `Alert.alert('Ops!', friendlyError(err, DELETE_ERROR))`; `:428` → `friendlyError(err, SAVE_ERROR)`.
  - `mobile/app/profile/personal.tsx:191` → `Alert.alert('Ops!', friendlyError(error, 'Non riusciamo a caricare la foto. Riprova tra poco 🏝️'))`.
  - `mobile/app/profile/delete-account.tsx:46` `throw new Error(error.message)` → `throw error` (it wrapped a provider error in a plain Error); `:57` → `Alert.alert('Ops!', friendlyError(error, 'Non riusciamo a eliminare l’account. Riprova tra poco 🏝️'))`.
  - `mobile/app/auth/login.tsx:54,60` → `Alert.alert('Ops!', friendlyError(error, 'Non riusciamo a inviare il codice. Riprova tra poco 🏝️'))`; `:87` → `friendlyError(error, 'Non riusciamo a verificare il codice. Riprova tra poco 🏝️')`.
  - `mobile/app/auth/login.tsx:108` tagline → `Il tuo compagno di viaggio di coppia`.
  - Add `import { ... } from '@/lib/errors';` to each file, importing only what the file uses.
  - Fix the missing accents in the app's own messages: `puo` → `può`, `attivita` → `attività`, `all account` → `all’account` (`mobile/app/**`, `mobile/lib/validation.ts`), only inside user-facing strings.

- [ ] **Step 6: Verify no raw message is left**

Run: `grep -rnE "Alert\.alert\([^)]*(err|error)\.message" mobile/app`
Expected: no output.

Run: `npx tsc --noEmit -p mobile`
Expected: no new errors compared with the same command on the commit before this task.

- [ ] **Step 7: Wire the test into the project** — root `package.json` script `"test:mobile": "vitest run --root mobile"`; in `.github/workflows/ci.yml`, Unit Tests job, add after the coverage step's predecessor:

```yaml
      - name: Run mobile lib tests
        run: npm run test:mobile
```

Run: `npm run test:mobile`
Expected: PASS, 1 file.

- [ ] **Step 8: Commit**

```bash
git add mobile package.json .github/workflows/ci.yml
git commit -m "fix(frontend): show Italian errors in the mobile app instead of provider messages"
```

---

### Task 3: `nextgen` email templates match the app

`nextgen/apps/api/src/lib/email.ts` is an old copy: no HTML escaping of trip fields (SR-INT-07), the email subject logged, no invite email, old copy. Replace it with the current `src/lib/email.ts`.

**Files:**
- Create: `nextgen/apps/api/src/lib/html.ts` (copy of `src/lib/html.ts`), `nextgen/apps/api/src/lib/email.test.ts` (copy of `src/lib/email.test.ts`)
- Modify: `nextgen/apps/api/src/lib/email.ts`, `nextgen/apps/api/src/lib/cron/send-reminders.ts` (only if a signature it uses changed)

**Interfaces:**
- Consumes: the finished `src/lib/email.ts` from Task 1.
- Produces: the same exports `send-reminders.ts` already imports, plus `tripInviteEmail`.

- [ ] **Step 1: Copy the test first**

```bash
cp src/lib/html.ts nextgen/apps/api/src/lib/html.ts
cp src/lib/email.test.ts nextgen/apps/api/src/lib/email.test.ts
```

Rewrite the test's `@/lib/...` imports to relative ones (`./email`, `./html`).

- [ ] **Step 2: Run and watch it fail**

Run: `cd nextgen/apps/api && npx vitest run src/lib/email.test.ts`
Expected: FAIL (injected markup not escaped, `tripInviteEmail` missing).

- [ ] **Step 3: Port the module**

```bash
cp src/lib/email.ts nextgen/apps/api/src/lib/email.ts
```

Then, in the copy: `import { escapeFields } from '@/lib/html'` → `from './html'`; remove the `./log` import and replace the `log.warn(...)` call with `console.warn('[motonui][email] RESEND_API_KEY not set — email skipped')` (no subject: it carries trip content). `nextgen` has no structured logger yet.

- [ ] **Step 4: Run and watch it pass**

Run: `cd nextgen/apps/api && npx vitest run && npx tsc --noEmit`
Expected: PASS; no new type errors (fix `send-reminders.ts` call sites if a parameter changed).

- [ ] **Step 5: Commit**

```bash
git add nextgen/apps/api/src/lib
git commit -m "fix(backend): port escaped, on-brand email templates to nextgen"
```
