import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Plane, Hotel, Utensils, Ticket, FileText, Shield, CreditCard, Download, X, QrCode, Trash2, ChevronRight } from 'lucide-react';
import { documentHref } from '@/lib/trip-files';
import type { Document as TravelDocument, DocumentType } from '@/lib/types';

export const DOC_TYPE_CONFIG: Record<DocumentType, { label: string; icon: React.ElementType; bgColor: string; textColor: string; borderColor: string }> = {
    boarding_pass: { label: 'Carta d\'imbarco', icon: Plane, bgColor: 'bg-blue-500', textColor: 'text-blue-600', borderColor: 'border-blue-200' },
    hotel_voucher: { label: 'Voucher hotel', icon: Hotel, bgColor: 'bg-emerald-500', textColor: 'text-emerald-600', borderColor: 'border-emerald-200' },
    ticket: { label: 'Biglietto', icon: Ticket, bgColor: 'bg-purple-500', textColor: 'text-purple-600', borderColor: 'border-purple-200' },
    reservation_confirmation: { label: 'Conferma prenotazione', icon: Utensils, bgColor: 'bg-orange-500', textColor: 'text-orange-600', borderColor: 'border-orange-200' },
    insurance: { label: 'Assicurazione', icon: Shield, bgColor: 'bg-teal-500', textColor: 'text-teal-600', borderColor: 'border-teal-200' },
    visa: { label: 'Visto', icon: CreditCard, bgColor: 'bg-red-500', textColor: 'text-red-600', borderColor: 'border-red-200' },
    other: { label: 'Altro', icon: FileText, bgColor: 'bg-slate-500', textColor: 'text-slate-600', borderColor: 'border-slate-200' },
};

// ─── Wallet Card ───────────────────────────────────────────────────────────────

export function WalletCard({ document: doc, onView, onDelete }: {
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
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    aria-label={`Elimina ${doc.title}`}
                    className="p-1.5 rounded-lg text-ink-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
        </div>
    );
}

// ─── Document Viewer (full-screen) ────────────────────────────────────────────

export function DocumentViewer({ document: doc, onClose }: { document: TravelDocument; onClose: () => void }) {
    const config = DOC_TYPE_CONFIG[doc.type] ?? DOC_TYPE_CONFIG.other;
    const Icon = config.icon;
    const isPdf = doc.file_type === 'pdf';
    // Uploaded files go through the authenticated route; external links only if https.
    const href = documentHref(doc);
    const downloadHref = documentHref(doc, { download: true });

    const handleDownload = () => {
        if (!downloadHref) return;
        const a = document.createElement('a');
        a.href = downloadHref;
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
                {!href ? (
                    <p className="text-neutral-300 text-sm">Il link di questo documento non è valido 🏝️</p>
                ) : isPdf ? (
                    <iframe
                        src={href}
                        className="w-full h-full max-w-2xl rounded-2xl border-0"
                        title={doc.title}
                    />
                ) : (
                    <img
                        src={href}
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

