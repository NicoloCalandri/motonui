import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Hotel, Pencil, Trash2 } from 'lucide-react';
import type { Accommodation } from '@motonui/shared-types';
import { calendarDate } from '../../lib/calendar-date';

interface ItineraryAccommodationCardProps {
    acc: Accommodation;
    expanded: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

/**
 * A single "alloggio" (accommodation) card within ItineraryTab's day
 * timeline — collapsed summary row + expandable detail panel. Extracted out
 * of ItineraryTab.tsx's "Accommodations" `.map(...)` JSX block
 * (src/components/trip/ItineraryTab.tsx, ~70 lines) into its own file to
 * keep ItineraryTab.tsx under docs/CLAUDE.md's 300-line-per-file rule — the
 * old 491-line ItineraryTab.tsx was not split at all. Logic/markup is a
 * verbatim port of that block; the `expandedItemId === acc.id` /
 * `setActiveDay`/`setEditingAcc`/`setAccDrawerOpen`/`deleteAcc` calls (which
 * need ItineraryTab's state) became the four callback props.
 */
export default function ItineraryAccommodationCard({ acc, expanded, onToggleExpand, onEdit, onDelete }: ItineraryAccommodationCardProps) {
    return (
        <div className="card overflow-hidden border-l-2 border-emerald-300 group">
            <div
                className="p-3 flex items-start gap-3 cursor-pointer hover:bg-sage-50/30 transition-colors"
                onClick={onToggleExpand}
            >
                <div className="w-8 h-8 mt-0.5 bg-sage-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Hotel className="w-4 h-4 text-sage-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-800 truncate">{acc.name}</p>
                    {acc.address && <p className="text-xs text-ink-400 truncate">{acc.address}</p>}
                </div>
                {acc.cost && (
                    <span className="text-xs text-ink-500 whitespace-nowrap mt-1">
                        {acc.currency} {acc.cost}
                    </span>
                )}
                <div className="flex gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button
                        aria-label="Modifica alloggio"
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="p-1.5 rounded-lg text-ink-400 hover:text-terracotta-400 hover:bg-terracotta-50 transition-colors"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                        aria-label="Elimina alloggio"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="px-12 pb-4 pt-1 text-sm text-ink-600 bg-sage-50/20 border-t border-sage-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400">Check-in</span>
                            <span className="font-medium">{acc.check_in ? format(calendarDate(acc.check_in), 'd MMM yyyy', { locale: it }) : '-'}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400">Check-out</span>
                            <span className="font-medium">{acc.check_out ? format(calendarDate(acc.check_out), 'd MMM yyyy', { locale: it }) : '-'}</span>
                        </div>
                    </div>

                    {(acc.address || acc.booking_ref) && (
                        <div className="flex flex-col gap-1 pt-2">
                            {acc.address && (
                                <div><span className="text-[10px] font-bold uppercase text-ink-400 mr-2">Indirizzo:</span><span className="font-medium">{acc.address}</span></div>
                            )}
                            {acc.booking_ref && (
                                <div><span className="text-[10px] font-bold uppercase text-ink-400 mr-2">Ref Prenotazione:</span><span className="font-medium">{acc.booking_ref}</span></div>
                            )}
                        </div>
                    )}

                    {acc.notes && (
                        <div className="pt-2 border-t border-sage-100 mt-2">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Note</span>
                            <p className="whitespace-pre-wrap">{acc.notes}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
