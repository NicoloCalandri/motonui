import axe from 'axe-core';

/**
 * Runs axe on a rendered container (T-3.9) and returns the serious and
 * critical violations as readable strings, so a failing test names them.
 * color-contrast is off: jsdom does not compute styles.
 */
export async function seriousA11yViolations(container: Element): Promise<string[]> {
    const results = await axe.run(container, {
        rules: { 'color-contrast': { enabled: false } },
        resultTypes: ['violations'],
    });
    return results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}
