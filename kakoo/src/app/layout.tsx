import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
