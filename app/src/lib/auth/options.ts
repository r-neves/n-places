import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Extracted from the [...nextauth] route so server code can pass it to getServerSession.
// Previously the config was inline in the route handler, which meant there was no way to
// verify a session on the server at all — every role check in the app was client-side only.
//
// No adapter, so next-auth uses its default JWT session strategy and session.user.email comes
// straight from the Google profile.
export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
};
