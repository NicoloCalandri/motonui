'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, Loader2, Mail, UserPlus } from 'lucide-react';

const InviteSchema = z.object({
    email: z.string().trim().email('Inserisci un indirizzo email valido'),
});

type InviteValues = z.infer<typeof InviteSchema>;

interface InvitePartnerCardProps {
    tripId: string;
}

interface InviteResult {
    email: string;
    inviteUrl: string;
    emailSent: boolean;
}

/**
 * Shown while the trip has a single member (T-2.5): the owner invites the
 * partner by email and can also copy the link to share it by hand.
 */
export default function InvitePartnerCard({ tripId }: InvitePartnerCardProps) {
    const form = useForm<InviteValues>({ resolver: zodResolver(InviteSchema) });
    const [result, setResult] = useState<InviteResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const onSubmit = async (values: InviteValues) => {
        setError(null);
        const res = await fetch(`/api/trips/${tripId}/invites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
        });
        const body: { invite?: { email: string }; invite_url?: string; email_sent?: boolean; error?: string } = await res.json();
        if (!res.ok || !body.invite || !body.invite_url) {
            setError(body.error ?? 'Ops! Non riusciamo a creare l’invito. Riprova tra poco 🏝️');
            return;
        }
        setResult({ email: body.invite.email, inviteUrl: body.invite_url, emailSent: Boolean(body.email_sent) });
    };

    const copyLink = async () => {
        if (!result) return;
        await navigator.clipboard.writeText(result.inviteUrl);
        setCopied(true);
    };

    return (
        <section aria-labelledby="invite-partner-title" className="m-4 md:mx-6 p-5 rounded-2xl bg-white border border-sand-200 space-y-4">
            <div className="flex items-center gap-3">
                <UserPlus className="w-5 h-5 text-terracotta-400" aria-hidden="true" />
                <h2 id="invite-partner-title" className="font-semibold text-ink-800">Invita il tuo partner</h2>
            </div>

            {result ? (
                <div className="space-y-3 text-sm text-ink-600">
                    <p>
                        {result.emailSent
                            ? `Invito inviato a ${result.email}. Il link vale 7 giorni.`
                            : `Invito creato per ${result.email}: condividi tu il link, vale 7 giorni.`}
                    </p>
                    <button
                        type="button"
                        onClick={copyLink}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sand-100 hover:bg-sand-200 font-medium"
                    >
                        <Copy className="w-4 h-4" aria-hidden="true" />
                        {copied ? 'Link copiato' : 'Copia il link'}
                    </button>
                </div>
            ) : (
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-3" noValidate>
                    <label htmlFor="partner-email" className="sr-only">Email del partner</label>
                    <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" aria-hidden="true" />
                        <input
                            id="partner-email"
                            type="email"
                            autoComplete="email"
                            placeholder="partner@example.com"
                            {...form.register('email')}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-sand-50 border border-sand-200 text-sm"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={form.formState.isSubmitting}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-ink-900 text-white text-sm font-semibold disabled:opacity-50"
                    >
                        {form.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                        Invia invito
                    </button>
                </form>
            )}

            {(error || form.formState.errors.email) && (
                <p role="alert" className="text-sm text-red-600">{error ?? form.formState.errors.email?.message}</p>
            )}
        </section>
    );
}
