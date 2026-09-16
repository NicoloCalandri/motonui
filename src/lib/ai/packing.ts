import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import type { BaggageItem, DailyWeather, PackingCategoryGroup } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

const BAGGAGE_LABELS: Record<string, string> = {
    cabin_bag: 'zaino/borsa da cabina',
    cabin_trolley: 'trolley da cabina',
    checked: 'bagaglio in stiva',
    other: 'altro bagaglio',
};

export interface PackingStop {
    name: string;
    date?: string | null;
}

export interface PackingActivity {
    name: string;
    type: string;
    date?: string | null;
}

export interface GeneratePackingChecklistInput {
    destination: string;
    startDate: string | null;
    endDate: string | null;
    weather: DailyWeather[];
    stops: PackingStop[];
    activities: PackingActivity[];
    baggage: BaggageItem[];
}

/**
 * Generates a categorized clothing/gear packing checklist from trip weather,
 * itinerary stops/activities and baggage constraints. Same JSON-prompt +
 * regex-fallback pattern as `generateBriefing` in `src/lib/ai/destination.ts`.
 */
export async function generatePackingChecklist(input: GeneratePackingChecklistInput): Promise<PackingCategoryGroup[]> {
    const prompt = buildPrompt(input);

    const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1536,
        messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';

    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as { categories: { name: string; items: { label: string; qty: number; note?: string }[] }[] };
            return assignIds(parsed.categories ?? []);
        }
    } catch {
        /* fallback below */
    }

    return [];
}

function buildPrompt(input: GeneratePackingChecklistInput): string {
    const { destination, startDate, endDate, weather, stops, activities, baggage } = input;

    const weatherLines = weather.length > 0
        ? weather.map((d) => `- ${d.date}: ${Number.isFinite(d.temp_min_c) ? `${d.temp_min_c}–${d.temp_max_c}°C` : 'temperatura n/d'}, ${d.condition}, probabilità pioggia ${d.precipitation_probability}%`).join('\n')
        : 'Non disponibile.';

    const stopLines = stops.length > 0
        ? stops.map((s) => `- ${s.name}${s.date ? ` (${s.date})` : ''}`).join('\n')
        : 'Nessuna tappa registrata.';

    const activityLines = activities.length > 0
        ? activities.map((a) => `- ${a.name} [${a.type}]${a.date ? ` (${a.date})` : ''}`).join('\n')
        : 'Nessuna attività registrata.';

    const baggageLines = baggage.length > 0
        ? baggage.map((b) => {
            const dims = b.length_cm && b.width_cm && b.height_cm ? `${b.length_cm}×${b.width_cm}×${b.height_cm}cm` : 'misure non specificate';
            const weight = b.weight_kg ? `, max ${b.weight_kg}kg` : '';
            return `- ${b.label || BAGGAGE_LABELS[b.category] || b.category}: ${dims}${weight}`;
        }).join('\n')
        : 'Nessun bagaglio registrato: suggerisci una lista compatta per un solo bagaglio a mano.';

    return `Sei un assistente di viaggio. Crea una checklist di abbigliamento ed effetti personali da mettere in valigia per questo viaggio.

Destinazione: ${destination}
Periodo: ${startDate ?? '?'} – ${endDate ?? '?'}

Meteo previsto/tipico per il periodo:
${weatherLines}

Tappe del viaggio:
${stopLines}

Attività in programma:
${activityLines}

Bagagli disponibili (rispetta lo spazio, non suggerire più di quanto ci stia):
${baggageLines}

Rispondi SOLO con JSON valido in questo formato:
{"categories": [{"name": "Abbigliamento", "items": [{"label": "...", "qty": 3, "note": "..."}]}]}

Regole:
- Quantità adeguate ai giorni di viaggio e al meteo (es. più maglie leggere se caldo, strati se freddo/variabile).
- Includi categorie come Abbigliamento, Scarpe, Accessori, Documenti/elettronica, Igiene, se pertinenti.
- Aggiungi capi specifici per le attività elencate (es. costume per il mare, scarponcini per trekking, abito elegante per cene).
- Se il bagaglio è piccolo, privilegia capi comprimibili/versatili e segnalalo nelle note.
- Massimo 6 categorie, massimo 8 elementi per categoria.`;
}

/**
 * Deterministic fingerprint of the inputs that should trigger a checklist
 * regeneration (trip dates, baggage set, activity/stop counts). Used to show
 * a "the trip changed, regenerate" banner without auto-spending an AI call.
 */
export function computePackingInputHash(input: {
    startDate: string | null;
    endDate: string | null;
    baggage: BaggageItem[];
    activityCount: number;
    stopCount: number;
}): string {
    const fingerprint = JSON.stringify({
        startDate: input.startDate,
        endDate: input.endDate,
        baggage: input.baggage
            .map((b) => [b.id, b.category, b.length_cm, b.width_cm, b.height_cm, b.weight_kg])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        activityCount: input.activityCount,
        stopCount: input.stopCount,
    });
    return createHash('sha1').update(fingerprint).digest('hex');
}

function assignIds(categories: { name: string; items: { label: string; qty: number; note?: string }[] }[]): PackingCategoryGroup[] {
    return categories.map((cat, catIdx) => ({
        name: cat.name,
        items: (cat.items ?? []).map((item, itemIdx) => ({
            id: `${catIdx}-${itemIdx}`,
            category: cat.name,
            label: item.label,
            qty: item.qty ?? 1,
            note: item.note,
        })),
    }));
}
