import type { UseFormRegister } from 'react-hook-form';
import type { FormInput } from './leg-form';

interface LegScheduleFieldsProps {
    register: UseFormRegister<FormInput>;
    departureDate?: string;
    tripStartDate?: string | null;
    tripEndDate?: string | null;
}

/** Departure, arrival and cost inputs of the leg form. */
export default function LegScheduleFields({ register, departureDate, tripStartDate, tripEndDate }: LegScheduleFieldsProps) {
    return (
        <>
        <div className="space-y-4">
            <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Partenza</label>
                <div className="grid grid-cols-2 gap-3">
                    <input
                        {...register('departure_date')}
                        aria-label="Data di partenza"
                        type="date"
                        min={tripStartDate || undefined}
                        max={tripEndDate || undefined}
                        className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                    />
                    <input
                        {...register('departure_time')}
                        aria-label="Ora di partenza"
                        type="time"
                        className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                    />
                </div>
            </div>
            <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Arrivo</label>
                <div className="grid grid-cols-2 gap-3">
                    <input
                        {...register('arrival_date')}
                        aria-label="Data di arrivo"
                        type="date"
                        min={departureDate || tripStartDate || undefined}
                        max={tripEndDate || undefined}
                        className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                    />
                    <input
                        {...register('arrival_time')}
                        aria-label="Ora di arrivo"
                        type="time"
                        className="w-full px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold"
                    />
                </div>
            </div>
        </div>

        <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">Costo stimato</label>
            <div className="flex gap-3">
                <select
                    {...register('currency')}
                    aria-label="Valuta"
                    className="px-4 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-sm w-28 flex-shrink-0"
                >
                    <option value="EUR">EUR €</option>
                    <option value="USD">USD $</option>
                    <option value="GBP">GBP £</option>
                    <option value="BRL">BRL R$</option>
                    <option value="JPY">JPY ¥</option>
                    <option value="CHF">CHF</option>
                    <option value="AUD">AUD</option>
                    <option value="CAD">CAD</option>
                    <option value="THB">THB ฿</option>
                    <option value="MXN">MXN</option>
                </select>
                <input
                    {...register('cost')}
                    aria-label="Costo stimato"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="flex-1 px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                />
            </div>
        </div>
        </>
    );
}
