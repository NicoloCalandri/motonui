# Agent 07 — Admin Panel & User Management

## Prerequisiti

Questo agente va eseguito **dopo** `06_DEVOPS`. Richiede che l'intera pipeline precedente sia completata e che il deploy su Vercel funzioni correttamente.

Prima di iniziare:
1. Leggi `CLAUDE.md` integralmente
2. Leggi `docs/ARCHITECTURE.md`
3. Leggi `src/lib/types.ts` — tutti i tipi nuovi si aggiungono qui
4. Leggi le migration esistenti in `supabase/migrations/` per capire lo schema attuale

---

## Obiettivo

Aggiungere un ruolo `admin` al sistema. Un utente admin può:

- Vedere la lista di tutti gli utenti registrati
- Leggere i dettagli di ogni account (profilo, viaggi, spese, post)
- Impersonare un utente per navigare l'app con la sua sessione (read-only)
- Sospendere o riattivar un account
- Eliminare un account (con conferma e cascade delete)
- Vedere le statistiche aggregate della piattaforma

L'admin **non** può:
- Leggere le password o i token di sessione
- Modificare spese o contenuti a nome di un utente (solo visualizzazione)
- Bypassare le RLS se non tramite il service role key **esclusivamente server-side**

---

## Fase 1 — Database & Auth

### 1.1 Migration: ruolo admin

Crea `supabase/migrations/007_admin_role.sql`:

```sql
-- Aggiunge il campo role alla tabella profiles
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

-- Solo il service role può promuovere un utente ad admin
-- (nessuna RLS policy consente l'auto-promozione)
create policy "admin_role_immutable_by_user"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (role = 'user');  -- gli utenti non possono impostarsi admin

-- Indice per query frequenti sulla dashboard admin
create index if not exists profiles_role_idx on public.profiles(role);
```

### 1.2 Seed admin iniziale

Crea `supabase/seed_admin.sql` (da eseguire manualmente, mai in CI):

```sql
-- Promuovi l'utente con questa email ad admin
-- Sostituisci con l'email reale prima di eseguire
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'nicolo@example.com'
);
```

Aggiungi istruzioni in `docs/ADMIN_SETUP.md`:

```markdown
# Setup Admin

1. Registra l'account con l'email desiderata dall'app
2. Apri Supabase Studio > SQL Editor
3. Modifica `supabase/seed_admin.sql` con la tua email
4. Esegui lo script
5. Rieffettua il login — il ruolo admin sarà attivo
```

### 1.3 Migration: tabella audit log

Crea il log di tutte le azioni admin per tracciabilità:

```sql
create table if not exists public.admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references public.profiles(id),
  action       text not null,  -- 'impersonate', 'suspend', 'delete', 'view'
  target_id    uuid references public.profiles(id),
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

-- Solo admin può leggere, nessuno può scrivere via client
alter table public.admin_audit_log enable row level security;

create policy "admin_can_read_audit_log"
  on public.admin_audit_log
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Insert solo via service role (nelle API route server-side)
```

### 1.4 Migration: campo suspended su profiles

```sql
alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

-- Gli utenti sospesi non possono accedere — gestito nel middleware
```

### 1.5 Aggiornamento tipi

In `src/lib/types.ts`, aggiungi:

```typescript
export type UserRole = 'user' | 'admin'

export type Profile = {
  // ... campi esistenti ...
  role: UserRole
  suspendedAt: string | null
  suspendedReason: string | null
}

export type AdminAuditLog = {
  id: string
  adminId: string
  action: 'impersonate' | 'suspend' | 'unsuspend' | 'delete' | 'view_profile'
  targetId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export type AdminUserSummary = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  role: UserRole
  suspendedAt: string | null
  tripsCount: number
  expensesCount: number
  postsCount: number
  createdAt: string
  lastSignInAt: string | null
}

export type PlatformStats = {
  totalUsers: number
  activeUsersLast30Days: number
  totalTrips: number
  totalExpenses: number
  totalPosts: number
  totalAiCalls: number
}
```

---

## Fase 2 — Middleware & Protezione Route

### 2.1 Aggiornamento middleware

In `src/middleware.ts`, aggiungi la protezione del prefisso `/admin`:

