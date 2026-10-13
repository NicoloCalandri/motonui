import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Leg } from '@motonui/shared-types';
import BoardingPassViewer from './BoardingPassViewer';
import BoardingPassField from './BoardingPassField';
import ItineraryLegCard from './ItineraryLegCard';
import { seriousA11yViolations } from '../../test/axe';

/**
 * Boarding passes live in a private bucket: the page never gets a storage
 * URL. The file is read from the API with the session token and shown from
 * an object URL, which is released when the viewer closes.
 */

vi.mock('../../lib/auth-context', () => ({
    useAuth: () => ({ session: { access_token: 'token-1' }, user: { id: 'user-1' } }),
}));

const TRIP = '10000000-0000-4000-8000-00000000000a';
const DAY = '30000000-0000-4000-8000-00000000000d';
const LEG = '40000000-0000-4000-8000-00000000000e';
const ROUTE = `/api/trips/${TRIP}/days/${DAY}/legs/${LEG}/boarding-pass`;

const leg = (overrides: Partial<Leg> = {}) => ({
    id: LEG, trip_id: TRIP, day_id: DAY, type: 'flight', from_name: 'Roma, Italia', to_name: 'Santiago, Cile',
    departure_at: '2026-11-01T23:30:00+00:00', arrival_at: null, carrier: 'LATAM', pnr: 'ABC123', booking_ref: null,
    boarding_pass_path: `trips/${TRIP}/boarding-passes/${LEG}-x.png`, boarding_pass_url: null,
    ...overrides,
}) as unknown as Leg;

const fetchMock = vi.fn();
const createObjectURL = vi.fn(() => 'blob:motonui/pass-1');
const revokeObjectURL = vi.fn();

beforeEach(() => {
    fetchMock.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    fetchMock.mockResolvedValue(new Response(new Blob(['png']), { status: 200, headers: { 'content-type': 'image/png' } }));
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('BoardingPassViewer', () => {
    it('reads the file from the API with the session token and shows it from an object URL', async () => {
        render(<BoardingPassViewer leg={leg()} onClose={vi.fn()} />);

        const image = await screen.findByAltText("Carta d'imbarco");
        expect(image).toHaveAttribute('src', 'blob:motonui/pass-1');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(ROUTE);
        expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-1');
    });

    it('never puts the API route or a storage URL in the page', async () => {
        const { container } = render(<BoardingPassViewer leg={leg()} onClose={vi.fn()} />);
        await screen.findByAltText("Carta d'imbarco");

        expect(container.innerHTML).not.toContain('/api/trips/');
        expect(container.innerHTML).not.toContain('/storage/v1/');
    });

    it('releases the object URL when it closes', async () => {
        const { unmount } = render(<BoardingPassViewer leg={leg()} onClose={vi.fn()} />);
        await screen.findByAltText("Carta d'imbarco");

        unmount();

        expect(revokeObjectURL).toHaveBeenCalledWith('blob:motonui/pass-1');
    });

    it('offers a PDF as a link to open, not in a frame', async () => {
        const { container } = render(<BoardingPassViewer leg={leg({ boarding_pass_path: `trips/${TRIP}/boarding-passes/${LEG}-x.pdf` })} onClose={vi.fn()} />);

        const link = await screen.findByRole('link', { name: /apri la carta d.imbarco \(pdf\)/i });
        expect(link).toHaveAttribute('href', 'blob:motonui/pass-1');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
        expect(container.querySelector('iframe')).toBeNull();
    });

    it('says so when the file cannot be read', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Ops! Carta d’imbarco introvabile 🏝️', code: 'NOT_FOUND', status: 404 }), { status: 404 }));

        render(<BoardingPassViewer leg={leg()} onClose={vi.fn()} />);

        expect(await screen.findByRole('alert')).toHaveTextContent(/non riusciamo ad aprire la carta d.imbarco/i);
        expect(screen.queryByAltText("Carta d'imbarco")).not.toBeInTheDocument();
    });

    it('fetches nothing when the leg has no boarding pass', () => {
        render(<BoardingPassViewer leg={leg({ boarding_pass_path: null })} onClose={vi.fn()} />);

        expect(screen.getByText(/nessuna carta d.imbarco caricata/i)).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('is a modal dialog that closes with Escape, without serious axe violations', async () => {
        const onClose = vi.fn();
        const { container } = render(<BoardingPassViewer leg={leg()} onClose={onClose} />);
        await screen.findByAltText("Carta d'imbarco");

        expect(screen.getByRole('dialog', { name: /carta d.imbarco/i })).toHaveAttribute('aria-modal', 'true');
        await userEvent.setup().keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(await seriousA11yViolations(container)).toEqual([]);
    });
});

describe('ItineraryLegCard', () => {
    const card = (value: Leg) => render(<ItineraryLegCard leg={value} expanded={false} onToggleExpand={vi.fn()} onShowBoardingPass={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);

    it('offers the boarding pass of a flight stored in the private bucket', () => {
        card(leg());

        expect(screen.getByRole('button', { name: "Vedi carta d'imbarco" })).toBeInTheDocument();
    });

    it('offers nothing when there is no boarding pass', () => {
        card(leg({ boarding_pass_path: null }));

        expect(screen.queryByRole('button', { name: "Vedi carta d'imbarco" })).not.toBeInTheDocument();
    });
});

describe('BoardingPassField', () => {
    const field = (uploaded: boolean, onChange = vi.fn()) => {
        render(<BoardingPassField tripId={TRIP} dayId={DAY} legId={LEG} uploaded={uploaded} onUploadedChange={onChange} />);
        return onChange;
    };

    it('reports the upload as done from the private path the API returns', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify(leg()), { status: 200 }));
        const onChange = field(false);

        await userEvent.setup().upload(screen.getByLabelText(/carica foto o pdf/i), new File(['x'], 'pass.png', { type: 'image/png' }));

        await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(ROUTE);
        expect(init.method).toBe('POST');
        expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-1');
    });

    it('shows the message of the API when the file is refused', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Il file supera i 20 MB.', code: 'VALIDATION_ERROR', status: 400 }), { status: 400 }));
        const onChange = field(false);

        await userEvent.setup().upload(screen.getByLabelText(/carica foto o pdf/i), new File(['x'], 'pass.png', { type: 'image/png' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Il file supera i 20 MB.');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('removes the boarding pass', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
        const onChange = field(true);

        await userEvent.setup().click(screen.getByRole('button', { name: 'Rimuovi' }));

        await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
        expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].method).toBe('DELETE');
    });
});
