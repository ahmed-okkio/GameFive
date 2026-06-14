import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "GameFive",
  description: "Cessation of Operations",
  icons: {
    icon: "/companion-icon.ico"
  }
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-black text-stone-100 antialiased">
        <main>{children}</main>
      </body>
    </html>
  );
}
