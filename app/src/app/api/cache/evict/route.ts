import VercelKVCache from "@/lib/cache/vercel-kv";

export const dynamic = 'force-dynamic';

export async function POST() {
    VercelKVCache.evictCache();
    return Response.json({ message: "Cache evicted" });
}