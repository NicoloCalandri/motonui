'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plane, MapPin, Calendar, Users, Loader2, ArrowLeft, ArrowRight, Check, Mail } from 'lucide-react';

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

// ─── Wizard Step Indicator ────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const steps = [
    { label: 'Dettagli', icon: Plane },
    { label: 'Compagno', icon: Users },
    { label: 'Finito', icon: Check },
  ];

  return (
    <div className="flex items-center justify-between mb-12 relative">
      <div className="absolute top-5 left-0 w-full h-0.5 bg-neutral-100 -z-10" />
      <div 
        className="absolute top-5 left-0 h-0.5 bg-neutral-900 transition-all duration-500 -z-10" 
        style={{ width: `${(current / (total - 1)) * 100}%` }}
      />
      
      {steps.map((s, i) => {
        const Icon = s.icon;
        const isActive = i <= current;
        const isCurrent = i === current;

        return (
          <div key={i} className="flex flex-col items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                isActive 
                  ? 'bg-neutral-900 border-neutral-900 text-white' 
                  : 'bg-white border-neutral-200 text-neutral-400'
              } ${isCurrent ? 'ring-4 ring-neutral-100 scale-110' : ''}`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
              isActive ? 'text-neutral-900' : 'text-neutral-400'
            }`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function NewTripPage() {
  const router = useRouter();
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

      if (values.partner_email) {
        await fetch('/api/trips/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trip_id: trip.id, email: values.partner_email }),
        }).catch(() => {});
      }

      setStep(2);
      setTimeout(() => router.push(`/trips/${trip.id}`), 1800);
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
              onClick={() => step > 0 ? setStep(step - 1) : router.back()}
              className="p-3 rounded-full bg-white shadow-sm hover:shadow-md transition-all text-neutral-600 active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display text-4xl font-bold text-neutral-900 tracking-tight">Nuovo viaggio</h1>
              <p className="text-neutral-400 font-medium">
                {step === 0 && "Il primo passo verso una nuova avventura"}
                {step === 1 && "Viaggiare in due è più divertente"}
                {step === 2 && "Preparate le valigie!"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-neutral-100">
          <StepIndicator current={step} total={3} />

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
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Partenza</label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-neutral-900 transition-colors" />
                    <input
                      {...form1.register('start_date')}
                      type="date"
                      className="w-full pl-12 pr-4 py-4 bg-neutral-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-neutral-200 transition-all cursor-pointer"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Ritorno</label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-neutral-900 transition-colors" />
                    <input
                      {...form1.register('end_date')}
                      type="date"
                      min={startDate || undefined}
                      className="w-full pl-12 pr-4 py-4 bg-neutral-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-neutral-200 transition-all cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">Descrizione</label>
                <textarea
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
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
                  Email del partner
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-neutral-900 transition-colors" />
                  <input
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
