"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SessionItem {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface GroupedSessions {
  label: string;
  items: SessionItem[];
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function SendIcon({ disabled }: { disabled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={disabled ? "#ccc" : "#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function groupSessions(sessions: SessionItem[]): GroupedSessions[] {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const groups: Record<string, SessionItem[]> = { Today: [], Yesterday: [], "This week": [], Older: [] };
  for (const s of sessions) {
    const d = new Date(s.created_at);
    const ds = d.toDateString();
    if (ds === today) groups["Today"].push(s);
    else if (ds === yesterday) groups["Yesterday"].push(s);
    else if (d >= weekAgo) groups["This week"].push(s);
    else groups["Older"].push(s);
  }
  return Object.entries(groups).filter(([, v]) => v.length > 0).map(([label, items]) => ({ label, items }));
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

const STATUS_DOT: Record<string, string> = {
  concluded: "#22c55e",
  pending: "#f59e0b",
  running: "#6366f1",
  error: "#ef4444",
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  sessions, loading, activeId, collapsed, onToggle,
}: {
  sessions: GroupedSessions[];
  loading: boolean;
  activeId?: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();

  return (
    <aside style={{
      width: collapsed ? 0 : 260,
      minWidth: collapsed ? 0 : 260,
      height: "100vh",
      background: "#f7f7f8",
      borderRight: "1px solid #e5e5e5",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      transition: "width 200ms ease, min-width 200ms ease",
      flexShrink: 0,
    }}>
      {/* Logo + collapse */}
      <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <a href="/" style={{ fontSize: 17, fontWeight: 800, color: "#6366f1", textDecoration: "none", letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
          Council
        </a>
        <button onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: 6, borderRadius: 6, display: "flex" }}
          title="Collapse sidebar">
          <MenuIcon />
        </button>
      </div>

      {/* New Review button */}
      <div style={{ padding: "8px 12px 16px", flexShrink: 0 }}>
        <button
          onClick={() => router.push("/analyze")}
          style={{
            width: "100%", height: 36,
            display: "flex", alignItems: "center", gap: 8,
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: "#1a1a1a",
            cursor: "pointer", padding: "0 12px",
            transition: "box-shadow 150ms, border-color 150ms",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e5e5"; e.currentTarget.style.color = "#1a1a1a"; }}
        >
          <PlusIcon /> New Review
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
        {loading ? (
          <div style={{ padding: "20px 8px", color: "#ccc", fontSize: 12, textAlign: "center" }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: "20px 8px", color: "#bbb", fontSize: 12, textAlign: "center" }}>No reviews yet</div>
        ) : (
          sessions.map((group) => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", letterSpacing: "0.06em", padding: "8px 8px 4px", textTransform: "uppercase" }}>
                {group.label}
              </div>
              {group.items.map((s) => {
                const isActive = s.id === activeId;
                const dot = STATUS_DOT[s.status] ?? "#bbb";
                return (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/results/${s.id}`)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      background: isActive ? "#ebebeb" : "transparent",
                      border: "none", borderRadius: 6,
                      padding: "7px 8px", cursor: "pointer",
                      textAlign: "left",
                      transition: "background 120ms",
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#efefef"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {truncate(s.title.replace(/^Review:\s*/i, ""), 32)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer links */}
      <div style={{ borderTop: "1px solid #e5e5e5", padding: "12px 16px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <SidebarLink href="/keys" label="API Keys" />
        <SidebarLink href="#" label="Sign out" onClick={() => { void signOut({ redirectTo: "/login" }); }} />
      </div>
    </aside>
  );
}

function SidebarLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <a href={href} onClick={onClick ? (e) => { e.preventDefault(); onClick(); } : undefined}
      style={{ fontSize: 13, color: "#999", textDecoration: "none", padding: "5px 0", display: "block", transition: "color 120ms" }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "#1a1a1a"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "#999"; }}
    >{label}</a>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────
function MainArea({ user }: { user: { name: string; image?: string } }) {
  const router = useRouter();
  const [arxivId, setArxivId] = useState("");
  const [mode, setMode] = useState<"critique" | "gap">("critique");
  const [dragging, setDragging] = useState(false);
  const [greeting, setGreeting] = useState("Hello");
  const inputRef = useRef<HTMLInputElement>(null);

  // Set greeting on client side to avoid hydration mismatch
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!arxivId.trim()) return;
    router.push(`/analyze?arxiv=${encodeURIComponent(arxivId.trim())}&mode=${mode}`);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") {
      router.push(`/analyze?mode=${mode}`);
    }
  }

  const firstName = user.name.split(" ")[0];

  return (
    <main style={{
      flex: 1, height: "100vh", display: "flex", flexDirection: "column",
      background: "#fff", overflow: "hidden",
    }}>
      {/* Top bar */}
      <div style={{
        height: 56, display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "0 20px", borderBottom: "1px solid #f0f0f0", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#999" }}>{user.name}</span>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", flexShrink: 0,
          }}>
            {user.image ? <img src={user.image} style={{ width: 32, height: 32, borderRadius: "50%" }} alt="" /> : firstName[0].toUpperCase()}
          </div>
        </div>
      </div>

      {/* Center content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "0 24px 80px",
      }}>
        {/* Greeting */}
        <h1 style={{
          fontSize: 30, fontWeight: 700, color: "#1a1a1a",
          letterSpacing: "-0.03em", marginBottom: 8, textAlign: "center",
        }}>
          {greeting}, {firstName}.
        </h1>
        <p style={{ fontSize: 15, color: "#888", marginBottom: 40, textAlign: "center" }}>
          Which paper would you like reviewed today?
        </p>

        {/* Input area */}
        <div style={{ width: "100%", maxWidth: 640 }}>
          <form onSubmit={handleSubmit}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              style={{
                position: "relative",
                background: dragging ? "#eef2ff" : "#f7f7f8",
                border: `1.5px solid ${dragging ? "#6366f1" : "#e8e8e8"}`,
                borderRadius: 16,
                transition: "border-color 150ms, background 150ms",
                padding: "4px 4px 4px 20px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={arxivId}
                onChange={(e) => setArxivId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Paste an arXiv ID, e.g. 1706.03762"
                style={{
                  flex: 1, background: "transparent", border: "none",
                  outline: "none", fontSize: 15, color: "#1a1a1a",
                  padding: "12px 0", minWidth: 0,
                }}
              />

              {/* Upload button */}
              <button
                type="button"
                onClick={() => router.push(`/analyze?mode=${mode}`)}
                title="Upload PDF"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#bbb", padding: "8px", borderRadius: 8, display: "flex",
                  transition: "color 150ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#6366f1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#bbb"; }}
              >
                <UploadIcon />
              </button>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!arxivId.trim()}
                style={{
                  width: 36, height: 36,
                  background: arxivId.trim() ? "#6366f1" : "#f0f0f0",
                  border: "none", borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: arxivId.trim() ? "pointer" : "not-allowed",
                  flexShrink: 0,
                  transition: "background 150ms",
                }}
              >
                <SendIcon disabled={!arxivId.trim()} />
              </button>
            </div>
          </form>

          {/* Mode chips */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center" }}>
            {(["critique", "gap"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  background: mode === m ? "#eef2ff" : "transparent",
                  border: `1px solid ${mode === m ? "#c7d2fe" : "#e5e5e5"}`,
                  color: mode === m ? "#4f46e5" : "#888",
                  borderRadius: 20,
                  padding: "5px 14px",
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 150ms",
                  letterSpacing: "0.01em",
                }}
              >
                {m === "critique" ? "Full Critique" : "Gap Analysis"}
              </button>
            ))}
            <button
              onClick={() => router.push("/analyze")}
              style={{
                background: "transparent", border: "1px solid #e5e5e5",
                color: "#888", borderRadius: 20, padding: "5px 14px",
                fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 150ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e5e5"; e.currentTarget.style.color = "#888"; }}
            >
              Advanced options →
            </button>
          </div>

          {/* Drag hint */}
          {dragging && (
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: "#6366f1", fontWeight: 600 }}>
              Drop PDF to upload
            </div>
          )}
        </div>

        {/* Feature hints */}
        <div style={{ display: "flex", gap: 20, marginTop: 52, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { label: "5 reviewers", desc: "Methods · Literature · Replication · Contribution · Advocate" },
            { label: "Live debate", desc: "Watch reviewers argue in real time with source citations" },
            { label: "Structured verdict", desc: "Consensus, dissent, action items, confidence score" },
          ].map((f) => (
            <div key={f.label} style={{ textAlign: "center", maxWidth: 160 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 11, color: "#bbb", lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { data: session } = useSession();
  const [sessions, setSessions] = useState<GroupedSessions[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetch("/api/council")
      .then((r) => r.json())
      .then((data: SessionItem[]) => {
        setSessions(groupSessions(data ?? []));
      })
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

  const user = {
    name: session?.user?.name || session?.user?.email || "Researcher",
    image: session?.user?.image || undefined,
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflow: "hidden" }}>
      {/* Collapsed sidebar toggle */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          style={{
            position: "fixed", left: 12, top: 14, zIndex: 200,
            background: "#f7f7f8", border: "1px solid #e5e5e5",
            borderRadius: 8, cursor: "pointer", padding: 8, color: "#666",
            display: "flex", boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <MenuIcon />
        </button>
      )}

      <Sidebar
        sessions={sessions}
        loading={loadingSessions}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(true)}
      />

      <MainArea user={user} />
    </div>
  );
}
