'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useDialogA11y } from '@/components/ui/use-dialog-a11y';
import type { DocumentType } from '@/lib/types';
import { DOC_TYPE_CONFIG } from './wallet-cards';

// ─── Add Document Drawer ──────────────────────────────────────────────────────

export default function AddDocumentDrawer({ tripId, onClose, onSaved }: {
    tripId: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const panelRef = useDialogA11y<HTMLDivElement>(true, onClose);
    const [title, setTitle] = useState('');
    const [type, setType] = useState<DocumentType>('other');
    const [fileUrl, setFileUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState<'pdf' | 'image'>('image');
    const [validFrom, setValidFrom] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [barcodeData, setBarcodeData] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || (!file && !fileUrl)) return;
        setSaving(true);
        setError(null);

        try {
            let body: BodyInit;
            let headers: HeadersInit | undefined;
            if (file) {
                // Uploaded to the private bucket; the server sets file_type from the file.
                const form = new FormData();
                form.append('file', file);
                form.append('title', title);
                form.append('type', type);
                if (validFrom) form.append('valid_from', validFrom);
                if (validUntil) form.append('valid_until', validUntil);
                if (barcodeData) form.append('barcode_data', barcodeData);
                body = form;
            } else {
                headers = { 'Content-Type': 'application/json' };
                body = JSON.stringify({
                    title,
                    type,
                    file_url: fileUrl,
                    file_type: fileType,
                    valid_from: validFrom || null,
                    valid_until: validUntil || null,
                    barcode_data: barcodeData || null,
                });
            }

            const res = await fetch(`/api/trips/${tripId}/documents`, { method: 'POST', headers, body });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? 'Errore nel salvataggio');
            }

            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore imprevisto');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="relative z-50">
            <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
                <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
                    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="document-drawer-title" tabIndex={-1} className="pointer-events-auto w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[48px] shadow-2xl animate-slide-up sm:animate-fade-in flex flex-col relative max-h-[90vh]">
                        <div className="p-6 sm:p-10 overflow-y-auto">
                            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-8 sm:hidden" />
                            <div className="flex items-center justify-between mb-8">
                                <h2 id="document-drawer-title" className="text-3xl font-bold tracking-tight text-neutral-900">Nuovo documento</h2>
                                <button type="button" onClick={onClose} aria-label="Chiudi" className="p-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 rounded-full transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {error && (
                                <div className="mb-8 p-5 bg-red-50 text-red-600 rounded-2xl text-sm font-bold tracking-wide">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={onSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="document-title" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Titolo *</label>
                                    <input
                                            id="document-title"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="es. Carta d'imbarco Roma-Tokyo"
                                        required
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                    />
                                </div>

                                <div>
                                    <p id="document-type-label" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Tipo documento</p>
                                    <div role="group" aria-labelledby="document-type-label" className="flex flex-wrap gap-2">
                                        {(Object.entries(DOC_TYPE_CONFIG) as [DocumentType, typeof DOC_TYPE_CONFIG[DocumentType]][]).map(([key, config]) => {
                                            const Icon = config.icon;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => setType(key)}
                                                    aria-pressed={type === key}
                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                                        type === key
                                                            ? `${config.bgColor} text-white shadow-panel`
                                                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                                    }`}
                                                >
                                                    <Icon className="w-3.5 h-3.5" />
                                                    {config.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="document-file" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">File (PDF o immagine, max 20 MB)</label>
                                    <input
                                        id="document-file"
                                        type="file"
                                        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
                                        onChange={e => setFile(e.target.files?.[0] ?? null)}
                                        className="w-full text-sm text-neutral-600 file:mr-4 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-neutral-100 file:font-bold"
                                    />
                                </div>

                                {!file && (
                                    <div>
                                        <label htmlFor="document-url" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Oppure link https</label>
                                        <input
                                            id="document-url"
                                            type="url"
                                            value={fileUrl}
                                            onChange={e => setFileUrl(e.target.value)}
                                            placeholder="https://..."
                                            pattern="https://.*"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="document-file-type" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Tipo file</label>
                                        <select
                                            id="document-file-type"
                                            value={fileType}
                                            onChange={e => setFileType(e.target.value as 'pdf' | 'image')}
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        >
                                            <option value="image">Immagine</option>
                                            <option value="pdf">PDF</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="document-barcode" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Codice/Barcode</label>
                                        <input
                                            id="document-barcode"
                                            value={barcodeData}
                                            onChange={e => setBarcodeData(e.target.value)}
                                            placeholder="es. ABC123"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="document-valid-from" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Valido dal</label>
                                        <input
                                            id="document-valid-from"
                                            value={validFrom}
                                            onChange={e => setValidFrom(e.target.value)}
                                            type="date"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="document-valid-until" className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Valido fino al</label>
                                        <input
                                            id="document-valid-until"
                                            value={validUntil}
                                            onChange={e => setValidUntil(e.target.value)}
                                            type="date"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="pt-6">
                                    <button
                                        type="submit"
                                        disabled={saving || !title || (!file && !fileUrl)}
                                        className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-neutral-900 hover:bg-black text-white rounded-[24px] font-bold text-lg transition-all duration-300 hover:shadow-panel active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? 'Salvataggio...' : 'Aggiungi documento'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
