import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Activities Auth MVP",
  description: "Teacher and student auth with DB-backed sessions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
