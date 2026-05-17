"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUiLocale } from "@/lib/i18n/ui-locale-context";
import { StatsGrid } from "./_components/StatsGrid";
import { RecentReviews } from "./_components/RecentReviews";
import { PaperInputBox } from "./_components/PaperInputBox";

interface SessionItem {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const t = useUiLocale();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [greeting, setGreeting] = useState("");
  const [upgradedBanner, setUpgradedBanner] = useState(false);

  const firstName = (session?.user?.name || session?.user?.email || "Researcher").split(" ")[0];
  const todayCount = sessions.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).length;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0, 0, 0, 0);
  const weekCount = sessions.filter(s => new Date(s.created_at) >= weekStart).length;
  const concludedCount = sessions.filter(s => s.status === "concluded").length;

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? t.home_greeting : h < 17 ? t.home_greeting : t.home_greeting);
  }, [t.home_greeting]);

  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      setUpgradedBanner(true);
      router.replace('/home');
      const timer = setTimeout(() => setUpgradedBanner(false), 7000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetch("/api/sessions")
      .then(r => r.json())
      .then((data: SessionItem[]) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

  const stats = [
    { label: t.home_stat_total, value: loadingSessions ? "—" : String(sessions.length), sub: t.home_stat_all_time },
    { label: t.home_stat_this_week, value: loadingSessions ? "—" : `${weekCount} / 10`, sub: t.home_stat_weekly_limit },
    { label: t.home_stat_concluded, value: loadingSessions ? "—" : String(concludedCount), sub: t.home_stat_completed },
  ];

  return (
    <div style={{
      padding: "40px 48px 60px", maxWidth: 820, margin: "0 auto",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {upgradedBanner && (
        <div style={{
          marginBottom: 24, padding: '14px 18px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'bubble-in 300ms ease both',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {t.home_upgrade_banner}
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 800, color: "#1a1a1a",
          letterSpacing: "-0.04em", marginBottom: 4,
          fontFamily: "'Georgia', 'Times New Roman', serif",
        }}>
          {t.home_greeting}, {firstName}.
        </h1>
        <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>
          {loadingSessions
            ? t.common_loading
            : todayCount > 0
            ? `${todayCount} ${t.home_sessions_today}`
            : t.home_no_sessions}
        </p>
      </div>

      <PaperInputBox />
      <StatsGrid stats={stats} />

      <RecentReviews
        sessions={sessions}
        loadingSessions={loadingSessions}
        onSessionClick={s => router.push(`/review/${encodeURIComponent(s.id)}`)}
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bubble-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
