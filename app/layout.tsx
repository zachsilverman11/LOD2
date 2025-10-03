import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Conversion Dashboard",
  description: "Mortgage lead conversion system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
