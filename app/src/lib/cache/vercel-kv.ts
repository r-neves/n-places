import { kv } from "@vercel/kv";

const cacheTTL = 60 * 60 * 24 * 7; // 1 week

// NextJS does not support global variables, so we have to use an external cache to store the data
export default class VercelKVCache {
    constructor() {}

    static async get(key: string): Promise<any | null> {
        const value: string | null = await kv.get(key);
        if (value === null) {
            return null;
        }

        return value;
    }

    static async set(key: string, value: any) {
        await kv.set(key, value, {ex: cacheTTL});
    }

    static async evictCache() {
        await kv.flushall();
    }
}