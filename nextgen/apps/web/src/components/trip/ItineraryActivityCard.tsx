import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Ticket, Pencil, Trash2 } from 'lucide-react';
import type { Activity } from '@motonui/shared-types';
import { calendarDate } from '../../lib/calendar-date';

interface ItineraryActivityCardProps {
    activity: Activity;
    expanded: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

/**
 * A single "attività" (activity) card within ItineraryTab's day timeline —
 * collapsed summary row + expandable detail panel. Extracted out of the old
 * `src/components/trip/ItineraryTab.tsx`'s "Activities" `.map(...)` JSX
 * block (~70 lines), same pattern as ItineraryLegCard/
 * ItineraryAccommodationCard, to keep ItineraryTab.tsx under
 * docs/CLAUDE.md's 300-line-per-file rule while wiring the Activities
 * section back in (see ItineraryTab.tsx's doc comment — this section was
 * deliberately omitted in Task 4.9.2 pending `ActivityDrawer`, which Task
 * 4.9.3 now provides). Logic/markup is a verbatim port of that block; the
 * `expandedItemId === activity.id` / `setActiveDay`/`setEditingActivity`/
 * `setActivityDrawerOpen`/`deleteActivity` calls (which need ItineraryTab's
 * state) became the four callback props.
 */
export default function ItineraryActivityCard({ activity, expanded, onToggleExpand, onEdit, onDelete }: ItineraryActivityCardProps) {
    return (
        <div className="card overflow-hidden border-l-2 border-violet-300 group">
            <div
                className="p-3 flex items-start gap-3 cursor-pointer hover:bg-violet-50/30 transition-colors"
                onClick={onToggleExpand}
            >
                <div className="w-8 h-8 mt-0.5 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Ticket className="w-4 h-4 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-800 truncate">{activity.name}</p>
                    <p className="text-xs text-ink-500 capitalize">{activity.type}</p>
                    {(activity.date || activity.time) && (
                        <p className="text-xs text-ink-400">
                            {activity.date ? format(calendarDate(activity.date), 'd MMM', { locale: it }) : ''}
                            {activity.time ? `${activity.date ? ' · ' : ''}${activity.time}` : ''}
                        </p>
                    )}
                </div>
                {activity.cost && (
                    <span className="text-xs text-ink-500 whitespace-nowrap mt-1">
                        {activity.currency} {activity.cost}
                    </span>
                )}
                <div className="flex gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button
                        aria-label="Modifica attività"
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="p-1.5 rounded-lg text-ink-400 hover:text-violet-500 hover:bg-violet-50 transition-colors"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                        aria-label="Elimina attività"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="px-12 pb-4 pt-1 text-sm text-ink-600 bg-violet-50/20 border-t border-violet-100 space-y-2">
                    {(activity.address || activity.booking_ref || activity.duration_min) && (
                        <div className="flex flex-col gap-1 pt-2">
                            {activity.address && (
                                <div><span className="text-[10px] font-bold uppercase text-ink-400 mr-2">Luogo:</span><span className="font-medium">{activity.address}</span></div>
                            )}
                            {activity.booking_ref && (
                                <div><span className="text-[10px] font-bold uppercase text-ink-400 mr-2">Ref Prenotazione:</span><span className="font-medium">{activity.booking_ref}</span></div>
                            )}
                            {activity.duration_min && (
                                <div><span className="text-[10px] font-bold uppercase text-ink-400 mr-2">Durata:</span><span className="font-medium">{activity.duration_min} min</span></div>
                            )}
                        </div>
                    )}

                    {activity.notes && (
                        <div className="pt-2 border-t border-violet-100 mt-2">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Note</span>
                            <p className="whitespace-pre-wrap">{activity.notes}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
