import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "Council — AI Peer Review",
  description: "Multi-agent AI peer review committee for academic papers",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  return (
    <html lang="en">
      <head>
        <style>{`
          :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f9fafb;
            --bg-card: #ffffff;
            --bg-elevated: #f3f4f6;
            --text-primary: #111827;
            --text-secondary: #4b5563;
            --text-muted: #9ca3af;
            --accent: #6366f1;
            --accent-hover: #4f52d4;
            --accent-dim: rgba(99, 102, 241, 0.10);
            --border: #e5e7eb;
            --border-accent: rgba(99, 102, 241, 0.35);
            --danger: #ef4444;
            --success: #22c55e;
            --warning: #f59e0b;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: var(--bg-primary);
            color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-height: 100vh;
            line-height: 1.6;
          }
          a { color: var(--accent); text-decoration: none; }
          a:hover { color: var(--accent-hover); text-decoration: underline; }
          button {
            cursor: pointer;
            font-family: inherit;
            transition: all 150ms ease;
          }
          input, textarea, select {
            font-family: inherit;
            background: #ffffff;
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 14px;
            outline: none;
            transition: border-color 150ms ease;
          }
          input:focus, textarea:focus, select:focus {
            border-color: var(--accent);
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        `}</style>
      </head>
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
