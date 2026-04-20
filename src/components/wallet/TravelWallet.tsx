'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
    Plane, Hotel, Utensils, Ticket, FileText, Shield, CreditCard,
    Download, X, QrCode, Eye, PlusCircle, ChevronRight,
} from 'lucide-react';
import type { TripWithDetails, Document as TravelDocument, DocumentType } from '@/lib/types';

const DOC_TYPE_CONFIG: Record<DocumentType, { label: string; icon: React.ElementType; bgColor: string; textColor: string; borderColor: string }> = {
    boarding_pass: { label: 'Carta d\'imbarco', icon: Plane, bgColor: 'bg-blue-500', textColor: 'text-blue-600', borderColor: 'border-blue-200' },
    hotel_voucher: { label: 'Voucher hotel', icon: Hotel, bgColor: 'bg-emerald-500', textColor: 'text-emerald-600', borderColor: 'border-emerald-200' },
    ticket: { label: 'Biglietto', icon: Ticket, bgColor: 'bg-purple-500', textColor: 'text-purple-600', borderColor: 'border-purple-200' },
    reservation_confirmation: { label: 'Conferma prenotazione', icon: Utensils, bgColor: 'bg-orange-500', textColor: 'text-orange-600', borderColor: 'border-orange-200' },
    insurance: { label: 'Assicurazione', icon: Shield, bgColor: 'bg-teal-500', textColor: 'text-teal-600', borderColor: 'border-teal-200' },
    visa: { label: 'Visto', icon: CreditCard, bgColor: 'bg-red-500', textColor: 'text-red-600', borderColor: 'border-red-200' },
    other: { label: 'Altro', icon: FileText, bgColor: 'bg-slate-500', textColor: 'text-slate-600', borderColor: 'border-slate-200' },
};

interface TravelWalletProps {
    trip: TripWithDetails;
}

/**
 * Travel Wallet — Apple Wallet-style document hub.
 * Shows all documents chronologically with color-coded cards.
 */
