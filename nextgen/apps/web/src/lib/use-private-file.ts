import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';

type PrivateFile = { url: string | null; loading: boolean; failed: boolean };

/**
 * Reads a private file from the API (documents, boarding passes) and gives
 * back an object URL for it. The Next.js app points `<img src>` at the same
 * proxy route and the session cookie authenticates the request; here the
 * session is a bearer token, which an `<img>` cannot send, so the file is
 * fetched and shown from memory. The object URL is released when the path
 * changes or the component unmounts.
 *
 * A path that is not an API route (the legacy public URL of an old boarding
 * pass) is returned as it is.
 */
export function usePrivateFile(path: string | null): PrivateFile {
    const { session } = useAuth();
    const token = session?.access_token;
    const viaApi = Boolean(path?.startsWith('/api/'));
    const [state, setState] = useState<PrivateFile>({ url: null, loading: viaApi, failed: false });

    useEffect(() => {
        if (!path || !viaApi) {
            setState({ url: path, loading: false, failed: false });
            return;
        }

        let objectUrl: string | null = null;
        let cancelled = false;
        setState({ url: null, loading: true, failed: false });

        fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
            .then(async (res) => {
                if (!res.ok) throw new Error(`status ${res.status}`);
                const blob = await res.blob();
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setState({ url: objectUrl, loading: false, failed: false });
            })
            .catch(() => {
                if (!cancelled) setState({ url: null, loading: false, failed: true });
            });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [path, viaApi, token]);

    return state;
}
