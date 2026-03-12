'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plane, MapPin, Calendar, Users, Loader2, ArrowLeft, ArrowRight, Check } from 'lucide-react';

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

// ─── Wizard Step Indicator ────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < current
                ? 'bg-sage-400 text-white'
                : i === current
                ? 'bg-terracotta-400 text-white'
                : 'bg-sand-200 text-ink-400'
            }`}
          >
            {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`flex-1 h-0.5 w-8 ${i < current ? 'bg-sage-400' : 'bg-sand-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

/**
 * 3-step wizard to create a new trip:
 * 1. Basic info (name, destination, dates, description)
 * 2. Invite partner (optional email)
 * 3. Confirmation
 */
export default function NewTripPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [tripData, setTripData] = useState<Step1Values | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form1 = useForm<Step1Values>({ resolver: zodResolver(Step1Schema) });
  const form2 = useForm<Step2Values>({ resolver: zodResolver(Step2Schema) });

  const handleStep1 = (values: Step1Values) => {
    setTripData(values);
    setStep(1);
  };

  const handleStep2 = async (values: Step2Values) => {
    if (!tripData) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });

      if (!res.ok) {
        const data: { error?: string } = await res.json();
        throw new Error(data.error ?? 'Errore durante la creazione');
      }

      const trip: { id: string } = await res.json();

      // If partner email provided, invite them (best-effort)
      if (values.partner_email) {
        await fetch('/api/trips/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trip_id: trip.id, email: values.partner_email }),
        }).catch(() => {/* non-blocking */});
      }

      setStep(2);
      setTimeout(() => router.push(`/trips/${trip.id}`), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ops! Qualcosa è andato storto 🏝️');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen paper-bg flex flex-col items-center justify-center p-4 pb-24 md:pb-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : router.back()}
            className="p-2 rounded-xl hover:bg-sand-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-ink-500" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink-900">Nuovo viaggio</h1>
            <p className="text-ink-400 text-sm">
              {step === 0 && "Dove andate questa volta?"}
              {step === 1 && "Invita il tuo partner"}
              {step === 2 && "Viaggio creato!"}
            </p>
          </div>
        </div>

        <div className="card p-6 md:p-8">
          <StepIndicator current={step} total={3} />

          {error && (
            <div className="mb-4 p-3 bg-terracotta-50 border border-terracotta-200 rounded-xl text-terracotta-600 text-sm">
              {error}
            </div>
          )}

          {/* ── Step 0: Basic Info ── */}
          {step === 0 && (
            <form onSubmit={form1.handleSubmit(handleStep1)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  Nome del viaggio *
                </label>
                <input
                  {...form1.register('title')}
                  placeholder="es. Giappone primavera 2025"
                  className="w-full px-4 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-terracotta-400/60"
                />
                {form1.formState.errors.title && (
                  <p className="text-xs text-terracotta-500 mt-1">{form1.formState.errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  <MapPin className="inline w-3.5 h-3.5 mr-1 text-terracotta-400" />
                  Destinazione *
                </label>
                <input
                  {...form1.register('destination')}
                  placeholder="es. Tokyo, Giappone"
                  className="w-full px-4 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-terracotta-400/60"
                />
                {form1.formState.errors.destination && (
                  <p className="text-xs text-terracotta-500 mt-1">{form1.formState.errors.destination.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">
                    <Calendar className="inline w-3.5 h-3.5 mr-1 text-terracotta-400" />
                    Partenza
                  </label>
                  <input
                    {...form1.register('start_date')}
                    type="date"
                    className="w-full px-3 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-terracotta-400/60 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">
                    Ritorno
                  </label>
                  <input
                    {...form1.register('end_date')}
                    type="date"
                    className="w-full px-3 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-terracotta-400/60 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Descrizione</label>
                <textarea
                  {...form1.register('description')}
                  rows={3}
                  placeholder="Di cosa parla questo viaggio?"
                  className="w-full px-4 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 placeholder-ink-300 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-400/60 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-terracotta-400 hover:bg-terracotta-500 text-white rounded-xl font-medium transition-colors"
              >
                Avanti <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ── Step 1: Invite Partner ── */}
          {step === 1 && (
            <form onSubmit={form2.handleSubmit(handleStep2)} className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="w-16 h-16 bg-terracotta-50 rounded-2xl flex items-center justify-center">
                  <Users className="w-8 h-8 text-terracotta-400" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink-900">Invita il tuo partner</h3>
                  <p className="text-ink-400 text-sm">Opzionale — puoi farlo anche dopo</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Email del partner</label>
                <input
                  {...form2.register('partner_email')}
                  type="email"
                  placeholder="sara@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-sand-300 bg-white text-ink-900 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-terracotta-400/60"
                />
                {form2.formState.errors.partner_email && (
                  <p className="text-xs text-terracotta-500 mt-1">{form2.formState.errors.partner_email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-terracotta-400 hover:bg-terracotta-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plane className="w-4 h-4" />}
                {saving ? 'Creazione in corso...' : 'Crea il viaggio'}
              </button>

              <button
                type="button"
                onClick={() => form2.handleSubmit(handleStep2)({ partner_email: '' })}
                className="w-full px-4 py-2.5 text-ink-400 hover:text-ink-600 text-sm transition-colors"
              >
                Salta per ora
              </button>
            </form>
          )}

          {/* ── Step 2: Success ── */}
          {step === 2 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-sage-500" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-ink-900 mb-2">
                Buon viaggio! 🏝️
              </h2>
              <p className="text-ink-400 text-sm">
                Il vostro viaggio è stato creato. Reindirizzamento...
              </p>
              <div className="mt-4 flex justify-center">
                <div className="w-6 h-6 border-2 border-terracotta-400 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
