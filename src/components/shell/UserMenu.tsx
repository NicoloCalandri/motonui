'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { LogOut, User } from 'lucide-react';

interface UserMenuProps {
    userName: string | null;
    userEmail: string | null;
    avatarUrl: string | null;
    onSignOut: () => void;
}

/** Critically damped: the menu grows out of the avatar and goes back the same way. */
const SPRING = { type: 'spring', bounce: 0, duration: 0.3 } as const;

/**
 * Avatar button and its menu. Opens from the avatar (transform-origin top right),
 * closes with Escape (focus back on the avatar) or a click outside.
 */
export default function UserMenu({ userName, userEmail, avatarUrl, onSignOut }: UserMenuProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) return;
        function onPointerDown(e: PointerEvent) {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key !== 'Escape') return;
            setOpen(false);
            buttonRef.current?.focus();
        }
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const initial = userName?.[0]?.toUpperCase() ?? '';

    return (
        <div className="relative" ref={rootRef}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={userName ? `Menu di ${userName}` : 'Menu utente'}
                aria-expanded={open}
                aria-controls={menuId}
                className="pressable w-11 h-11 rounded-pill bg-surface border border-separator overflow-hidden flex items-center justify-center type-body font-semibold text-ink"
            >
                {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initial}
            </button>

            <MotionConfig reducedMotion="user">
                <AnimatePresence>
                    {open && (
                        <motion.div
                            id={menuId}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={SPRING}
                            style={{ transformOrigin: 'top right' }}
                            className="absolute right-0 mt-2 w-60 bg-surface rounded-control shadow-panel border border-separator py-2 z-50"
                        >
                            <div className="px-4 py-2 border-b border-separator">
                                <p className="type-footnote font-semibold text-ink truncate">{userName}</p>
                                <p className="text-xs text-ink-muted truncate">{userEmail}</p>
                            </div>
                            <Link
                                href="/profile"
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-2 px-4 min-h-11 type-body text-ink hover:bg-canvas transition-colors"
                            >
                                <User className="w-4 h-4" aria-hidden="true" />
                                Profilo
                            </Link>
                            <button
                                type="button"
                                onClick={() => { setOpen(false); onSignOut(); }}
                                className="w-full flex items-center gap-2 px-4 min-h-11 type-body text-red-700 hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="w-4 h-4" aria-hidden="true" />
                                Esci
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </MotionConfig>
        </div>
    );
}
