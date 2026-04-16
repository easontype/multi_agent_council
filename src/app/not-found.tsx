import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center">
        {/* 404 display */}
        <p className="text-[80px] font-bold text-[#6366f1]/10 leading-none select-none mb-4">
          404
        </p>

        <h1 className="text-xl font-semibold text-foreground mb-2">Page not found</h1>
        <p className="text-sm text-muted-foreground mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/home"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#6366f1] text-white hover:bg-[#5558e8] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Back to home
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
          >
            Landing page
          </Link>
        </div>
      </div>
    </div>
  );
}
