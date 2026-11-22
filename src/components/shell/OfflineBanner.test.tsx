import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import OfflineBanner from './OfflineBanner';

afterEach(() => vi.restoreAllMocks());

function setOnline(online: boolean) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

describe('OfflineBanner', () => {
    it('stays hidden while online', () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
        render(<OfflineBanner />);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('appears when the connection drops and goes away when it is back', () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
        render(<OfflineBanner />);

        act(() => setOnline(false));
        expect(screen.getByRole('status').textContent).toContain('Sei senza rete');

        act(() => setOnline(true));
        expect(screen.queryByRole('status')).toBeNull();
    });
});
