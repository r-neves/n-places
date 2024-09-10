import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "N Places",
    description: "See your saved places on the map!",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link rel="manifest" href="/manifest.json" />
                <link
                    rel="stylesheet"
                    href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css"
                />
            </head>
            <body className={inter.className}>
                {children}
                <Analytics />
				<SpeedInsights />
            </body>
        </html>
    );
}
