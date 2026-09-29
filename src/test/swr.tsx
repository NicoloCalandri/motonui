import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

/** Fresh SWR cache per render, so tests do not see each other's data. */
export function SWRTestProvider({ children }: { children: ReactNode }) {
    return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}