export default function TravelWallet({ trip }: TravelWalletProps) {
    const [documents, setDocuments] = useState<TravelDocument[]>(trip.documents ?? []);
    const [viewingDoc, setViewingDoc] = useState<TravelDocument | null>(null);
    const [uploading, setUploading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    const fetchDocuments = () => {
        fetch(`/api/trips/${trip.id}/documents`)
            .then(r => r.json())
            .then((data: TravelDocument[]) => setDocuments(data))
            .catch(() => { });
    };

    useEffect(() => {
        fetchDocuments();
    }, [trip.id]);

    const deleteDocument = async (id: string) => {
        if (!confirm('Eliminare questo documento?')) return;
        await fetch(`/api/trips/${trip.id}/documents/${id}`, { method: 'DELETE' });
        fetchDocuments();
    };

    // Sort by valid_from (chronological), nulls at end
    const sortedDocs = [...documents].sort((a, b) => {
        if (!a.valid_from && !b.valid_from) return 0;
        if (!a.valid_from) return 1;
        if (!b.valid_from) return -1;
        return new Date(a.valid_from).getTime() - new Date(b.valid_from).getTime();
    });

    // Group by date
    const grouped: Record<string, TravelDocument[]> = {};
    for (const doc of sortedDocs) {
        const key = doc.valid_from ?? 'Senza data';
        grouped[key] = [...(grouped[key] ?? []), doc];
    }

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="font-display text-xl font-semibold text-ink-900">Travel Wallet</h2>
                    <p className="text-xs text-ink-400 mt-0.5">Tutti i tuoi documenti di viaggio</p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-black transition-colors shadow-panel"
                >
                    <PlusCircle className="w-4 h-4" /> Aggiungi
                </button>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap gap-2">
                {Object.entries(
                    documents.reduce<Record<string, number>>((acc, d) => {
                        acc[d.type] = (acc[d.type] ?? 0) + 1;
                        return acc;
                    }, {})
                ).map(([type, count]) => {
                    const config = DOC_TYPE_CONFIG[type as DocumentType];
                    const Icon = config?.icon ?? FileText;
                    return (
                        <div key={type} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${config?.borderColor ?? 'border-sand-200'} bg-white`}>
                            <Icon className={`w-3.5 h-3.5 ${config?.textColor ?? 'text-ink-400'}`} />
                            <span className="text-xs font-semibold text-ink-700">{count}</span>
                        </div>
                    );
                })}
            </div>

            {/* Document Cards — Apple Wallet style */}
            {documents.length === 0 ? (
                <div className="text-center py-16 text-ink-400">
                    <CreditCard className="w-16 h-16 mx-auto mb-4 text-sand-300" />
                    <p className="font-display text-lg font-semibold text-ink-700 mb-1">Nessun documento</p>
                    <p className="text-sm mb-4">Aggiungi carte d&apos;imbarco, voucher, biglietti e altro</p>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="px-4 py-2 bg-neutral-900 text-white font-bold rounded-2xl shadow-panel hover:bg-black text-sm"
                    >
                        Aggiungi documento
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(grouped).map(([date, docs]) => (
                        <div key={date}>
                            <p className="text-xs font-medium text-ink-400 mb-2 uppercase tracking-wide">
                                {date !== 'Senza data'
                                    ? format(new Date(date), 'EEEE d MMMM', { locale: it })
                                    : 'Senza data'}
                            </p>
                            <div className="space-y-2">
                                {docs.map(doc => (
                                    <WalletCard
                                        key={doc.id}
                                        document={doc}
                                        onView={() => setViewingDoc(doc)}
                                        onDelete={() => deleteDocument(doc.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Document Viewer */}
            {viewingDoc && (
                <DocumentViewer
                    document={viewingDoc}
                    onClose={() => setViewingDoc(null)}
                />
            )}

            {/* Add Document Form */}
            {showAddForm && (
                <AddDocumentDrawer
                    tripId={trip.id}
                    onClose={() => setShowAddForm(false)}
                    onSaved={() => { fetchDocuments(); setShowAddForm(false); }}
                />
            )}
        </div>
    );
}

// ─── Wallet Card ───────────────────────────────────────────────────────────────

function WalletCard({ document: doc, onView, onDelete }: {
    document: TravelDocument;
    onView: () => void;
    onDelete: () => void;
}) {
    const config = DOC_TYPE_CONFIG[doc.type] ?? DOC_TYPE_CONFIG.other;
    const Icon = config.icon;

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border ${config.borderColor} bg-white shadow-sm hover:shadow-md transition-all cursor-pointer group`}
            onClick={onView}
        >
            {/* Color accent bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${config.bgColor}`} />

            <div className="pl-5 pr-4 py-4 flex items-center gap-3">
                <div className={`w-10 h-10 ${config.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800 truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
                        {doc.valid_from && doc.valid_until && (
                            <span className="text-xs text-ink-400">
                                {format(new Date(doc.valid_from), 'd MMM', { locale: it })} – {format(new Date(doc.valid_until), 'd MMM', { locale: it })}
                            </span>
                        )}
                    </div>
                </div>
                {doc.barcode_data && (
                    <QrCode className={`w-5 h-5 ${config.textColor} opacity-40 flex-shrink-0`} />
                )}
                <ChevronRight className="w-4 h-4 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
        </div>
    );
}

// ─── Document Viewer (full-screen) ────────────────────────────────────────────

function DocumentViewer({ document: doc, onClose }: { document: TravelDocument; onClose: () => void }) {
    const config = DOC_TYPE_CONFIG[doc.type] ?? DOC_TYPE_CONFIG.other;
    const Icon = config.icon;
    const isPdf = doc.file_type === 'pdf';

    const handleDownload = () => {
        const a = document.createElement('a');
        a.href = doc.file_url;
        a.download = `${doc.title}.${isPdf ? 'pdf' : 'jpg'}`;
        a.target = '_blank';
        a.click();
    };

    return (
        <div className="fixed inset-0 z-50 bg-neutral-950/90 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 ${config.bgColor}/20 rounded-xl flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${config.textColor}`} />
                    </div>
                    <div>
                        <p className="font-bold text-white leading-tight">{doc.title}</p>
                        <p className={`text-xs ${config.textColor}`}>{config.label}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownload}
                        aria-label="Scarica"
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                    <button
                        onClick={onClose}
                        aria-label="Chiudi"
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Barcode pill */}
            {doc.barcode_data && (
                <div className="flex justify-center pb-4 flex-shrink-0">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl">
                        <QrCode className="w-4 h-4 text-neutral-300" />
                        <span className="text-white font-mono font-bold tracking-widest text-lg">
                            {doc.barcode_data}
                        </span>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                {isPdf ? (
                    <iframe
                        src={doc.file_url}
                        className="w-full h-full max-w-2xl rounded-2xl border-0"
                        title={doc.title}
                    />
                ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={doc.file_url}
                        alt={doc.title}
                        className="max-w-full max-h-full object-contain rounded-2xl"
                    />
                )}
            </div>

            {/* Info bar */}
            {doc.valid_from && (
                <div className="flex-shrink-0 px-6 py-4 bg-white/5 flex justify-between items-center text-sm">
                    <span className="text-neutral-400">Validità</span>
                    <span className="text-white font-bold">
                        {format(new Date(doc.valid_from), 'd MMM yyyy', { locale: it })}
                        {doc.valid_until && ` – ${format(new Date(doc.valid_until), 'd MMM yyyy', { locale: it })}`}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Add Document Drawer ──────────────────────────────────────────────────────

function AddDocumentDrawer({ tripId, onClose, onSaved }: {
    tripId: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [title, setTitle] = useState('');
    const [type, setType] = useState<DocumentType>('other');
    const [fileUrl, setFileUrl] = useState('');
    const [fileType, setFileType] = useState<'pdf' | 'image'>('image');
    const [validFrom, setValidFrom] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [barcodeData, setBarcodeData] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !fileUrl) return;
        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/api/trips/${tripId}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    type,
                    file_url: fileUrl,
                    file_type: fileType,
                    valid_from: validFrom || null,
                    valid_until: validUntil || null,
                    barcode_data: barcodeData || null,
                }),
            });

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
                    <div className="pointer-events-auto w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[48px] shadow-2xl animate-slide-up sm:animate-fade-in flex flex-col relative max-h-[90vh]">
                        <div className="p-6 sm:p-10 overflow-y-auto">
                            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-8 sm:hidden" />
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Nuovo documento</h2>
                                <button onClick={onClose} className="p-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 rounded-full transition-colors">
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
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Titolo *</label>
                                    <input
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="es. Carta d'imbarco Roma-Tokyo"
                                        required
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Tipo documento</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(Object.entries(DOC_TYPE_CONFIG) as [DocumentType, typeof DOC_TYPE_CONFIG[DocumentType]][]).map(([key, config]) => {
                                            const Icon = config.icon;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => setType(key)}
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
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">URL del file *</label>
                                    <input
                                        value={fileUrl}
                                        onChange={e => setFileUrl(e.target.value)}
                                        placeholder="https://..."
                                        required
                                        className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Tipo file</label>
                                        <select
                                            value={fileType}
                                            onChange={e => setFileType(e.target.value as 'pdf' | 'image')}
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        >
                                            <option value="image">Immagine</option>
                                            <option value="pdf">PDF</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Codice/Barcode</label>
                                        <input
                                            value={barcodeData}
                                            onChange={e => setBarcodeData(e.target.value)}
                                            placeholder="es. ABC123"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Valido dal</label>
                                        <input
                                            value={validFrom}
                                            onChange={e => setValidFrom(e.target.value)}
                                            type="date"
                                            className="w-full px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Valido fino al</label>
                                        <input
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
                                        disabled={saving || !title || !fileUrl}
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