```typescript
// Dopo aver verificato la sessione Supabase...

const { data: profile } = await supabase
  .from('profiles')
  .select('role, suspended_at')
  .eq('id', user.id)
  .single()

// Blocca utenti sospesi
if (profile?.suspended_at) {
  return NextResponse.redirect(new URL('/suspended', request.url))
}

// Proteggi le route admin
if (request.nextUrl.pathname.startsWith('/admin')) {
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
}

// Salva il ruolo nei cookie per uso client (non sensibile)
response.cookies.set('user_role', profile?.role ?? 'user', {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
})
```

### 2.2 Helper per verificare il ruolo admin nelle API

Crea `src/lib/auth/require-admin.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function requireAdmin(req: NextRequest): Promise<
  { adminId: string } | NextResponse
> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Non autenticato', code: 'UNAUTHORIZED', status: 401 },
      { status: 401 }
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Accesso non autorizzato', code: 'FORBIDDEN', status: 403 },
      { status: 403 }
    )
  }

  return { adminId: user.id }
}
```

---

## Fase 3 — API Route Admin

Tutte le route sotto `/api/admin/` usano il service role key **solo server-side** per bypassare le RLS dove necessario. Non esporre mai il service role key al browser.

### 3.1 `GET /api/admin/users`

Ritorna la lista paginata di tutti gli utenti con statistiche aggregate.

Input (query params, validato con Zod):
```typescript
const schema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),     // ricerca per email o nome
  role: z.enum(['user', 'admin', 'all']).default('all'),
  suspended: z.enum(['true', 'false', 'all']).default('all'),
  sortBy: z.enum(['created_at', 'last_sign_in_at', 'trips_count']).default('created_at'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})
```

Output:
```typescript
{
  users: AdminUserSummary[],
  total: number,
  page: number,
  pageSize: number,
}
```

Logica:
- Usa il client con service role per fare join tra `auth.users` e `profiles`
- Aggrega `trips_count`, `expenses_count`, `posts_count` con subquery
- Scrive un record `view_profile` nell'audit log solo se la ricerca è per utente specifico

### 3.2 `GET /api/admin/users/[id]`

Ritorna il profilo completo di un utente: dati base, ultimi 5 viaggi, ultimi 5 post, riepilogo spese totali.

Scrive `view_profile` nell'audit log.

### 3.3 `POST /api/admin/users/[id]/suspend`

Input:
```typescript
{ reason: z.string().min(1).max(500) }
```

Imposta `suspended_at = now()` e `suspended_reason` sul profilo. Scrive `suspend` nell'audit log. Non elimina la sessione attiva immediatamente — il middleware la bloccherà al prossimo refresh.

### 3.4 `POST /api/admin/users/[id]/unsuspend`

Azzera `suspended_at` e `suspended_reason`. Scrive `unsuspend` nell'audit log.

### 3.5 `DELETE /api/admin/users/[id]`

Input:
```typescript
{ confirmEmail: z.string().email() }  // l'admin deve digitare l'email dell'utente per confermare
```

Logica:
1. Verifica che `confirmEmail` corrisponda all'email dell'utente target
2. Elimina l'utente da `auth.users` (cascade elimina tutto per RLS + FK con `on delete cascade`)
3. Scrive `delete` nell'audit log (il target_id rimane per tracciabilità storica)

### 3.6 `POST /api/admin/users/[id]/impersonate`

**Endpoint critico** — implementare con particolare attenzione.

Logica:
1. Verifica che il richiedente sia admin
2. Crea un token di impersonazione firmato con JWT (usa `ADMIN_IMPERSONATION_SECRET` da env):
   ```typescript
   const token = jwt.sign(
     {
       adminId: adminUser.id,
       targetId: targetUser.id,
       expiresAt: Date.now() + 30 * 60 * 1000,  // 30 minuti
       type: 'impersonation',
     },
     process.env.ADMIN_IMPERSONATION_SECRET!,
     { expiresIn: '30m' }
   )
   ```
3. Salva il token in una tabella `impersonation_tokens` (con scadenza)
4. Scrive `impersonate` nell'audit log
5. Ritorna il token al client admin

Il client salva il token in un cookie `impersonation_token` e redirige a `/dashboard`. Il middleware riconosce il cookie e inietta l'identità dell'utente target in tutte le query Server Component, **in sola lettura**.

**Nota**: le scritture (POST, PUT, DELETE) sono bloccate in modalità impersonazione — il middleware ritorna 403 con messaggio `"Operazione non disponibile in modalità anteprima"`.

### 3.7 `POST /api/admin/impersonate/exit`

Elimina il cookie `impersonation_token` e il record dalla tabella `impersonation_tokens`. Redirige l'admin a `/admin/users`.

