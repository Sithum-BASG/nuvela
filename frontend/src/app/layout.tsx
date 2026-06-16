import type { Metadata } from "next";
import { Sora, Roboto } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Sora = display/headings, Roboto = UI/body (Design Brief typography)
const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-sora",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Nuvela",
  description: "A calm, multi-tenant workspace for planning projects and moving work across a board.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sora.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
            <Toaster />
          </ThemeProvider>
      </body>
    </html>
  );
}
