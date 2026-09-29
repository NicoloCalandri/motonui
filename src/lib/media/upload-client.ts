import { createClient } from '@/lib/supabase/client';
import { TRIP_MEDIA_BUCKET } from '@/lib/trip-files';
import type { MediaWithUrls } from '@/lib/types';

/**
 * Browser side of the upload pipeline (T-2.2):
 * 1. ask the API for a signed upload to the trip's incoming folder
 * 2. upload the file straight to Supabase Storage (no route body limit)
 * 3. confirm, so the server strips metadata and creates the thumbnail
 */

const GENERIC_ERROR = 'Ops! Non riusciamo a caricare le foto. Riprova tra poco 🏝️';

export class MediaUploadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MediaUploadError';
    }
}

async function errorMessage(response: Response): Promise<string> {
    try {
        const body: unknown = await response.json();
        if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error;
    } catch {
        // Not JSON: fall back to the generic message.
    }
    return GENERIC_ERROR;
}

async function postJson(url: string, body: unknown): Promise<Response> {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function uploadTripMedia(
    tripId: string,
    file: File,
    options: { dayId?: string | null; caption?: string | null } = {},
): Promise<MediaWithUrls> {
    const targetResponse = await postJson(`/api/trips/${tripId}/media/uploads`, { mime_type: file.type, size: file.size });
    if (!targetResponse.ok) throw new MediaUploadError(await errorMessage(targetResponse));
    const { path, token } = (await targetResponse.json()) as { path: string; token: string };

    const { error } = await createClient()
        .storage.from(TRIP_MEDIA_BUCKET)
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
    if (error) throw new MediaUploadError(GENERIC_ERROR);

    const confirmResponse = await postJson(`/api/trips/${tripId}/media/confirm`, {
        path,
        day_id: options.dayId ?? null,
        caption: options.caption ?? null,
    });
    if (!confirmResponse.ok) throw new MediaUploadError(await errorMessage(confirmResponse));
    return (await confirmResponse.json()) as MediaWithUrls;
}
