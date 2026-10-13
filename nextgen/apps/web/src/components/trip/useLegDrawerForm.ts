import { useState, useEffect, type BaseSyntheticEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Leg } from '@motonui/shared-types';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api-client';
import { hasBoardingPass } from '../../lib/boarding-pass';
import { dayItemPath } from '../../lib/form-payload';
import type { FlightSegment } from './LegFlightSegments';

const defaultSegment = (): FlightSegment => ({ from_name: '', to_name: '' });

const Schema = z.object({
    type: z.enum(['flight', 'train', 'car', 'ferry', 'walk', 'bus', 'other']),
    from_name: z.string().min(1, 'Origine richiesta').max(200),
    to_name: z.string().min(1, 'Destinazione richiesta').max(200),
    departure_date: z.string().optional(),
    departure_time: z.string().optional(),
    arrival_date: z.string().optional(),
    arrival_time: z.string().optional(),
    cost: z.coerce.number().optional().nullable(),
    currency: z.string().default('EUR'),
    carrier: z.string().optional().nullable(),
    booking_ref: z.string().optional().nullable(),
    pnr: z.string().optional().nullable(),
    checkin_opens_at: z.string().optional().nullable(),
});

export type LegFormValues = z.infer<typeof Schema>;

interface UseLegDrawerFormArgs {
    tripId: string;
    dayId?: string | null;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    dayDate?: string;
    initialData?: Leg;
}

/**
 * All non-JSX state/logic for `LegDrawer`: the react-hook-form instance,
 * the reset-on-open effect, multi-segment/boarding-pass/geocoded-coordinate
 * state, and the `onSubmit` mutation handler (single leg + multi-segment
 * flight branches, `apiFetch` + `try`/`catch`/`finally`). Extracted out of
 * LegDrawer.tsx (src/components/trip/LegDrawer.tsx originally 648 lines,
 * still 493 after an earlier split into LegFlightSegments/BoardingPassField/
 * CurrencyCostField) into its own hook, alongside the sibling
 * `LegLocationFields.tsx`/`LegDetailsFields.tsx` JSX extractions, so that
 * LegDrawer.tsx itself — which after those splits was still over
 * docs/CLAUDE.md's 300-line-per-file limit — stays under it. Logic is a
 * verbatim port/move of the old component's `useForm` setup, reset
 * `useEffect`, and `onSubmit`; nothing behavioral changed by this move.
 */
