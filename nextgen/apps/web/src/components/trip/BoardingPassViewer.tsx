import { X, Download, QrCode, Plane, FileText, Loader2 } from 'lucide-react';
import type { Leg } from '@motonui/shared-types';
import { boardingPassHref, isPdfBoardingPass } from '../../lib/boarding-pass';
import { usePrivateFile } from '../../lib/use-private-file';
import { wallClockDayTime } from '../../lib/wall-clock';
import { useDialogA11y } from '../ui/use-dialog-a11y';

interface BoardingPassViewerProps {
    leg: Leg;
    onClose: () => void;
}

/**
 * Full-screen boarding pass. Ported from src/components/trip/BoardingPassViewer.tsx.
 * The file sits in a private bucket and is served by the API after the
 * membership check: it is read with the session token (usePrivateFile) and
 * shown from an object URL, so no API or storage URL ends up in the page.
 * A PDF is offered as a link to open: it cannot be embedded in a frame.
 */
export default function BoardingPassViewer({ leg, onClose }: BoardingPassViewerProps) {
    const panelRef = useDialogA11y<HTMLDivElement>(true, onClose);
    const isPdf = isPdfBoardingPass(leg);
    const source = boardingPassHref(leg);
    // The old public column is not trusted: only the API route is read.
    const legacy = Boolean(source) && !source?.startsWith('/api/');
    const { url, loading, failed } = usePrivateFile(legacy ? null : source);
    const fileName = `carta-imbarco-${leg.pnr ?? leg.id}.${isPdf ? 'pdf' : 'jpg'}`;

    return (
        <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="boarding-pass-title"
            tabIndex={-1}
            className="fixed inset-0 z-50 bg-neutral-950/90 flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-terracotta-400/20 rounded-xl flex items-center justify-center">
                        <Plane className="w-4 h-4 text-terracotta-400" />
                    </div>
                    <div>
                        <h2 id="boarding-pass-title" className="font-bold text-white leading-tight">
                            <span className="sr-only">Carta d&apos;imbarco: </span>
                            {leg.from_name.split(',')[0]} → {leg.to_name.split(',')[0]}
                        </h2>
                        {leg.carrier && <p className="text-xs text-neutral-400">{leg.carrier}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {url && (
                        <a
                            href={url}
                            download={fileName}
                            aria-label="Scarica carta d'imbarco"
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            <Download className="w-5 h-5" />
                        </a>
                    )}
                    <button
                        type="button"
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
                {!source ? (
                    <div className="text-center text-neutral-400">
                        <QrCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="font-semibold">Nessuna carta d&apos;imbarco caricata</p>
                        <p className="text-sm mt-1">Carica un&apos;immagine o PDF dal drawer dello spostamento</p>
                    </div>
                ) : legacy ? (
                    <p className="text-center text-neutral-200 font-semibold max-w-sm">
                        Questa carta d&apos;imbarco è salvata in un formato precedente: caricala di nuovo dallo spostamento 🏝️
                    </p>
                ) : failed ? (
                    <p role="alert" className="text-center text-neutral-200 font-semibold">
                        Ops! Non riusciamo ad aprire la carta d&apos;imbarco. Riprova tra poco 🏝️
                    </p>
                ) : loading || !url ? (
                    <Loader2 className="w-8 h-8 animate-spin text-neutral-400" aria-label="Caricamento" />
                ) : isPdf ? (
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <FileText className="w-12 h-12" />
                        <span className="font-semibold">Apri la carta d&apos;imbarco (PDF)</span>
                    </a>
                ) : (
                    <img src={url} alt="Carta d'imbarco" className="max-w-full max-h-full object-contain rounded-2xl" />
                )}
            </div>

            {/* Departure info bar */}
            {leg.departure_at && (
                <div className="flex-shrink-0 px-6 py-4 bg-white/5 flex justify-between items-center text-sm">
                    <span className="text-neutral-400">Partenza</span>
                    <span className="text-white font-bold">{wallClockDayTime(leg.departure_at)}</span>
                </div>
            )}
        </div>
    );
}
