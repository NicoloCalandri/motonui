import { describe, expect, it } from 'vitest';
import { webBuildProblem } from './web-build-check';

describe('webBuildProblem', () => {
    const present = () => true;

    it('is silent in development, where Vite serves the web app', () => {
        expect(webBuildProblem({ NODE_ENV: 'development' }, present)).toBeNull();
        expect(webBuildProblem({}, present)).toBeNull();
    });

    it('is silent in production with a build in place', () => {
        expect(webBuildProblem({ NODE_ENV: 'production', WEB_DIST: '/app/apps/web/dist' }, present)).toBeNull();
    });

    it.each([undefined, ''])('flags production without WEB_DIST (%j), as a blank line in --env-file leaves it', (value) => {
        expect(webBuildProblem({ NODE_ENV: 'production', WEB_DIST: value }, present)).toMatch(/WEB_DIST is not set/);
    });

    it('flags production when the folder has no index.html', () => {
        expect(webBuildProblem({ NODE_ENV: 'production', WEB_DIST: '/nowhere' }, () => false)).toMatch(/no index\.html/);
    });
});