### 3.8 `GET /api/admin/stats`

Ritorna `PlatformStats`: conteggi aggregati letti con service role. Cache di 5 minuti con `next: { revalidate: 300 }`.

### 3.9 `GET /api/admin/audit-log`

Lista paginata dell'audit log, filtrabile per `adminId`, `action`, `targetId`, range di date. Solo admin può chiamarla.

---

## Fase 4 — Middleware per Impersonazione

Aggiorna `src/middleware.ts` per gestire la modalità impersonazione:

```typescript
const impersonationToken = request.cookies.get('impersonation_token')?.value

if (impersonationToken) {
  try {
    const payload = jwt.verify(
      impersonationToken,
      process.env.ADMIN_IMPERSONATION_SECRET!
    ) as ImpersonationPayload

    // Blocca scritture in modalità impersonazione
    const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    const isAdminExit = request.nextUrl.pathname === '/api/admin/impersonate/exit'

    if (isWriteMethod && !isAdminExit) {
      return NextResponse.json(
        {
          error: 'Operazione non disponibile in modalità anteprima 🏝️',
          code: 'IMPERSONATION_READ_ONLY',
          status: 403,
        },
        { status: 403 }
      )
    }

    // Passa l'identità impersonata tramite header
    response.headers.set('x-impersonated-user-id', payload.targetId)
    response.headers.set('x-impersonating-admin-id', payload.adminId)
  } catch {
    // Token scaduto o invalido — rimuovi il cookie silenziosamente
    response.cookies.delete('impersonation_token')
  }
}
```

---

## Fase 5 — UI Admin

