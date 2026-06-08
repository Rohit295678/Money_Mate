import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "MoneyMate -- Your Personal Finance Hub",
  description: "Track expenses, split bills, save smarter, and crush debt",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gray-50 text-gray-900 antialiased" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
