import type NodeCache from 'node-cache';

export async function register() {

    // hack: NextJS "global" variables are short-lived, so we're creating a global cache here
    // that will be available throughout the lifetime of the server
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const NodeCache = (await import('node-cache')).default;
        const config: NodeCache.Options = {
            stdTTL: process.env.NODE_ENV === 'production' ? 0 : 60 * 60 * 24 * 7, // 1 week
        };

        global.placesCache = new NodeCache(config);
    }
}