import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstagramGenerator from './InstagramGenerator';
import type { MediaWithUrls } from '@/lib/types';

const TRIP = 'trip-1';

function photo(id: string, overrides: Partial<MediaWithUrls> = {}): MediaWithUrls {
    return {
        id, created_at: '', updated_at: '', trip_id: TRIP, day_id: null, uploaded_by: 'u', url: null, thumbnail_url: null,
        storage_path: `trips/${TRIP}/original/${id}.webp`, thumb_path: null, width: null, height: null, size: null,
        mime_type: 'image/webp', caption: null, tags: [], taken_at: null, gps_lat: null, gps_lng: null, camera: null,
        sort_order: 0, signed_url: null, signed_thumb_url: `https://signed/${id}`, ...overrides,
    };
}

describe('InstagramGenerator', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => vi.unstubAllGlobals());

    it('previews the slides and leaves out videos', () => {
        render(<InstagramGenerator tripId={TRIP} media={[photo('a'), photo('v', { mime_type: 'video/mp4' }), photo('b')]} onClose={() => {}} />);

        expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual(['Slide 1', 'Slide 2']);
        expect(screen.getByText(/1 elemento escluso/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Crea ZIP \(2 foto\)/ })).toBeEnabled();
    });

    it('starts the export, polls until ready and shows the download link', async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'exp-1', status: 'processing' }), { status: 202 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'exp-1', status: 'ready', download_url: 'https://signed/zip', caption: null, hashtags: [], error: null, expires_at: null })));

        render(<InstagramGenerator tripId={TRIP} media={[photo('b'), photo('a')]} onClose={() => {}} />);
        await userEvent.type(screen.getByLabelText(/Testo sulle foto/), 'Rapa Nui');
        await userEvent.click(screen.getByRole('button', { name: /Crea ZIP/ }));

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`/api/trips/${TRIP}/instagram/exports`);
        expect(JSON.parse(init.body)).toEqual({
            mediaIds: ['b', 'a'], format: 'carousel', filter: 'none', textOverlay: { text: 'Rapa Nui' }, generateCaption: false,
        });

        const link = await screen.findByRole('link', { name: /Scarica lo ZIP/ });
        expect(link).toHaveAttribute('href', 'https://signed/zip');
        expect(fetchMock).toHaveBeenLastCalledWith(`/api/trips/${TRIP}/instagram/exports/exp-1`);
    });

    it('shows the server error when the export cannot start', async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Un export è già in corso' }), { status: 429 }));

        render(<InstagramGenerator tripId={TRIP} media={[photo('a')]} onClose={() => {}} />);
        await userEvent.click(screen.getByRole('button', { name: /Crea ZIP/ }));

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Un export è già in corso'));
    });
});
