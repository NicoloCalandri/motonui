import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plane, MapPin, Calendar, Users, Loader2, ArrowLeft, ArrowRight, Check, Mail } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api-client';
import { TripWizardStepIndicator } from '../components/TripWizardStepIndicator';
import type { Trip } from '@motonui/shared-types';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const Step1Schema = z.object({
  title: z.string().min(1, 'Inserisci un nome per il viaggio'),
  destination: z.string().min(1, 'Inserisci la destinazione'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  description: z.string().max(2000).optional(),
});

const Step2Schema = z.object({
  partner_email: z.string().email('Email non valida').optional().or(z.literal('')),
});

type Step1Values = z.infer<typeof Step1Schema>;
type Step2Values = z.infer<typeof Step2Schema>;

// ─── Main Wizard ──────────────────────────────────────────────────────────────

/**
 * New-trip wizard ("/trips/new"). Ported from src/app/(app)/trips/new/page.tsx.
 *
 * Three-step client-only wizard (basic info → optional partner email →
 * success), unchanged in structure from the old page. Touchpoint changes:
 * - `next/navigation`'s `useRouter` → react-router's `useNavigate`
 *   (`router.push` → `navigate`, `router.back()` → `navigate(-1)`).
 * - Step 1's raw `fetch('/api/trips', ...)` → `apiFetch<Trip>('/api/trips',
 *   { method: 'POST', body: JSON.stringify(tripData) }, token)`, matching
 *   `CreateTripSchema` in nextgen/apps/api/src/routes/trips.ts (title,
 *   destination, start_date?, end_date?, description? — the same fields
 *   Step1Schema collects).
 * - `revalidatePath`/`router.refresh()` has no old-page equivalent here
 *   (the old trips list was a fresh Server Component fetch on navigation),
 *   but since TripsListPage and DashboardPage now cache trips under the
 *   `['trips']` query key, this invalidates that key on success so they
 *   show the new trip immediately instead of serving a stale cached list.
 *
 * The optional partner email of step 2 is sent to `POST /api/trips/:id/invites`
 * once the trip exists; a failed invite does not undo the trip.
 */
export function NewTripPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token;

  const [step, setStep] = useState(0);
  const [tripData, setTripData] = useState<Step1Values | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form1 = useForm<Step1Values>({ resolver: zodResolver(Step1Schema) });
  const form2 = useForm<Step2Values>({ resolver: zodResolver(Step2Schema) });
  const startDate = form1.watch('start_date');

  const handleStep1 = (values: Step1Values) => {
    setTripData(values);
    setStep(1);
  };

  const handleStep2 = async (values: Step2Values) => {
    if (!tripData) return;
    setSaving(true);
    setError(null);

    try {
      const trip = await apiFetch<Trip>('/api/trips', {
        method: 'POST',
        body: JSON.stringify(tripData),
      }, token);

      if (values.partner_email) {
        // The trip exists anyway: a failed invite can be resent from the trip page.
        await apiFetch(`/api/trips/${trip.id}/invites`, {
          method: 'POST',
          body: JSON.stringify({ email: values.partner_email }),
        }, token).catch(() => {});
      }

      queryClient.invalidateQueries({ queryKey: ['trips'] });
      setStep(2);
      setTimeout(() => navigate(`/trips/${trip.id}`), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ops! Qualcosa è andato storto 🏝️');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-neutral-50/50 flex flex-col items-center justify-start pt-12 px-6">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Indietro"
              onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)}
              className="p-3 rounded-full bg-white shadow-sm hover:shadow-md transition-all text-neutral-600 active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display text-4xl font-bold text-neutral-900 tracking-tight">Nuovo viaggio</h1>
              <p className="text-neutral-400 font-medium">
                {step === 0 && 'Il primo passo verso una nuova avventura'}
                {step === 1 && 'Viaggiare in due è più divertente'}
                {step === 2 && 'Preparate le valigie!'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-neutral-100">
          <TripWizardStepIndicator current={step} total={3} />

          {error && (
            <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100 animate-in fade-in slide-in-from-top-4">
              {error}
            </div>
          )}

          {/* ── Step 0: Basic Info ── */}
          {step === 0 && (
            <form onSubmit={form1.handleSubmit(handleStep1)} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="title" className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
                  Nome del viaggio
                </label>
                <div className="relative group">
                  <Plane className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-neutral-900 transition-colors" />
                  <input
                    {...form1.register('title')}
                    id="title"
                    placeholder="Esempio: Giappone 2025"
                    className="w-full pl-12 pr-4 py-4 bg-neutral-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-neutral-200 transition-all"
                  />
                </div>
                {form1.formState.errors.title && (
                  <p className="text-xs text-red-500 font-medium ml-1">{form1.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="destination" className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
                  Destinazione
                </label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-neutral-900 transition-colors" />
                  <input
                    {...form1.register('destination')}
                    id="destination"
                    placeholder="Dove volete andare?"
                    className="w-full pl-12 pr-4 py-4 bg-neutral-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-neutral-200 transition-all"
                  />
                </div>
                {form1.formState.errors.destination && (
                  <p className="text-xs text-red-500 font-medium ml-1">{form1.formState.errors.destination.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="start_date" className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Partenza</label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-neutral-900 transition-colors" />
                    <input
                      id="start_date"
                      {...form1.register('start_date')}
                      type="date"
                      className="w-full pl-12 pr-4 py-4 bg-neutral-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-neutral-200 transition-all cursor-pointer"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="end_date" className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Ritorno</label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-neutral-900 transition-colors" />
                    <input
                      id="end_date"
                      {...form1.register('end_date')}
                      type="date"
                      min={startDate || undefined}
                      className="w-full pl-12 pr-4 py-4 bg-neutral-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-neutral-200 transition-all cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Descrizione</label>
                <textarea
                  id="description"
                  {...form1.register('description')}
                  rows={3}
                  placeholder="Appunti rapidi sul viaggio..."
                  className="w-full p-4 bg-neutral-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-neutral-200 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 py-5 bg-neutral-900 hover:bg-black text-white rounded-2xl font-bold transition-all shadow-lg shadow-neutral-200 active:scale-[0.98]"
              >
                Continua <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* ── Step 1: Invite Partner ── */}
          {step === 1 && (
            <form onSubmit={form2.handleSubmit(handleStep2)} className="space-y-8">
              <div className="bg-neutral-50 rounded-3xl p-8 text-center flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-white shadow-sm rounded-full flex items-center justify-center">
                  <Users className="w-10 h-10 text-neutral-900" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">Con chi viaggi?</h3>
                  <p className="text-neutral-400 text-sm max-w-[240px]">
                    Inserisci l&apos;email del tuo partner per pianificare il viaggio insieme.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="partner_email" className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
                  Email del partner
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-neutral-900 transition-colors" />
                  <input
                    id="partner_email"
                    {...form2.register('partner_email')}
                    type="email"
                    placeholder="partner@example.com"
                    className="w-full pl-12 pr-4 py-4 bg-neutral-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-neutral-200 transition-all"
                  />
                </div>
                {form2.formState.errors.partner_email && (
                  <p className="text-xs text-red-500 font-medium ml-1">{form2.formState.errors.partner_email.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-3 py-5 bg-neutral-900 hover:bg-black text-white rounded-2xl font-bold transition-all shadow-lg shadow-neutral-200 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  {saving ? 'Creazione in corso...' : 'Concludi e Crea'}
                </button>

                <button
                  type="button"
                  onClick={() => handleStep2({ partner_email: '' })}
                  disabled={saving}
                  className="w-full py-4 text-neutral-400 hover:text-neutral-900 text-xs font-bold uppercase tracking-widest transition-all"
                >
                  Lo farò più tardi
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: Success ── */}
          {step === 2 && (
            <div className="text-center py-12 flex flex-col items-center">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-25" />
                <Check className="w-12 h-12 text-green-500 relative z-10" />
              </div>
              <h2 className="font-display text-4xl font-bold text-neutral-900 mb-4 tracking-tight">
                Viaggio creato!
              </h2>
              <p className="text-neutral-400 font-medium max-w-sm">
                Ottimo lavoro! Reindirizzamento alla dashboard del viaggio...
              </p>
              <div className="mt-12">
                <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
