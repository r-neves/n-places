import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import SessionProvider from "@/components/SessionProvider";

const APP_NAME = "N Places";
const APP_DEFAULT_TITLE = "N Places";
const APP_TITLE_TEMPLATE = "%s - PWA App";
const APP_DESCRIPTION = "See your saved places on the map!";

export const metadata: Metadata = {
    applicationName: APP_NAME,
    title: {
        default: APP_DEFAULT_TITLE,
        template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: APP_DEFAULT_TITLE,
        startupImage: {
            url: "/512px_map_logo_1.jpeg",
        },
    },
    formatDetection: {
        telephone: false,
    },
    openGraph: {
        type: "website",
        siteName: APP_NAME,
        title: {
            default: APP_DEFAULT_TITLE,
            template: APP_TITLE_TEMPLATE,
        },
        description: APP_DESCRIPTION,
    },
    twitter: {
        card: "summary",
        title: {
            default: APP_DEFAULT_TITLE,
            template: APP_TITLE_TEMPLATE,
        },
        description: APP_DESCRIPTION,
    },
};

export const viewport: Viewport = {
    themeColor: "transparent",
    initialScale: 1,
    viewportFit: "cover",
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link
                    rel="stylesheet"
                    href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css"
                />
            </head>
            <body className={inter.className}>
                <SessionProvider>
                    {children}
                    <Analytics />
                    <SpeedInsights />
                </SessionProvider>
            </body>
        </html>
    );
}
