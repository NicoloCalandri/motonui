import type { Leg, Accommodation, Activity } from '@/lib/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Plane, Train, Car, Ship, PersonStanding, Bus, MapPin, Hotel, Pencil, Trash2, Ticket } from 'lucide-react';
import { hasBoardingPass } from '@/lib/boarding-pass';

const LEG_ICONS: Record<string, React.ElementType> = {
    flight: Plane, train: Train, car: Car, ferry: Ship, walk: PersonStanding, bus: Bus, other: MapPin,
};

const getLegBorderClass = (type: Leg['type']) => (type === 'flight' ? 'border-l-2 border-blue-300' : 'border-l-2 border-slate-300');

interface ItemProps {
    expanded: boolean;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

/** A leg in the itinerary timeline; click to expand the details. */
export function LegItem({ leg, expanded, onToggle, onViewBoardingPass, onEdit, onDelete }: ItemProps & { leg: Leg; onViewBoardingPass: () => void }) {
    const Icon = LEG_ICONS[leg.type] ?? MapPin;
    return (
        <div className={`card overflow-hidden group ${getLegBorderClass(leg.type)}`}>
            <div 
                className="p-3 flex items-start gap-3 cursor-pointer hover:bg-ink-50/50 transition-colors"
                onClick={onToggle}
            >
                <div className="w-8 h-8 mt-0.5 bg-ink-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-ink-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-800 truncate">
                        {leg.from_name} → {leg.to_name}
                    </p>
                    {leg.carrier && (
                        <p className="text-xs text-ink-500 truncate">{leg.carrier}</p>
                    )}
                    {leg.departure_at && (
                        <p className="text-xs text-ink-400">
                            {format(new Date(leg.departure_at), 'HH:mm')}
                            {leg.arrival_at && ` → ${format(new Date(leg.arrival_at), 'HH:mm')}`}
                        </p>
                    )}
                </div>
                {leg.cost && (
                    <span className="text-xs text-ink-500 whitespace-nowrap mt-1">
                        {leg.currency} {leg.cost}
                    </span>
                )}
                <div className="flex gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    {leg.type === 'flight' && hasBoardingPass(leg) && (
                        <button
                            aria-label="Vedi carta d'imbarco"
                            onClick={(e) => { e.stopPropagation(); onViewBoardingPass(); }}
                            className="p-1.5 rounded-lg text-ink-400 hover:text-terracotta-400 hover:bg-terracotta-50 transition-colors"
                        >
                            <Ticket className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        aria-label="Modifica spostamento"
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="p-1.5 rounded-lg text-ink-400 hover:text-terracotta-400 hover:bg-terracotta-50 transition-colors"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                        aria-label="Elimina spostamento"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            
            {expanded && (
                <div className="px-12 pb-4 pt-1 text-sm text-ink-600 bg-ink-50/30 border-t border-ink-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400">Da</span>
                            <span className="font-medium">{leg.from_name}</span>
                            {leg.departure_at && <span className="block text-xs">{format(new Date(leg.departure_at), 'd MMM HH:mm', { locale: it })}</span>}
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400">A</span>
                            <span className="font-medium">{leg.to_name}</span>
                            {leg.arrival_at && <span className="block text-xs">{format(new Date(leg.arrival_at), 'd MMM HH:mm', { locale: it })}</span>}
                        </div>
                    </div>
                    
                    {(leg.carrier || leg.booking_ref || leg.duration_min) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
                            {leg.carrier && (
                                <div><span className="text-[10px] font-bold uppercase text-ink-400">Operatore:</span> <span className="font-medium">{leg.carrier}</span></div>
                            )}
                            {leg.booking_ref && (
                                <div><span className="text-[10px] font-bold uppercase text-ink-400">Ref:</span> <span className="font-medium">{leg.booking_ref}</span></div>
                            )}
                            {leg.duration_min && (
                                <div><span className="text-[10px] font-bold uppercase text-ink-400">Durata:</span> <span className="font-medium">{Math.floor(leg.duration_min / 60)}h {leg.duration_min % 60}m</span></div>
                            )}
                        </div>
                    )}
                    
                    {leg.notes && (
                        <div className="pt-2 border-t border-ink-100 mt-2">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Note</span>
                            <p className="whitespace-pre-wrap">{leg.notes}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** An accommodation in the itinerary timeline. */
export function AccommodationItem({ accommodation: acc, expanded, onToggle, onEdit, onDelete }: ItemProps & { accommodation: Accommodation }) {
    return (
        <div className="card overflow-hidden border-l-2 border-emerald-300 group">
            <div 
                className="p-3 flex items-start gap-3 cursor-pointer hover:bg-sage-50/30 transition-colors"
                onClick={onToggle}
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
                            <span className="font-medium">{acc.check_in ? format(new Date(acc.check_in), 'd MMM yyyy', { locale: it }) : '-'}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400">Check-out</span>
                            <span className="font-medium">{acc.check_out ? format(new Date(acc.check_out), 'd MMM yyyy', { locale: it }) : '-'}</span>
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

/** An activity in the itinerary timeline. */
export function ActivityItem({ activity, expanded, onToggle, onEdit, onDelete }: ItemProps & { activity: Activity }) {
    return (
        <div className="card overflow-hidden border-l-2 border-violet-300 group">
            <div
                className="p-3 flex items-start gap-3 cursor-pointer hover:bg-violet-50/30 transition-colors"
                onClick={onToggle}
            >
                <div className="w-8 h-8 mt-0.5 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Ticket className="w-4 h-4 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-800 truncate">{activity.name}</p>
                    <p className="text-xs text-ink-500 capitalize">{activity.type}</p>
                    {(activity.date || activity.time) && (
                        <p className="text-xs text-ink-400">
                            {activity.date ? format(new Date(activity.date), 'd MMM', { locale: it }) : ''}
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
