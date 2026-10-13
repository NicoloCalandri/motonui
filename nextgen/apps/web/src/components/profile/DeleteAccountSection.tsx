'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Trash2 } from 'lucide-react';

const ConfirmSchema = z.object({
    confirm: z.literal('ELIMINA', { errorMap: () => ({ message: 'Scrivi ELIMINA per confermare' }) }),
});

type ConfirmValues = z.infer<typeof ConfirmSchema>;

/**
 * Self-service account deletion (T-2.9, SR-PRIV-04). Explains what happens
 * to shared trips before asking for confirmation.
 */
export default function DeleteAccountSection() {
    const form = useForm<ConfirmValues>({ resolver: zodResolver(ConfirmSchema) });
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (values: ConfirmValues) => {
        setError(null);
        const res = await fetch('/api/account/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
        });
        if (!res.ok) {
            const body: { error?: string } = await res.json().catch(() => ({}));
            setError(body.error ?? 'Ops! Qualcosa è andato storto 🏝️');
            return;
        }
        window.location.assign('/auth/login');
    };

    return (
        <section aria-labelledby="delete-account-title" className="bg-white rounded-[40px] p-8 md:p-12 shadow-soft border border-red-100 space-y-6">
            <div className="flex items-center justify-between">
                <h3 id="delete-account-title" className="text-xl font-bold text-neutral-900 tracking-tight">Elimina account</h3>
                <Trash2 className="w-6 h-6 text-red-200" aria-hidden="true" />
            </div>
            <ul className="text-sm text-neutral-500 space-y-2 list-disc pl-5">
                <li>I viaggi in cui sei da solo vengono eliminati, con foto e documenti.</li>
                <li>I viaggi condivisi passano al tuo partner; le tue foto, i tuoi documenti e le spese che hai pagato vengono eliminati.</li>
                <li>L&apos;operazione non si può annullare.</li>
            </ul>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-3" noValidate>
                <label htmlFor="delete-confirm" className="sr-only">Scrivi ELIMINA per confermare</label>
                <input
                    id="delete-confirm"
                    {...form.register('confirm')}
                    placeholder="Scrivi ELIMINA"
                    autoComplete="off"
                    className="flex-1 px-4 py-3 bg-neutral-50 border-none rounded-2xl text-sm font-bold"
                />
                <button
                    type="submit"
                    disabled={form.formState.isSubmitting}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-sm disabled:opacity-50"
                >
                    {form.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    Elimina definitivamente
                </button>
            </form>
            {(error || form.formState.errors.confirm) && (
                <p role="alert" className="text-sm text-red-600">{error ?? form.formState.errors.confirm?.message}</p>
            )}
        </section>
    );
}
