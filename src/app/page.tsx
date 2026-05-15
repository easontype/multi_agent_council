"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setPendingUpload } from "@/lib/pending-upload";

function UpgradeButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false)
  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else setLoading(false)
    } catch { setLoading(false) }
  }
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? 'Redirecting…' : 'Get Pro'}
    </button>
  )
}

export default function HomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [arxivId, setArxivId] = useState("");
  const [loading, setLoading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  async function handleQuickCritique(e: React.FormEvent) {
    e.preventDefault();
    if (!arxivId.trim()) return;
    setLoading(true);
    router.push(`/home?arxiv=${encodeURIComponent(arxivId.trim())}`);
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingUpload(file);
    router.push("/home");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-[100] flex h-[60px] items-center justify-between border-b border-border bg-background/95 px-8 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold tracking-[-0.02em] text-[#6366f1]">Council</span>
          <span className="pt-0.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">BETA</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#pricing" className="text-sm font-medium text-muted-foreground no-underline hover:text-foreground transition-colors">
            Pricing
          </a>
          {session?.user ? (
            <a
              href="/home"
              className="rounded-md bg-[#111] px-[18px] py-2 text-sm font-semibold text-white no-underline hover:bg-[#333] transition-colors"
            >
              Dashboard
            </a>
          ) : (
            <>
              <a href="/login" className="text-sm font-medium text-muted-foreground no-underline hover:text-foreground transition-colors">
                Sign in
              </a>
              <a
                href="/login"
                className="rounded-md bg-[#111] px-[18px] py-2 text-sm font-semibold text-white no-underline hover:bg-[#333] transition-colors"
              >
                Get started
              </a>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-[800px] px-8 pt-24 pb-20 text-center">
        <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[#ddd] bg-[#f5f5f7] px-[14px] py-[5px] text-xs font-semibold tracking-[0.05em] text-[#555]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#999]" />
          MULTI-AGENT PEER REVIEW
        </div>

        {/* Audience chips */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {["PhD Students", "Postdocs & PIs", "Research Teams"].map((who) => (
            <span
              key={who}
              className="rounded-full border border-border bg-card px-3 py-[5px] text-[12px] font-semibold text-muted-foreground"
            >
              {who}
            </span>
          ))}
        </div>

        <h1 className="mb-6 text-[clamp(32px,5vw,54px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground">
          Get honest feedback on<br />
          <span className="text-[#6366f1]">your paper before submission</span>
        </h1>

        <p className="mx-auto mb-12 max-w-[560px] text-lg leading-[1.7] text-muted-foreground">
          Five specialized AI reviewers debate your work — methods, literature, reproducibility,
          contribution, and advocacy — then a moderator delivers a structured verdict.
        </p>

        {/* Quick input */}
        <form onSubmit={handleQuickCritique} className="mx-auto mb-3 flex max-w-[480px] gap-2">
          <Input
            type="text"
            value={arxivId}
            onChange={(e) => setArxivId(e.target.value)}
            placeholder="arXiv ID e.g. 2301.07041"
            className="h-12 flex-1 text-[15px]"
          />
          <Button
            type="submit"
            disabled={loading || !arxivId.trim()}
            className={cn(
              "h-12 whitespace-nowrap rounded-lg bg-[#111] px-6 text-[15px] font-semibold text-white hover:bg-[#333]",
              (loading || !arxivId.trim()) && "opacity-55"
            )}
          >
            {loading ? "Loading…" : "Critique Paper"}
          </Button>
        </form>

        {/* PDF upload */}
        <div className="mb-4 flex items-center justify-center gap-2 text-[13px] text-muted-foreground/70">
          <span>or</span>
          <label className="cursor-pointer font-semibold text-foreground underline-offset-2 hover:underline">
            Upload a PDF
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={handlePdfChange}
            />
          </label>
        </div>

        <p className="text-[13px] text-muted-foreground/70">
          Free — 10 reviews/week, no account required
        </p>
      </section>

      {/* Roles strip */}
      <section className="border-y border-border bg-muted px-8 py-6">
        <div className="mx-auto flex max-w-[800px] flex-wrap items-center justify-center gap-2">
          <span className="mr-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground">YOUR COMMITTEE:</span>
          {[
            { label: "Methods Critic", color: "#6366f1" },
            { label: "Literature Auditor", color: "#0ea5e9" },
            { label: "Replication Skeptic", color: "#f43f5e" },
            { label: "Contribution Evaluator", color: "#f59e0b" },
            { label: "Constructive Advocate", color: "#22c55e" },
            { label: "Moderator", color: "#374151" },
          ].map((r) => (
            <span
              key={r.label}
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: `${r.color}14`,
                border: `1px solid ${r.color}33`,
                color: r.color,
              }}
            >
              {r.label}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[800px] px-8 py-20">
        <h2 className="mb-2 text-center text-[26px] font-bold tracking-[-0.02em]">
          How it works
        </h2>
        <p className="mb-[52px] text-center text-[15px] text-muted-foreground">
          From arXiv ID to structured verdict in minutes.
        </p>
        <div className="grid gap-10 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {[
            {
              n: "1",
              title: "Ingest",
              body: "Paste an arXiv ID or upload a PDF. The paper is parsed, chunked, and embedded into the review knowledge base.",
            },
            {
              n: "2",
              title: "Debate",
              body: "Five reviewers each write a Round 1 critique independently. Divergence is measured — if high, Round 2 cross-examination runs.",
            },
            {
              n: "3",
              title: "Verdict",
              body: "A moderator synthesizes all arguments into a structured report: consensus, dissent, action items, and confidence score.",
            },
          ].map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-[#ddd] bg-[#f5f5f7] text-lg font-extrabold text-[#333]">
                {s.n}
              </div>
              <div className="mb-2 text-base font-bold">{s.title}</div>
              <div className="text-sm leading-[1.65] text-muted-foreground">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* What you get — sample verdict */}
      <section className="border-y border-border bg-muted px-8 py-20">
        <div className="mx-auto max-w-[720px]">
          <h2 className="mb-2 text-center text-[26px] font-bold tracking-[-0.02em]">
            What you get
          </h2>
          <p className="mb-12 text-center text-[15px] text-muted-foreground">
            A structured verdict from five perspectives, not a single AI opinion.
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
            {/* Mock verdict preview header */}
            <div className="flex items-center gap-3 border-b border-border bg-muted px-6 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#374151] text-white">
                <ScalesIcon />
              </div>
              <div>
                <div className="text-sm font-bold">Moderator Verdict</div>
                <div className="text-xs text-muted-foreground">Synthesized from all 5 reviewers</div>
              </div>
              <span className="ml-auto rounded bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-600">
                MEDIUM CONFIDENCE
              </span>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <VerdictRow label="Summary" text="The paper makes a genuine contribution to the field but raises concerns about reproducibility and ablation coverage that reviewers feel must be addressed before publication." />
              <VerdictRow label="Consensus" text="The core mechanism is novel and the experimental setup is largely sound. Reviewers agreed on the importance of the contribution." />
              <VerdictRow label="Key Dissent" text="The Replication Skeptic flagged missing training details and hyperparameter disclosures that would prevent independent reproduction." />
              <div>
                <div className="mb-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground">ACTION ITEMS</div>
                <div className="flex flex-col gap-1.5">
                  {[
                    "Add ablation study isolating the key architectural choice.",
                    "Publish training code and full hyperparameter configuration.",
                    "Expand related work comparison with contemporaneous methods.",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-px flex-shrink-0 text-[13px] font-bold text-[#333]">→</span>
                      <span className="text-[13px] leading-[1.5] text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Compare & Debate */}
      <section className="mx-auto max-w-[800px] px-8 py-16">
        <div className="overflow-hidden rounded-2xl border border-[#c4dcd5] bg-[#edf4f1]">
          <div className="flex flex-col gap-0 md:flex-row">
            <div className="flex flex-1 flex-col justify-center gap-4 p-8">
              <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#b0ccd3] bg-[#d9ecea] px-3 py-1 text-[11px] font-bold tracking-[0.07em] text-[#25493d]">
                NEW — ADVERSARIAL DEBATE
              </div>
              <h2 className="text-[24px] font-extrabold leading-[1.15] tracking-[-0.025em] text-[#1e1b18]">
                Compare two options with AI debate
              </h2>
              <p className="text-[14px] leading-[1.7] text-[#3d6b5f]">
                Pick any two materials, methods, or approaches — MXene vs Graphene, CRISPR vs TALENs, ResNet vs ViT.
                Specialist reviewers argue both sides simultaneously, then a moderator delivers a verdict.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Mirror Teams", "Domain Specialists", "Evidence-Based Verdict"].map((tag) => (
                  <span key={tag} className="rounded-full border border-[#b0ccd3] bg-white px-3 py-1 text-[12px] font-semibold text-[#25493d]">
                    {tag}
                  </span>
                ))}
              </div>
              <a
                href="/home"
                className="mt-2 inline-flex w-fit items-center gap-2 rounded-[10px] bg-[#25493d] px-5 py-3 text-[14px] font-bold text-white no-underline transition-colors hover:bg-[#1e3d32]"
              >
                Start a debate →
              </a>
            </div>
            <div className="hidden flex-shrink-0 items-center justify-center border-l border-[#c4dcd5] bg-[#e0efec] p-8 md:flex" style={{ minWidth: 220 }}>
              <div className="flex flex-col gap-3 text-center">
                <div className="rounded-xl border border-[#b0ccd3] bg-white p-4 shadow-sm">
                  <div className="mb-1 text-[10px] font-bold tracking-[0.07em] text-[#4a6b73]">TEAM A</div>
                  <div className="text-[15px] font-bold text-[#1e1b18]">Option A</div>
                  <div className="text-[11px] text-[#4a6b73]">2–3 specialists</div>
                </div>
                <div className="text-[13px] font-bold text-[#6b7280]">⟵ vs ⟶</div>
                <div className="rounded-xl border border-[#d3b0b6] bg-white p-4 shadow-sm">
                  <div className="mb-1 text-[10px] font-bold tracking-[0.07em] text-[#7a4c54]">TEAM B</div>
                  <div className="text-[15px] font-bold text-[#1e1b18]">Option B</div>
                  <div className="text-[11px] text-[#7a4c54]">2–3 specialists</div>
                </div>
                <div className="rounded-xl border border-[#d4d4d8] bg-white p-3 shadow-sm">
                  <div className="text-[11px] font-bold text-[#6b7280]">+ Moderator</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="mx-auto max-w-[800px] px-8 py-20">
        <h2 className="mb-12 text-center text-[26px] font-bold tracking-[-0.02em]">
          Built for researchers
        </h2>
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {[
            {
              who: "PhD Students",
              what: "Get hostile reviewer feedback before your advisor sees the draft. Find the weaknesses you missed.",
              cta: "Critique a paper",
              href: "/home",
            },
            {
              who: "Postdocs & PIs",
              what: "Pre-submission gut-check before journal submission. Identify the arguments reviewers will use to reject.",
              cta: "Start review",
              href: "/home",
            },
            {
              who: "Research Teams",
              what: "Run large-scale literature gap analysis, related work audits, and adversarial debate across multiple papers.",
              cta: "Start reviewing",
              href: "/home",
            },
          ].map((u) => (
            <div
              key={u.who}
              className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-6"
            >
              <div className="text-[15px] font-bold">{u.who}</div>
              <div className="flex-1 text-sm leading-[1.65] text-muted-foreground">{u.what}</div>
              <a href={u.href} className="text-[13px] font-semibold text-[#333] no-underline hover:underline">
                {u.cta} →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-border bg-muted px-8 py-20">
        <div className="mx-auto max-w-[680px]">
          <h2 className="mb-2 text-center text-[26px] font-bold tracking-[-0.02em]">
            Simple pricing
          </h2>
          <p className="mb-12 text-center text-[15px] text-muted-foreground">Cancel anytime. No seat fees.</p>
          <div className="grid grid-cols-2 gap-5">
            <PricingCard
              tier="Free"
              price="$0"
              per="forever"
              features={["10 reviews per week", "Full 5-reviewer committee", "2-round debate", "Moderator verdict", "arXiv + PDF support"]}
              cta="Start for free"
              ctaHref="/home"
              highlight={false}
            />
            <PricingCard
              tier="Pro"
              price="$14"
              per="/month"
              features={["50 reviews per day", "Adversarial debate mode", "Multi-paper comparison", "Priority compute", "Cancel anytime"]}
              cta="Get Pro"
              ctaHref="/checkout"
              highlight={true}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-10 text-center text-[13px] text-muted-foreground">
        <div className="mb-3 text-base font-bold text-[#6366f1]">Council</div>
        <div className="mb-4 flex justify-center gap-6">
          <a href="/home" className="text-muted-foreground no-underline hover:text-foreground transition-colors">Try it free</a>
          <a href="/home" className="text-muted-foreground no-underline hover:text-foreground transition-colors">Compare & Debate</a>
          <a href="#pricing" className="text-muted-foreground no-underline hover:text-foreground transition-colors">Pricing</a>
        </div>
        AI-powered peer review — not a substitute for human expert review.
      </footer>
    </div>
  );
}

function ScalesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
      <path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </svg>
  );
}

function VerdictRow({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold tracking-[0.06em] text-muted-foreground">
        {label.toUpperCase()}
      </div>
      <div className="text-sm leading-[1.65] text-foreground">{text}</div>
    </div>
  );
}

function PricingCard({
  tier,
  price,
  per,
  features,
  cta,
  ctaHref,
  highlight,
}: {
  tier: string;
  price: string;
  per: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight: boolean;
}) {
  const ctaClass = cn(
    "block rounded-[7px] py-[11px] text-center text-sm font-bold no-underline transition-colors cursor-pointer border-none",
    highlight
      ? "bg-white text-[#6366f1] hover:bg-white/90"
      : "bg-[#6366f1] text-white hover:bg-[#4f46e5]"
  )
  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-xl border-[1.5px] p-7",
        highlight
          ? "border-[#6366f1] bg-[#6366f1] shadow-[0_8px_32px_rgba(99,102,241,0.25)]"
          : "border-border bg-card"
      )}
    >
      <div>
        <div
          className={cn(
            "mb-2 text-[13px] font-bold tracking-[0.06em]",
            highlight ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {tier.toUpperCase()}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-[36px] font-extrabold tracking-[-0.03em]",
              highlight ? "text-white" : "text-foreground"
            )}
          >
            {price}
          </span>
          <span className={cn("text-[13px]", highlight ? "text-white/60" : "text-muted-foreground")}>
            {per}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2">
            <span
              className={cn(
                "mt-px flex-shrink-0 text-sm font-bold",
                highlight ? "text-white/80" : "text-green-500"
              )}
            >
              ✓
            </span>
            <span
              className={cn(
                "text-sm leading-[1.4]",
                highlight ? "text-white/90" : "text-muted-foreground"
              )}
            >
              {f}
            </span>
          </div>
        ))}
      </div>
      {highlight ? (
        <UpgradeButton className={ctaClass} />
      ) : (
        <a href={ctaHref} className={ctaClass}>{cta}</a>
      )}
    </div>
  );
}
