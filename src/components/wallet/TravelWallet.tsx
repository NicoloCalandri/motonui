'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { FileText, CreditCard, PlusCircle } from 'lucide-react';
import { jsonFetcher } from '@/lib/fetcher';
import type { TripWithDetails, Document as TravelDocument, DocumentType } from '@/lib/types';
import AddDocumentDrawer from './AddDocumentDrawer';
import { DOC_TYPE_CONFIG, DocumentViewer, WalletCard } from './wallet-cards';

interface TravelWalletProps {
    trip: TripWithDetails;
    onDataChange?: () => void;
}

/**
 * Travel Wallet — Apple Wallet-style document hub.
 * Shows all documents chronologically with color-coded cards.
 */
export default function TravelWallet({ trip }: TravelWalletProps) {
    const { data: documents = [], mutate } = useSWR<TravelDocument[]>(`/api/trips/${trip.id}/documents`, jsonFetcher, {
        fallbackData: trip.documents ?? [],
    });
    const [viewingDoc, setViewingDoc] = useState<TravelDocument | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);

    const fetchDocuments = () => { void mutate(); };

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

