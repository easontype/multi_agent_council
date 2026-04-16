import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Providers } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Council — AI Peer Review",
  description: "Multi-agent AI peer review committee for academic papers",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
