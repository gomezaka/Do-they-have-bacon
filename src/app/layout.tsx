import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Do They Have Bacon?",
  description: "A global hotel breakfast bacon tracker."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