Crea il gruppo di route `src/app/(admin)/admin/` con layout dedicato (sidebar diversa dall'app principale).

### 5.1 Layout admin

`src/app/(admin)/admin/layout.tsx`:

- Sidebar con: Dashboard, Utenti, Audit Log, Impostazioni
- Header con nome admin e link "Torna all'app"
- Colori: palette neutra (zinc/slate) — distinta dal colore brand dell'app
- Nessun accesso da utenti non-admin (il middleware già blocca, ma aggiungi un check lato server nel layout come difesa in profondità)

### 5.2 Pagina Dashboard Admin

`src/app/(admin)/admin/page.tsx`:

Mostra `PlatformStats` con 6 card metriche:
- Utenti totali
- Utenti attivi (ultimi 30 giorni)
- Viaggi creati
- Spese registrate
- Post pubblicati
- Chiamate AI effettuate

Aggiungi un grafico a barre (Recharts) con nuove registrazioni per giorno negli ultimi 30 giorni.

### 5.3 Pagina Lista Utenti

`src/app/(admin)/admin/users/page.tsx`:

Tabella con colonne:
| Avatar + Nome | Email | Ruolo | Viaggi | Post | Registrato | Ultimo accesso | Stato | Azioni |

Funzionalità:
- Ricerca full-text per nome/email (debounced, 300ms)
- Filtri: ruolo, stato (attivo/sospeso)
- Ordinamento per colonna cliccabile
- Paginazione (25 per pagina)
- Azioni inline per ogni riga: **Visualizza**, **Impersona**, **Sospendi/Riattiva**, **Elimina**

Comportamento azioni:
- **Visualizza** → apre il drawer `UserDetailDrawer`
- **Impersona** → mostra `ImpersonateConfirmDialog`, poi chiama l'endpoint e redirige
- **Sospendi** → apre `SuspendDialog` con campo motivo
- **Elimina** → apre `DeleteUserDialog` con conferma via email

### 5.4 Componente `UserDetailDrawer`

`src/components/admin/user-detail-drawer.tsx`:

Drawer laterale (right) con:
- Sezione profilo: avatar, nome, email, data registrazione, ultimo accesso
- Sezione attività: tab con Viaggi (lista ultimi 5), Spese (totale per valuta), Post (lista ultimi 5)
- Sezione sicurezza: storico sessioni, stato account
- Footer con azioni: Impersona, Sospendi, Elimina

### 5.5 Componente `ImpersonateConfirmDialog`

`src/components/admin/impersonate-confirm-dialog.tsx`:

Dialog con:
- Avviso chiaro: `"Stai per visualizzare l'app come [nome utente]. Potrai solo leggere, non modificare nulla."`
- Durata sessione: 30 minuti
- Checkbox di conferma: `"Ho capito che questa azione viene registrata"`
- Pulsante **Inizia anteprima**

### 5.6 Banner Impersonazione

`src/components/admin/impersonation-banner.tsx`:

Banner fisso in cima a tutte le pagine quando `impersonation_token` è presente:

```
⚠️  Stai visualizzando l'app come [Nome Utente] — modalità sola lettura   [Esci dall'anteprima]
```

Colore: `amber-500` per visibilità massima. Mostralo in `src/app/(app)/layout.tsx` condizionalmente.

### 5.7 Pagina Audit Log

`src/app/(admin)/admin/audit-log/page.tsx`:

Tabella con:
- Timestamp, Admin, Azione (badge colorato), Utente target, Dettagli (da metadata)
- Filtri: admin, tipo azione, range date
- Export CSV delle ultime 1000 righe

---

## Fase 6 — Pagina Sospensione

Crea `src/app/(public)/suspended/page.tsx` — pagina standalone senza nav:

- Messaggio: `"Il tuo account è stato temporaneamente sospeso 🏝️"`
- Mostra il motivo della sospensione (se presente)
- Link a email di supporto
- Pulsante logout

---

## Fase 7 — Variabili d'ambiente

Aggiungi a `.env.example`:

```bash
# Admin
ADMIN_IMPERSONATION_SECRET=   # JWT secret per i token di impersonazione — min 32 char
ADMIN_EMAIL=                  # Email dell'admin iniziale (usata dallo script seed)
```

Aggiungi a `src/env.ts` (o dove vengono validate le env):

```typescript
ADMIN_IMPERSONATION_SECRET: z.string().min(32),
ADMIN_EMAIL: z.string().email().optional(),
```

---

## Fase 8 — Test

### Test prioritari

**`src/lib/admin/permissions.test.ts`**
- `requireAdmin` ritorna 401 se non autenticato
- `requireAdmin` ritorna 403 se l'utente è `role: 'user'`
- `requireAdmin` ritorna `{ adminId }` se l'utente è `role: 'admin'`

**`src/lib/admin/impersonation.test.ts`**
- Il token di impersonazione è valido per 30 minuti
- Il token scaduto viene rifiutato
- Il token con secret errato viene rifiutato
- Le route di scrittura ritornano 403 con token attivo

**`src/app/api/admin/users/[id]/suspend/route.test.ts`**
- Sospende correttamente e scrive l'audit log
- Ritorna 404 se l'utente non esiste
- Non consente all'admin di sospendere se stesso

**`src/app/api/admin/users/[id]/delete/route.test.ts`**
- Elimina solo se `confirmEmail` corrisponde
- Ritorna 400 se `confirmEmail` non corrisponde
- Non consente all'admin di eliminare se stesso

Copertura minima per `src/lib/admin/`: **80%** (critico per sicurezza)

---

## Fase 9 — Sicurezza: checklist finale

Prima di aprire la PR, verifica tutti questi punti:

- [ ] Nessuna route `/api/admin/*` è accessibile senza `requireAdmin()`
- [ ] Il service role key non compare mai in bundle client (`NEXT_PUBLIC_` è vuoto)
- [ ] Tutte le azioni admin scrivono nell'audit log
- [ ] L'impersonazione è read-only — testata con un test che tenta un POST
- [ ] Un admin non può eliminare o sospendere se stesso
- [ ] Il token di impersonazione scade dopo 30 minuti
- [ ] I cookie di impersonazione sono `httpOnly: true`, `secure: true` in produzione
- [ ] La pagina `/admin` ritorna 404 (o redirige) per utenti non-admin — testato manualmente
- [ ] L'audit log registra correttamente adminId, targetId e action per ogni operazione

---

## Commit atteso

```bash
feat(admin): admin role, user management panel, impersonation system
```

---

## Note implementative

- L'accesso a `auth.users` (tabella di sistema di Supabase) richiede il service role key — usalo **solo** nelle API route server-side, mai in componenti client
- Per la join tra `auth.users` e `profiles` nelle query admin, considera una view in Postgres:
  ```sql
  create view public.admin_user_view as
  select
    au.id, au.email, au.created_at, au.last_sign_in_at,
    p.display_name, p.avatar_url, p.role, p.suspended_at
  from auth.users au
  join public.profiles p on p.id = au.id;
  -- Accessibile solo via service role
  ```
- L'impersonazione **non crea una vera sessione Supabase** per l'utente target — funziona passando l'ID dell'utente target tramite header/context, e i Server Components usano quel contesto per le query. Questo è più sicuro e più semplice da revocare rispetto a generare token Supabase reali.
