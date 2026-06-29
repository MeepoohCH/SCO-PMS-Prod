import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai, Roboto } from 'next/font/google'
import { SessionProvider } from "next-auth/react";
import "./globals.css";
import Navbar from "./components/Navbar";

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
})

const notoSansThai = Noto_Sans_Thai({
  weight: ["400", "500", "700"],
  subsets: ["thai"],
  variable: "--font-noto-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PMS — Dow Chemical (Thailand) Ltd.",
  description: "Production Management System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${roboto.variable} ${notoSansThai.variable} h-full`}>
      <body className="font-sans min-h-full flex flex-col antialiased bg-gray-50">
        <SessionProvider>
          <Navbar />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}