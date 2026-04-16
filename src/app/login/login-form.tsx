"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { credentialsSignIn } from "./actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type AuthProvider = {
  id: string;
  name: string;
};

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function Spinner({ dark }: { dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2",
        dark
          ? "border-white/30 border-t-white"
          : "border-border border-t-[#6366f1]"
      )}
    />
  );
}

function providerIcon(id: string) {
  if (id === "google") return <GoogleIcon />;
  if (id === "github") return <GitHubIcon />;
  return null;
}

function isDarkProvider(id: string) {
  return id === "github";
}

export function LoginForm({ isLoggedIn }: { isLoggedIn?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = useMemo(
    () => searchParams.get("redirectTo") || "/home",
    [searchParams]
  );

  const [providers, setProviders] = useState<Record<string, AuthProvider>>({});
  const [providersLoading, setProvidersLoading] = useState(true);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submittingCredentials, startCredentialsTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getProviders()
      .then((result) => {
        if (!active) return;
        setProviders(result ?? {});
      })
      .finally(() => {
        if (active) setProvidersLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const oauthProviders = Object.values(providers).filter(
    (provider) => provider.id !== "credentials"
  );

  async function handleOAuth(providerId: string) {
    setError(null);
    setLoadingProvider(providerId);
    await signIn(providerId, { redirectTo });
  }

  function handleCredentialsSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startCredentialsTransition(async () => {
      const result = await credentialsSignIn(email, password);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <Card className="w-full max-w-[400px] shadow-[0_4px_32px_rgba(0,0,0,0.06)]">
        <CardContent className="px-10 py-12">
          {/* Logo + title */}
          <div className="mb-8 text-center">
            <div className="mb-2 text-2xl font-extrabold tracking-[-0.03em] text-[#6366f1]">
              Council
            </div>
            <div className="mb-1 text-[15px] font-semibold text-foreground">Sign in</div>
            <div className="text-[13px] text-muted-foreground">
              Auth.js v5 session flow for the App Router
            </div>
          </div>

          {/* OAuth providers */}
          {providersLoading ? (
            <div className="mb-5 flex justify-center">
              <Spinner />
            </div>
          ) : oauthProviders.length > 0 ? (
            <>
              <div className="flex flex-col gap-2.5">
                {oauthProviders.map((provider) => {
                  const dark = isDarkProvider(provider.id);
                  const isLoading = loadingProvider === provider.id;

                  return (
                    <button
                      key={provider.id}
                      onClick={() => void handleOAuth(provider.id)}
                      disabled={isLoading}
                      className={cn(
                        "flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border text-sm font-semibold transition-opacity duration-150",
                        dark
                          ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
                          : "border-border bg-card text-foreground",
                        isLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-90"
                      )}
                    >
                      {isLoading ? <Spinner dark={dark} /> : providerIcon(provider.id)}
                      {`Continue with ${provider.name}`}
                    </button>
                  );
                })}
              </div>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          ) : null}

          {/* Credentials form */}
          <form onSubmit={handleCredentialsSignIn} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Email</span>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@council.local"
                autoComplete="email"
                required
                className="h-11"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Password</span>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
                className="h-11"
              />
            </label>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={submittingCredentials}
              className={cn(
                "h-11 w-full rounded-lg bg-[#6366f1] text-sm font-semibold text-white hover:bg-[#4f46e5]",
                submittingCredentials && "cursor-not-allowed opacity-70"
              )}
            >
              {submittingCredentials ? "Signing in..." : "Sign in with credentials"}
            </Button>
          </form>

          {/* Dev credentials hint */}
          {process.env.NODE_ENV !== "production" ? (
            <div className="mt-[18px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
              Dev fallback credentials: <code>admin@council.local</code> / <code>dev-password</code>
            </div>
          ) : null}

          {/* Already signed in banner */}
          {isLoggedIn ? (
            <div className="mt-[18px] flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-[13px] text-green-800">
              <span>You&apos;re already signed in.</span>
              <button
                onClick={() => router.push("/home")}
                className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-semibold text-green-700 underline"
              >
                Go to /home →
              </button>
            </div>
          ) : null}

          {/* Try free without account */}
          <Button
            variant="outline"
            onClick={() => router.push("/analyze")}
            className="mt-[18px] h-11 w-full text-sm font-medium text-muted-foreground"
          >
            Try free without an account
          </Button>
        </CardContent>
      </Card>

      <a href="/" className="mt-6 text-[13px] text-muted-foreground no-underline hover:text-foreground transition-colors">
        Back to home
      </a>
    </div>
  );
}
