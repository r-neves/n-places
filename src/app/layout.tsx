import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Notion Places",
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
			</head>
			<body className={inter.className}>{children}</body>
		</html>
	);
}
