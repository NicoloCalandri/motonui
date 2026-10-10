'use client';

import { useState, type ChangeEvent } from 'react';
import { Loader2, Ticket, Upload } from 'lucide-react';
import { hasBoardingPass } from '@/lib/boarding-pass';

interface BoardingPassFieldProps {
    tripId: string;
    dayId: string | null | undefined;
    legId: string;
    hasFile: boolean;
    onChange: (hasFile: boolean) => void;
}

/** Upload or remove the boarding pass of a saved flight leg. */
export default function BoardingPassField({ tripId, dayId, legId, hasFile, onChange }: BoardingPassFieldProps) {
    const [uploading, setUploading] = useState(false);
    const url = `/api/trips/${tripId}/days/${dayId}/legs/${legId}/boarding-pass`;

    const upload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !dayId) return;
        setUploading(true);
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await fetch(url, { method: 'POST', body: form });
            if (res.ok) onChange(hasBoardingPass(await res.json()));
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const remove = async () => {
        if (!dayId) return;
        await fetch(url, { method: 'DELETE' });
        onChange(false);
    };

    return (
        <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Carta d&apos;imbarco</label>
            {hasFile ? (
                <div className="flex items-center gap-3 p-4 bg-sage-50 rounded-2xl">
                    <Ticket className="w-5 h-5 text-sage-500 flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium text-ink-700 truncate">Documento caricato</span>
                    <button
                        type="button"
                        onClick={remove}
                        className="text-xs font-bold text-red-500 hover:text-red-700"
                    >
                        Rimuovi
                    </button>
                </div>
            ) : (
                <label className="flex items-center justify-center gap-3 p-4 bg-neutral-50 hover:bg-neutral-100 border-2 border-dashed border-neutral-200 rounded-2xl cursor-pointer transition-colors">
                    {uploading
                        ? <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                        : <Upload className="w-5 h-5 text-neutral-400" />}
                    <span className="text-sm font-bold text-neutral-500">
                        {uploading ? 'Caricamento...' : 'Carica foto o PDF'}
                    </span>
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                        className="sr-only"
                        onChange={upload}
                        disabled={uploading}
                    />
                </label>
            )}
        </div>
    );
}
