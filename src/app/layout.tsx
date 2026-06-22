import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DjX — Music for the AI era",
  description: "A modern web UI for exploring and controlling your Spotify.",
  applicationName: "DjX",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DjX",
  },
  // Icons come from the file conventions src/app/icon.png and
  // src/app/apple-icon.png. Next emits content-hashed URLs (e.g.
  // /icon.png?<hash>) so updated artwork busts the browser/CDN cache
  // automatically — a static metadata.icons path would serve stale bytes.
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorker />
        <Analytics />
      </body>
    </html>
  );
}
