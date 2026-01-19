import { app } from '../../index.js';

/**
 * Utility to extract all routes from an Express app
 */
function getRoutes(app) {
    const routes = [];

    function split(thing) {
        if (typeof thing === 'string') {
            return thing.split('/');
        } else if (thing.fast_slash) {
            return '';
        } else {
            var match = thing.toString()
                .replace('\\/?', '')
                .replace('(?=\\/|$)', '$')
                .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^\\\/^$]*)*)\$\//);
            return match
                ? match[1].replace(/\\(.)/g, '$1').split('/')
                : '<complex:' + thing.toString() + '>';
        }
    }

    function processStack(stack, prefix = '') {
        stack.forEach(layer => {
            if (layer.route) {
                const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
                const path = prefix + layer.route.path;
                routes.push({ path, methods });
            } else if (layer.name === 'router' && layer.handle.stack) {
                const newPrefix = prefix + split(layer.regexp).filter(s => !!s).map(s => '/' + s).join('');
                processStack(layer.handle.stack, newPrefix);
            }
        });
    }

    processStack(app._router.stack);
    return routes;
}

describe('Route Discovery', () => {
    test('should list all registered routes', () => {
        const discoveredRoutes = getRoutes(app);
        console.log('--- Discovered Routes ---');
        console.table(discoveredRoutes);
        expect(discoveredRoutes.length).toBeGreaterThan(0);

        // Check for some expected routes
        const paths = discoveredRoutes.map(r => r.path);
        expect(paths).toContain('/health');
        expect(paths).toContain('/');
    });
});

export { getRoutes };
