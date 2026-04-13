import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Council — AI Peer Review",
  description: "Multi-agent AI peer review committee for academic papers",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          :root {
            --bg-primary: #0f0f0f;
            --bg-secondary: #1a1a1a;
            --bg-card: #1e1e1e;
            --bg-elevated: #252525;
            --text-primary: #f0f0f0;
            --text-secondary: #a0a0a0;
            --text-muted: #606060;
            --accent: #6366f1;
            --accent-hover: #4f52d4;
            --accent-dim: rgba(99, 102, 241, 0.15);
            --border: #2a2a2a;
            --border-accent: rgba(99, 102, 241, 0.4);
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
            background: var(--bg-elevated);
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
      <body>{children}</body>
    </html>
  );
}
