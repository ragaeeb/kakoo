import type { Metadata } from "next";
import { DM_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kakoo – Multi-Speaker Podcast Generator",
  description:
    "Turn a script into a real podcast. Assign voices to each speaker, select your TTS engine, and let Kakoo mix the audio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmMono.variable} ${instrumentSerif.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
