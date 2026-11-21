import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "GameFive",
  description: "GameFive: One Last Chance. Seven days of ARAM Mayhem, Fri Dec 25 to Thu Dec 31.",
  icons: {
    icon: "/gamefive-logo.svg"
  }
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-black text-stone-100 antialiased">{children}</body>
    </html>
  );
}