export function useLegDrawerForm({ tripId, dayId, open, onClose, onSaved, dayDate, initialData }: UseLegDrawerFormArgs) {
    const { session } = useAuth();
    const token = session?.access_token;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditing = !!initialData;

    // Multi-segment state (flight only)
    const [segments, setSegments] = useState<FlightSegment[]>([defaultSegment()]);

    // Boarding pass state (upload/remove handled by BoardingPassField)
    const [boardingPassUploaded, setBoardingPassUploaded] = useState(false);

    // Coordinates selected via geocoding (optional — map won't show if missing)
    const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(null);
    // Separate state used as `initialValue` for LocationSearch so it resets when drawer opens
    const [fromInitial, setFromInitial] = useState('');
    const [toInitial, setToInitial] = useState('');

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<LegFormValues>({
        resolver: zodResolver(Schema),
        defaultValues: {
            type: 'flight',
            currency: 'EUR',
        },
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                reset({
                    type: initialData.type,
                    from_name: initialData.from_name,
                    to_name: initialData.to_name,
                    departure_date: initialData.departure_at ? initialData.departure_at.slice(0, 10) : (dayDate ?? undefined),
                    departure_time: initialData.departure_at ? initialData.departure_at.slice(11, 16) : undefined,
                    arrival_date: initialData.arrival_at ? initialData.arrival_at.slice(0, 10) : (dayDate ?? undefined),
                    arrival_time: initialData.arrival_at ? initialData.arrival_at.slice(11, 16) : undefined,
                    cost: initialData.cost ?? undefined,
                    currency: initialData.currency,
                    carrier: initialData.carrier ?? undefined,
                    booking_ref: initialData.booking_ref ?? undefined,
                    pnr: initialData.pnr ?? undefined,
                    checkin_opens_at: initialData.checkin_opens_at
                        ? initialData.checkin_opens_at.slice(0, 16)
                        : undefined,
                });
                setBoardingPassUploaded(hasBoardingPass(initialData));
                setFromInitial(initialData.from_name);
                setToInitial(initialData.to_name);
                setFromCoords(
                    initialData.from_lat != null && initialData.from_lng != null
                        ? { lat: initialData.from_lat, lng: initialData.from_lng }
                        : null
                );
                setToCoords(
                    initialData.to_lat != null && initialData.to_lng != null
                        ? { lat: initialData.to_lat, lng: initialData.to_lng }
                        : null
                );
                // Editing: single segment pre-filled
                setSegments([{ from_name: initialData.from_name, to_name: initialData.to_name }]);
            } else {
                reset({ type: 'flight', currency: 'EUR', departure_date: dayDate ?? undefined, arrival_date: dayDate ?? undefined });
                setFromInitial('');
                setToInitial('');
                setFromCoords(null);
                setToCoords(null);
                setBoardingPassUploaded(false);
                setSegments([defaultSegment()]);
            }
        }
    }, [open, initialData, dayDate, reset]);

    const selectedType = watch('type');

    const onSubmit = async (values: LegFormValues, event?: BaseSyntheticEvent) => {
        setSaving(true);
        setError(null);

        const nativeEvent = event?.nativeEvent as SubmitEvent | undefined;
        const submitter = nativeEvent?.submitter as HTMLButtonElement | null;
        const submitMode = submitter?.getAttribute('data-submit-mode') === 'add-another' ? 'add-another' : 'save';

        try {
            const depDate = values.departure_date ?? dayDate ?? initialData?.departure_at?.slice(0, 10);
            const arrDate = values.arrival_date ?? dayDate ?? initialData?.arrival_at?.slice(0, 10);
            const departure_at = (depDate && values.departure_time) ? `${depDate}T${values.departure_time}:00` : null;
            const arrival_at = (arrDate && values.arrival_time) ? `${arrDate}T${values.arrival_time}:00` : null;
            const checkin_opens_at = values.checkin_opens_at ? `${values.checkin_opens_at}:00` : null;

            // ── Multi-segment flight ──────────────────────────────────────────
            if (values.type === 'flight' && !isEditing && segments.length > 1) {
                const validSegments = segments.filter(s => s.from_name && s.to_name);
                if (validSegments.length < 2) {
                    setError('Compila almeno due tratte per un volo con scalo');
                    setSaving(false);
                    return;
                }

                const url = dayId
                    ? `/api/trips/${tripId}/days/${dayId}/legs`
                    : `/api/trips/${tripId}/legs`;

                await apiFetch(url, {
                    method: 'POST',
                    body: JSON.stringify({
                        ...values,
                        departure_at,
                        arrival_at,
                        checkin_opens_at,
                        segments: validSegments.map(s => ({
                            from_name: s.from_name,
                            to_name: s.to_name,
                            from_lat: s.from_lat ?? null,
                            from_lng: s.from_lng ?? null,
                            to_lat: s.to_lat ?? null,
                            to_lng: s.to_lng ?? null,
                        })),
                    }),
                }, token);
            } else {
                // ── Single leg (non-flight or editing or single segment) ─────
                const firstSeg = segments[0];
                const from_name = (values.type === 'flight' && firstSeg?.from_name) ? firstSeg.from_name : values.from_name;
                const to_name = (values.type === 'flight' && firstSeg?.to_name) ? firstSeg.to_name : values.to_name;

                const payload: Record<string, unknown> = {
                    ...values,
                    from_name,
                    to_name,
                    departure_at,
                    arrival_at,
                    checkin_opens_at,
                    from_lat: fromCoords?.lat ?? null,
                    from_lng: fromCoords?.lng ?? null,
                    to_lat: toCoords?.lat ?? null,
                    to_lng: toCoords?.lng ?? null,
                };

                // Opened from a list without days (bookings): the leg's own day, or the day-less route.
                const url = dayItemPath(tripId, 'legs', dayId ?? initialData?.day_id, initialData?.id);

                await apiFetch(url, { method: isEditing ? 'PUT' : 'POST', body: JSON.stringify(payload) }, token);
            }

            onSaved();

            if (isEditing || submitMode === 'save') {
                reset();
                onClose();
                return;
            }

            reset({ type: values.type, currency: values.currency || 'EUR', departure_date: dayDate ?? undefined, arrival_date: dayDate ?? undefined });
            setFromInitial('');
            setToInitial('');
            setFromCoords(null);
            setToCoords(null);
            setBoardingPassUploaded(false);
            setSegments([defaultSegment()]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ops! Qualcosa è andato storto 🏝️');
        } finally {
            setSaving(false);
        }
    };

    return {
        register, handleSubmit, watch, setValue, errors,
        saving, error, isEditing, selectedType,
        segments, setSegments,
        boardingPassUploaded, setBoardingPassUploaded,
        fromCoords, setFromCoords, toCoords, setToCoords,
        fromInitial, toInitial,
        onSubmit,
    };
}
