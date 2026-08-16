// Server-side admin gate for routes that write.
//
// Every role check elsewhere in this app is client-side (Map.tsx, PlaceCard.tsx, the add and
// edit screens), which is fine for deciding what to render but is not a security boundary — the role
// comes from a fetch the client controls. Anything that mutates Notion needs the check to happen
// on the server, against the session cookie, which is what this does.

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./options";
import NotionAPIClient from "@/lib/client/notion/client";
import { UserRole } from "@/lib/constants/enums";

export type AuthResult =
    | { ok: true; email: string; role: string }
    | { ok: false; response: NextResponse };

interface CachedRole {
    role: string;
    expiresAt: number;
}

// The resolve-then-create flow checks the role twice in quick succession; this keeps that to one
// Notion round trip. Short-lived and per-instance, so a role change in Notion takes effect within
// a minute and nothing persists across cold starts.
const ROLE_CACHE_TTL_MS = 60 * 1000;
const roleCache = new Map<string, CachedRole>();

async function getRole(email: string): Promise<string> {
    const cached = roleCache.get(email);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
        return cached.role;
    }

    const role = await NotionAPIClient.getUserRole(
        process.env.AUTH_DATA_SOURCE_ID!,
        email
    );

    roleCache.set(email, {
        role: role,
        expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
    });

    return role;
}

export async function requireAdmin(): Promise<AuthResult> {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "unauthenticated" },
                { status: 401 }
            ),
        };
    }

    const email = session.user.email;

    let role: string;
    try {
        role = await getRole(email);
    } catch (e) {
        // Fail closed. If the role lookup is broken, nobody is an admin.
        console.error("Role lookup failed for %s: %s", email, e);
        return {
            ok: false,
            response: NextResponse.json(
                { error: "role_lookup_failed" },
                { status: 503 }
            ),
        };
    }

    if (role !== UserRole.ADMIN) {
        return {
            ok: false,
            response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
        };
    }

    return { ok: true, email: email, role: role };
}
