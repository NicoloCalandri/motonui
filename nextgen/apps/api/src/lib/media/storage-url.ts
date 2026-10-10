import { env } from '../env';

const STORAGE_OBJECT_PATH = '/storage/v1/object/';

/**
 * True if `url` points to an object of this project's own Supabase Storage.
 *
 * `media.url` is a database column a client can write: the server must not
 * download whatever it contains (SR-INPUT-07). The origin has to match
 * SUPABASE_URL exactly (plain http only if SUPABASE_URL itself is http, as
 * in local development) and the normalized path has to stay under the
 * storage object API.
 */
export function isOwnStorageUrl(url: string, supabaseUrl: string = env.SUPABASE_URL): boolean {
    let target: URL;
    let own: URL;
    try {
        target = new URL(url);
        own = new URL(supabaseUrl);
    } catch {
        return false;
    }
    if (target.username || target.password) return false;
    // URL() has already resolved "../": the check is on the path actually requested.
    return target.origin === own.origin && target.pathname.startsWith(STORAGE_OBJECT_PATH);
}
