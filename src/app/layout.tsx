import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FIBER — Natural Fiber Clothing",
    template: "%s | FIBER",
  },
  description:
    "Discover clothing made from natural fibers. No polyester, no nylon, no compromise. Browse curated brands that put natural materials first.",
  openGraph: {
    title: "FIBER — Natural Fiber Clothing",
    description:
      "Discover clothing made from natural fibers. No polyester, no nylon, no compromise.",
    url: "https://fiber.clothing",
    siteName: "FIBER",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FIBER — Natural Fiber Clothing",
    description:
      "Discover clothing made from natural fibers. No polyester, no nylon, no compromise.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${dmSans.variable} antialiased`}
      >
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
