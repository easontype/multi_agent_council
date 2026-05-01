"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

function LanguageSelector({ collapsed }: { collapsed: boolean }) {
  const [lang, setLang] = useState('en')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(data => {
      if (data?.preferredLanguage) setLang(data.preferredLanguage)
    }).catch(() => {})
  }, [])

  const handleChange = async (next: string) => {
    setLang(next)
    setSaving(true)
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredLanguage: next }),
    }).catch(() => {})
    setSaving(false)
  }

  if (collapsed) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <select
        value={lang}
        onChange={e => handleChange(e.target.value)}
        disabled={saving}
        style={{
          flex: 1,
          fontSize: 11,
          color: '#888',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
        }}
      >
        {LANGUAGES.map(l => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>
    </div>
  )
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function ReviewsIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

function KeyIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

const NAV = [
  { href: "/home", label: "Dashboard", Icon: DashboardIcon },
  { href: "/home/reviews", label: "Reviews", Icon: ReviewsIcon },
  { href: "/keys", label: "API Keys", Icon: KeyIcon },
];

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  const user = {
    name: session?.user?.name || session?.user?.email || "Researcher",
    email: session?.user?.email || "",
    image: session?.user?.image || null,
    initials: (session?.user?.name || session?.user?.email || "R")[0].toUpperCase(),
  };

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      background: "#fff",
    }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 56 : 220,
        minWidth: collapsed ? 56 : 220,
        height: "100vh",
        background: "#fafafa",
        borderRight: "1px solid #f0f0f2",
        display: "flex", flexDirection: "column",
        transition: "width 200ms ease, min-width 200ms ease",
        flexShrink: 0, overflow: "hidden",
      }}>
        {/* Brand */}
        <div style={{
          height: 54, display: "flex", alignItems: "center",
          padding: collapsed ? "0 16px" : "0 16px",
          borderBottom: "1px solid #f0f0f2", flexShrink: 0,
          justifyContent: collapsed ? "center" : "space-between",
        }}>
          {!collapsed && (
            <a href="/home" style={{
              fontSize: 15, fontWeight: 800, color: "#6366f1",
              textDecoration: "none", letterSpacing: "-0.03em",
            }}>Council</a>
          )}
          <button onClick={() => setCollapsed(c => !c)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#bbb", padding: 4, borderRadius: 5,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 150ms",
          }}
            onMouseEnter={e => { e.currentTarget.style.color = "#555" }}
            onMouseLeave={e => { e.currentTarget.style.color = "#bbb" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>

        {/* New Review button */}
        <div style={{ padding: collapsed ? "12px 10px" : "12px 10px", flexShrink: 0 }}>
          <button onClick={() => router.push("/analyze?new=1")} style={{
            width: "100%", height: 34,
            display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start",
            gap: 7, background: "#111", color: "#fff",
            border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600,
            cursor: "pointer", padding: collapsed ? "0" : "0 12px",
            transition: "background 150ms",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#333" }}
            onMouseLeave={e => { e.currentTarget.style.background = "#111" }}
          >
            <PlusIcon />
            {!collapsed && "New Review"}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "4px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
          {NAV.map(({ href, label, Icon }) => {
            const isActive = href === "/home"
              ? pathname === "/home"
              : pathname.startsWith(href);
            return (
              <a key={href} href={href} style={{
                display: "flex", alignItems: "center",
                gap: 9, padding: collapsed ? "8px 10px" : "7px 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 7, textDecoration: "none",
                background: isActive ? "#f0f0f2" : "transparent",
                color: isActive ? "#1a1a1a" : "#888",
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                transition: "background 120ms, color 120ms",
              }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "#f5f5f7"; e.currentTarget.style.color = "#444" } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#888" } }}
                title={collapsed ? label : undefined}
              >
                <Icon active={isActive} />
                {!collapsed && label}
              </a>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{
          borderTop: "1px solid #f0f0f2", padding: collapsed ? "12px 10px" : "12px 12px",
          flexShrink: 0, display: "flex", flexDirection: "column", gap: 8,
        }}>
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "#1a1a1a", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden",
              }}>
                {user.image
                  ? <img src={user.image} style={{ width: 28, height: 28, borderRadius: "50%" }} alt="" />
                  : user.initials}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "#1a1a1a",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>Free plan</div>
              </div>
            </div>
          )}
          <LanguageSelector collapsed={collapsed} />
          <button onClick={() => { void signOut({ redirectTo: "/login" }) }} style={{
            width: "100%", background: "none", border: "1px solid #ebebed",
            borderRadius: 6, padding: collapsed ? "6px 0" : "6px 10px",
            fontSize: 12, color: "#999", cursor: "pointer",
            transition: "color 150ms, border-color 150ms",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = "#333"; e.currentTarget.style.borderColor = "#ccc" }}
            onMouseLeave={e => { e.currentTarget.style.color = "#999"; e.currentTarget.style.borderColor = "#ebebed" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: "auto", height: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
