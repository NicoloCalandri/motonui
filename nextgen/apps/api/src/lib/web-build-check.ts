import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What is wrong with the web build configuration of a production process,
 * or null. Without a build the process still answers the API (and its health
 * check), but every page is a JSON 404: a blank site behind a green probe.
 * The usual cause is a blank `WEB_DIST=` line in the env file given to
 * `docker run --env-file`, which overrides the value set by the image.
 */
export function webBuildProblem(
    env: { NODE_ENV?: string; WEB_DIST?: string },
    exists: (path: string) => boolean = existsSync,
): string | null {
    if (env.NODE_ENV !== 'production') return null;
    if (!env.WEB_DIST) {
        return 'WEB_DIST is not set: only the API is served, every page answers 404. The image sets it; remove any WEB_DIST line (even a blank one) from the env file.';
    }
    if (!exists(join(env.WEB_DIST, 'index.html'))) {
        return 'WEB_DIST has no index.html: only the API is served, every page answers 404. Check that the web app is built and mounted.';
    }
    return null;
}
