import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PLOT TWIST — The match is yours to call",
  description: "Verified football events become narrated fan calls and wallet-signed achievements.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
