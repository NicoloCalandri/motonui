import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { AlertTriangle, CheckSquare, CloudSun, Loader2, MapPin, RefreshCw, Sparkles, Square } from 'lucide-react';
import type { Activity, PackingChecklist, TripWithDetails } from '@/lib/types';

interface PackingContextCardProps {
    checklist: PackingChecklist | null;
    stops: NonNullable<TripWithDetails['days']>;
    activities: Activity[];
}

/** Weather and stops the checklist is generated from. */
export function PackingContextCard({ checklist, stops, activities }: PackingContextCardProps) {
    return (
        <div className="card overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-sand-100">
                <div className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CloudSun className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="flex-1">
                    <h3 className="font-display font-semibold text-ink-900">Meteo & tappe</h3>
                    <p className="text-xs text-ink-400">Usati per generare la checklist</p>
                </div>
            </div>
            <div className="p-4 space-y-3">
                {checklist?.weather_snapshot && checklist.weather_snapshot.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {checklist.weather_snapshot.map((d) => (
                            <div key={d.date} className="flex-shrink-0 px-3 py-2 bg-sky-50 rounded-xl text-center min-w-[84px]">
                                <p className="text-[11px] font-semibold text-sky-700">{format(new Date(d.date), 'd MMM', { locale: it })}</p>
                                <p className="text-sm font-bold text-sky-900">{Number.isFinite(d.temp_max_c) ? `${d.temp_min_c}–${d.temp_max_c}°` : '—'}</p>
                                <p className="text-[11px] text-sky-600">{d.condition}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-ink-300">Genera la checklist per vedere il meteo previsto per il periodo del viaggio.</p>
                )}

                {stops.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold text-ink-500 mb-1.5">Tappe</p>
                        <div className="flex flex-wrap gap-1.5">
                            {stops.map((d) => (
                                <span key={d.id} className="flex items-center gap-1 px-2 py-1 bg-sand-100 rounded-lg text-xs text-ink-600">
                                    <MapPin className="w-3 h-3 text-ink-400" />
                                    {d.title || format(new Date(d.date), 'd MMM', { locale: it })}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {activities.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold text-ink-500 mb-1.5">Attività</p>
                        <div className="flex flex-wrap gap-1.5">
                            {activities.map((a) => (
                                <span key={a.id} className="px-2 py-1 bg-sand-100 rounded-lg text-xs text-ink-600">{a.name}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

interface PackingChecklistCardProps {
    checklist: PackingChecklist | null;
    stale: boolean;
    loading: boolean;
    generating: boolean;
    error: string | null;
    hasBaggage: boolean;
    onGenerate: () => void;
    onToggle: (itemId: string, checked: boolean) => void;
}

/** AI checklist with its generate button and tickable items. */
export function PackingChecklistCard({ checklist, stale, loading: loadingChecklist, generating, error: checklistError, hasBaggage, onGenerate, onToggle }: PackingChecklistCardProps) {
    return (
        <div className="card overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-sand-100">
                <div className="w-9 h-9 bg-terracotta-400 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="flex-1">
                    <h3 className="font-display font-semibold text-ink-900">Checklist</h3>
                    <p className="text-xs text-ink-400">Generata con AI da meteo, tappe e bagagli</p>
                </div>
                <button
                    onClick={onGenerate}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-terracotta-400 text-white rounded-xl text-xs font-bold hover:bg-terracotta-500 transition-colors disabled:opacity-50"
                >
                    {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {checklist ? 'Rigenera' : 'Genera'}
                </button>
            </div>

            <div className="p-4 space-y-4">
                {checklistError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        {checklistError}
                    </div>
                )}

                {stale && checklist && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-700 rounded-xl text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        I dati del viaggio sono cambiati da quando è stata generata la checklist. Rigenerala per aggiornarla.
                    </div>
                )}

                {loadingChecklist ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-ink-300 animate-spin" /></div>
                ) : checklist && checklist.categories.length > 0 ? (
                    checklist.categories.map((cat) => (
                        <div key={cat.name}>
                            <p className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5">{cat.name}</p>
                            <div className="space-y-1">
                                {cat.items.map((item) => {
                                    const checked = checklist.checked_item_ids.includes(item.id);
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => onToggle(item.id, !checked)}
                                            className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-sand-50 text-left transition-colors"
                                        >
                                            {checked ? (
                                                <CheckSquare className="w-4 h-4 text-terracotta-400 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <Square className="w-4 h-4 text-ink-300 flex-shrink-0 mt-0.5" />
                                            )}
                                            <span className={`text-sm ${checked ? 'text-ink-300 line-through' : 'text-ink-700'}`}>
                                                {item.label}{item.qty > 1 ? ` ×${item.qty}` : ''}
                                                {item.note && <span className="block text-xs text-ink-400">{item.note}</span>}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-ink-300 text-center py-2">
                        {!hasBaggage
                            ? 'Aggiungi almeno un bagaglio, poi genera la checklist.'
                            : 'Nessuna checklist generata ancora.'}
                    </p>
                )}
            </div>
        </div>
    );
}
