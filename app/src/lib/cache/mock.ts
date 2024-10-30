export default class VercelKVCache {
    constructor() {}

    static async get(_key: string): Promise<any | null> {
        return null;
    }

    static async set(_key: string, _value: any) {
        // Do nothing
    }
}