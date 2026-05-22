import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Proxy Browser",
  description: "Fast web proxy for browsing sites through a single origin",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
