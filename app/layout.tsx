import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Geofence Polygon Builder",
  description: "Internal geofence polygon builder foundation"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
