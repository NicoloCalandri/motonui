'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusables(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('inert'));
}

/**
 * Keyboard behaviour of a modal drawer or dialog (T-3.9): focus moves inside
 * when it opens, Tab and Shift+Tab stay inside, Escape closes, and focus goes
 * back to the element that opened it. Pair it with role="dialog",
 * aria-modal="true" and aria-labelledby on the panel.
 */
export function useDialogA11y<T extends HTMLElement>(open: boolean, onClose: () => void): RefObject<T | null> {
    const ref = useRef<T | null>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!open) return;
        const container = ref.current;
        if (!container) return;
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const first = focusables(container)[0];
        (first ?? container).focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (event.key !== 'Tab') return;
            const items = focusables(container);
            if (items.length === 0) {
                event.preventDefault();
                return;
            }
            const firstItem = items[0];
            const lastItem = items[items.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && (active === firstItem || !container.contains(active))) {
                event.preventDefault();
                lastItem.focus();
            } else if (!event.shiftKey && (active === lastItem || !container.contains(active))) {
                event.preventDefault();
                firstItem.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            opener?.focus();
        };
    }, [open]);

    return ref;
}
