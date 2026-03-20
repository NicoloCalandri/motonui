'use client';

import { X, Download, QrCode, Plane } from 'lucide-react';
import type { Leg } from '@/lib/types';

interface BoardingPassViewerProps {
    leg: Leg;
    onClose: () => void;
}

export default function BoardingPassViewer({ leg, onClose }: BoardingPassViewerProps) {
    const url = leg.boarding_pass_url;
    const isPdf = url?.toLowerCase().endsWith('.pdf');

    const handleDownload = () => {
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = `boarding-pass-${leg.pnr ?? leg.id}.${isPdf ? 'pdf' : 'jpg'}`;
        a.target = '_blank';
        a.click();
    };

    return (
        <div className="fixed inset-0 z-50 bg-neutral-950/90 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-terracotta-400/20 rounded-xl flex items-center justify-center">
                        <Plane className="w-4 h-4 text-terracotta-400" />
                    </div>
                    <div>
                        <p className="font-bold text-white leading-tight">{leg.from_name.split(',')[0]} → {leg.to_name.split(',')[0]}</p>
                        {leg.carrier && <p className="text-xs text-neutral-400">{leg.carrier}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {url && (
                        <button
                            onClick={handleDownload}
                            aria-label="Scarica carta d'imbarco"
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        aria-label="Chiudi"
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* PNR pill */}
            {(leg.pnr || leg.booking_ref) && (
                <div className="flex justify-center pb-4 flex-shrink-0">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl">
                        <QrCode className="w-4 h-4 text-neutral-300" />
                        <span className="text-white font-mono font-bold tracking-widest text-lg">
                            {leg.pnr ?? leg.booking_ref}
                        </span>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                {!url ? (
                    <div className="text-center text-neutral-400">
                        <QrCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="font-semibold">Nessuna carta d&apos;imbarco caricata</p>
                        <p className="text-sm mt-1">Carica un&apos;immagine o PDF dal drawer dello spostamento</p>
                    </div>
                ) : isPdf ? (
                    <iframe
                        src={url}
                        className="w-full h-full max-w-2xl rounded-2xl border-0"
                        title="Carta d'imbarco PDF"
                    />
                ) : (
                    // Image (photo of a boarding pass)
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={url}
                        alt="Carta d'imbarco"
                        className="max-w-full max-h-full object-contain rounded-2xl"
                    />
                )}
            </div>

            {/* Departure info bar */}
            {leg.departure_at && (
                <div className="flex-shrink-0 px-6 py-4 bg-white/5 flex justify-between items-center text-sm">
                    <span className="text-neutral-400">Partenza</span>
                    <span className="text-white font-bold">
                        {new Date(leg.departure_at).toLocaleString('it-IT', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                        })}
                    </span>
                </div>
            )}
        </div>
    );
}
