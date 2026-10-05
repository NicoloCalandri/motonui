import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useDialogA11y } from './use-dialog-a11y';

function Dialog({ onClose }: { onClose: () => void }) {
    const ref = useDialogA11y<HTMLDivElement>(true, onClose);
    return (
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="t" tabIndex={-1}>
            <h2 id="t">Nuovo giorno</h2>
            <button type="button">Primo</button>
            <button type="button">Ultimo</button>
        </div>
    );
}

function Page() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>Apri</button>
            {open && <Dialog onClose={() => setOpen(false)} />}
        </>
    );
}

describe('useDialogA11y', () => {
    it('focuses the first control and keeps Tab inside the dialog', async () => {
        const user = userEvent.setup();
        render(<Dialog onClose={vi.fn()} />);

        expect(screen.getByText('Primo')).toHaveFocus();
        await user.tab();
        expect(screen.getByText('Ultimo')).toHaveFocus();
        await user.tab();
        expect(screen.getByText('Primo')).toHaveFocus();
        await user.tab({ shift: true });
        expect(screen.getByText('Ultimo')).toHaveFocus();
    });

    it('closes on Escape and gives focus back to the opener', async () => {
        const user = userEvent.setup();
        render(<Page />);

        await user.click(screen.getByText('Apri'));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByText('Apri')).toHaveFocus();
    });
});
