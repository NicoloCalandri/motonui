import type { UseFormRegisterReturn } from 'react-hook-form';

interface CurrencyCostFieldProps {
    label: string;
    currencyProps: UseFormRegisterReturn;
    costProps: UseFormRegisterReturn;
}

/**
 * Shared "currency select + cost input" pair used by LegDrawer and
 * AccommodationDrawer — both old components (LegDrawer.tsx,
 * AccommodationDrawer.tsx) had byte-for-byte identical markup for this
 * block. Extracted here (new, not a 1:1 port of a single old file) purely
 * to avoid duplicating it twice and to help both drawers stay under
 * docs/CLAUDE.md's 300-line-per-file rule.
 */
export default function CurrencyCostField({ label, currencyProps, costProps }: CurrencyCostFieldProps) {
    return (
        <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3">
                {label}
            </label>
            <div className="flex gap-3">
                <select
                    {...currencyProps}
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
                    {...costProps}
                    aria-label={label}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="flex-1 px-5 py-4 rounded-2xl bg-neutral-50/80 border-none text-neutral-900 focus:ring-2 focus:ring-neutral-200 transition-all font-bold text-lg"
                />
            </div>
        </div>
    );
}
