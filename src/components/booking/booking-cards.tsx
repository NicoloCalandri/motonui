import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
    Plane, Hotel, Utensils, Bus, Train, Car, Ship,
    Pencil, Trash2, MapPin, Clock, Users, QrCode, PersonStanding,
} from 'lucide-react';
import type { Leg, Accommodation, Restaurant, Activity } from '@/lib/types';

const LEG_ICONS: Record<string, React.ElementType> = {
    flight: Plane, train: Train, car: Car, ferry: Ship, walk: PersonStanding, bus: Bus, other: MapPin,
};

const ACTIVITY_EMOJIS: Record<string, string> = {
    museum: '🏛️', tour: '🚶', excursion: '🥾', show: '🎭', sport: '⛷️', other: '📍',
};
export function EmptyState({ text, children }: { text: string; children?: React.ReactNode }) {
    return (
        <div className="p-4 text-center text-ink-300 text-sm">
            <p>{text}</p>
            {children}
        </div>
    );
}

export function FlightCard({ leg, onEdit, onDelete }: { leg: Leg; onEdit: () => void; onDelete: () => void }) {
    return (
        <div className="p-4 flex items-center gap-3 group">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Plane className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-800 truncate">
                    {leg.from_name?.split(',')[0]} → {leg.to_name?.split(',')[0]}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    {leg.carrier && <span className="text-xs text-ink-500">{leg.carrier}</span>}
                    {leg.departure_at && (
                        <span className="text-xs text-ink-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(leg.departure_at), 'd MMM · HH:mm', { locale: it })}
                        </span>
                    )}
                </div>
            </div>
            {(leg.pnr || leg.booking_ref) && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg flex-shrink-0">
                    <QrCode className="w-3 h-3 text-blue-400" />
                    <span className="text-xs font-mono font-bold text-blue-600 tracking-wider">
                        {leg.pnr ?? leg.booking_ref}
                    </span>
                </div>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                <button onClick={onEdit} aria-label="Modifica" className="p-1.5 rounded-lg text-ink-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={onDelete} aria-label="Elimina" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

export function AccommodationCard({ accommodation: acc, onEdit, onDelete }: { accommodation: Accommodation; onEdit: () => void; onDelete: () => void }) {
    return (
        <div className="p-4 flex items-center gap-3 group">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Hotel className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-800 truncate">{acc.name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    {acc.address && <span className="text-xs text-ink-400 truncate">{acc.address}</span>}
                    {acc.check_in && acc.check_out && (
                        <span className="text-xs text-ink-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(acc.check_in), 'd MMM', { locale: it })} – {format(new Date(acc.check_out), 'd MMM', { locale: it })}
                        </span>
                    )}
                </div>
            </div>
            {acc.booking_ref && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-lg flex-shrink-0">
                    <QrCode className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs font-mono font-bold text-emerald-600">{acc.booking_ref}</span>
                </div>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                <button onClick={onEdit} aria-label="Modifica" className="p-1.5 rounded-lg text-ink-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={onDelete} aria-label="Elimina" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

export function RestaurantCard({ restaurant: rest, onEdit, onDelete }: { restaurant: Restaurant; onEdit: () => void; onDelete: () => void }) {
    return (
        <div className="p-4 flex items-center gap-3 group">
            <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Utensils className="w-4 h-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-800 truncate">{rest.name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    {rest.cuisine_type && <span className="text-xs text-ink-500">{rest.cuisine_type}</span>}
                    {rest.date && (
                        <span className="text-xs text-ink-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(rest.date), 'd MMM', { locale: it })}
                            {rest.time && ` · ${rest.time}`}
                        </span>
                    )}
                    {rest.covers && (
                        <span className="text-xs text-ink-400 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {rest.covers}
                        </span>
                    )}
                </div>
            </div>
            {rest.booking_ref && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-lg flex-shrink-0">
                    <QrCode className="w-3 h-3 text-orange-400" />
                    <span className="text-xs font-mono font-bold text-orange-600">{rest.booking_ref}</span>
                </div>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={onEdit} aria-label="Modifica" className="p-1.5 rounded-lg text-ink-400 hover:text-orange-500 hover:bg-orange-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={onDelete} aria-label="Elimina" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

export function ActivityCard({ activity: act, onEdit, onDelete }: { activity: Activity; onEdit: () => void; onDelete: () => void }) {
    const emoji = ACTIVITY_EMOJIS[act.type] ?? '📍';
    return (
        <div className="p-4 flex items-center gap-3 group">
            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0 text-base">
                {emoji}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-800 truncate">{act.name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    {act.date && (
                        <span className="text-xs text-ink-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(act.date), 'd MMM', { locale: it })}
                            {act.time && ` · ${act.time}`}
                        </span>
                    )}
                    {act.duration_min && (
                        <span className="text-xs text-ink-400">{act.duration_min} min</span>
                    )}
                    {act.address && (
                        <span className="text-xs text-ink-400 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3" /> {act.address}
                        </span>
                    )}
                </div>
            </div>
            {act.booking_ref && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 rounded-lg flex-shrink-0">
                    <QrCode className="w-3 h-3 text-purple-400" />
                    <span className="text-xs font-mono font-bold text-purple-600">{act.booking_ref}</span>
                </div>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={onEdit} aria-label="Modifica" className="p-1.5 rounded-lg text-ink-400 hover:text-purple-500 hover:bg-purple-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={onDelete} aria-label="Elimina" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

export function TransportCard({ leg, onEdit, onDelete }: { leg: Leg; onEdit: () => void; onDelete: () => void }) {
    const Icon = LEG_ICONS[leg.type] ?? MapPin;
    return (
        <div className="p-4 flex items-center gap-3 group">
            <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-800 truncate">
                    {leg.from_name?.split(',')[0]} → {leg.to_name?.split(',')[0]}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    {leg.carrier && <span className="text-xs text-ink-500">{leg.carrier}</span>}
                    {leg.departure_at && (
                        <span className="text-xs text-ink-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(leg.departure_at), 'd MMM · HH:mm', { locale: it })}
                        </span>
                    )}
                </div>
            </div>
            {leg.booking_ref && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg flex-shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-600">{leg.booking_ref}</span>
                </div>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                <button onClick={onEdit} aria-label="Modifica" className="p-1.5 rounded-lg text-ink-400 hover:text-slate-500 hover:bg-slate-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={onDelete} aria-label="Elimina" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
