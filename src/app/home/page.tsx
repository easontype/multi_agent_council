"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

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
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      className={cn("transition-transform duration-200", open ? "rotate-180" : "rotate-0")}
    >
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
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={disabled ? "#ccc" : "#fff"}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
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
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-border overflow-hidden transition-[width,min-width] duration-200 ease-in-out shrink-0",
        collapsed ? "w-0 min-w-0" : "w-[260px] min-w-[260px]"
      )}
    >
      {/* Logo + collapse */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <a
          href="/"
          className="text-[17px] font-extrabold text-[#6366f1] no-underline tracking-tight whitespace-nowrap"
        >
          Council
        </a>
        <button
          onClick={onToggle}
          className="bg-transparent border-none cursor-pointer text-muted-foreground p-1.5 rounded-md flex hover:text-foreground transition-colors"
          title="Collapse sidebar"
        >
          <MenuIcon />
        </button>
      </div>

      {/* New Review button */}
      <div className="px-3 pt-2 pb-4 shrink-0">
        <button
          onClick={() => router.push("/analyze")}
          className="w-full h-9 flex items-center gap-2 bg-background border border-border rounded-lg text-[13px] font-semibold text-foreground cursor-pointer px-3 whitespace-nowrap transition-[border-color,color] duration-150 hover:border-[#6366f1] hover:text-[#6366f1]"
        >
          <PlusIcon /> New Review
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {loading ? (
          <div className="py-5 px-2 text-[12px] text-muted-foreground text-center">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="py-5 px-2 text-[12px] text-muted-foreground text-center">No reviews yet</div>
        ) : (
          sessions.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase px-2 pt-2 pb-1">
                {group.label}
              </div>
              {group.items.map((s) => {
                const isActive = s.id === activeId;
                const dot = STATUS_DOT[s.status] ?? "#bbb";
                return (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/results/${s.id}`)}
                    className={cn(
                      "w-full flex items-center gap-2 border-none rounded-md py-[7px] px-2 cursor-pointer text-left transition-colors duration-[120ms]",
                      isActive ? "bg-muted" : "bg-transparent hover:bg-muted/60"
                    )}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: dot }}
                    />
                    <span className="text-[13px] text-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1">
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
      <div className="border-t border-border px-4 py-3 shrink-0 flex flex-col gap-0.5">
        <SidebarLink href="/keys" label="API Keys" />
        <SidebarLink href="#" label="Sign out" onClick={() => { void signOut({ redirectTo: "/login" }); }} />
      </div>
    </aside>
  );
}

function SidebarLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <a
      href={href}
      onClick={onClick ? (e) => { e.preventDefault(); onClick(); } : undefined}
      className="text-[13px] text-muted-foreground no-underline py-[5px] block transition-colors duration-[120ms] hover:text-foreground"
    >
      {label}
    </a>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────
function MainArea({ user }: { user: { name: string; image?: string } }) {
  const router = useRouter();
  const [arxivId, setArxivId] = useState("");
  const [mode, setMode] = useState<"critique" | "gap">("critique");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0];

  return (
    <main className="flex-1 h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="h-14 flex items-center justify-end px-5 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] text-muted-foreground">{user.name}</span>
          <div className="w-8 h-8 rounded-full bg-[#6366f1] flex items-center justify-center text-[13px] font-bold text-white cursor-pointer shrink-0 overflow-hidden">
            {user.image
              ? <img src={user.image} className="w-8 h-8 rounded-full" alt="" />
              : firstName[0].toUpperCase()
            }
          </div>
        </div>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {/* Greeting */}
        <h1 className="text-[30px] font-bold text-foreground tracking-tight mb-2 text-center">
          {greeting}, {firstName}.
        </h1>
        <p className="text-[15px] text-muted-foreground mb-10 text-center">
          Which paper would you like reviewed today?
        </p>

        {/* Input area */}
        <div className="w-full max-w-[640px]">
          <form onSubmit={handleSubmit}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "relative rounded-2xl transition-[border-color,background] duration-150 p-1 pl-5 flex items-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.06)]",
                dragging
                  ? "bg-indigo-50 border-[1.5px] border-[#6366f1]"
                  : "bg-muted border-[1.5px] border-border"
              )}
            >
              <input
                ref={inputRef}
                type="text"
                value={arxivId}
                onChange={(e) => setArxivId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Paste an arXiv ID, e.g. 1706.03762"
                className="flex-1 bg-transparent border-none outline-none text-[15px] text-foreground py-3 min-w-0 placeholder:text-muted-foreground"
              />

              {/* Upload button */}
              <button
                type="button"
                onClick={() => router.push(`/analyze?mode=${mode}`)}
                title="Upload PDF"
                className="bg-transparent border-none cursor-pointer text-muted-foreground p-2 rounded-lg flex transition-colors duration-150 hover:text-[#6366f1]"
              >
                <UploadIcon />
              </button>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!arxivId.trim()}
                className={cn(
                  "w-9 h-9 border-none rounded-[10px] flex items-center justify-center shrink-0 transition-colors duration-150",
                  arxivId.trim()
                    ? "bg-[#6366f1] cursor-pointer"
                    : "bg-muted cursor-not-allowed"
                )}
              >
                <SendIcon disabled={!arxivId.trim()} />
              </button>
            </div>
          </form>

          {/* Mode chips */}
          <div className="flex gap-2 mt-3.5 justify-center">
            {(["critique", "gap"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full px-3.5 py-[5px] text-[12px] font-semibold cursor-pointer transition-all duration-150 tracking-[0.01em]",
                  mode === m
                    ? "bg-indigo-50 border border-indigo-200 text-indigo-700"
                    : "bg-transparent border border-border text-muted-foreground"
                )}
              >
                {m === "critique" ? "Full Critique" : "Gap Analysis"}
              </button>
            ))}
            <button
              onClick={() => router.push("/analyze")}
              className="bg-transparent border border-border text-muted-foreground rounded-full px-3.5 py-[5px] text-[12px] font-semibold cursor-pointer transition-all duration-150 hover:border-[#6366f1] hover:text-[#6366f1]"
            >
              Advanced options →
            </button>
          </div>

          {/* Drag hint */}
          {dragging && (
            <div className="text-center mt-3 text-[13px] text-[#6366f1] font-semibold">
              Drop PDF to upload
            </div>
          )}
        </div>

        {/* Feature hints */}
        <div className="flex gap-5 mt-[52px] flex-wrap justify-center">
          {[
            { label: "5 reviewers", desc: "Methods · Literature · Replication · Contribution · Advocate" },
            { label: "Live debate", desc: "Watch reviewers argue in real time with source citations" },
            { label: "Structured verdict", desc: "Consensus, dissent, action items, confidence score" },
          ].map((f) => (
            <div key={f.label} className="text-center max-w-[160px]">
              <div className="text-[13px] font-semibold text-foreground mb-[3px]">{f.label}</div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</div>
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
    <div className="flex h-screen overflow-hidden font-sans">
      {/* Collapsed sidebar toggle */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="fixed left-3 top-3.5 z-[200] bg-muted border border-border rounded-lg cursor-pointer p-2 text-muted-foreground flex shadow-[0_1px_4px_rgba(0,0,0,0.08)] hover:text-foreground transition-colors"
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
