"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { credentialsSignIn } from "./actions";

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
      style={{
        width: 16,
        height: 16,
        border: `2px solid ${dark ? "rgba(255,255,255,0.3)" : "#ddd"}`,
        borderTopColor: dark ? "#fff" : "#6366f1",
        borderRadius: "50%",
        display: "inline-block",
        animation: "spin 0.6s linear infinite",
      }}
    />
  );
}

function providerIcon(id: string) {
  if (id === "google") {
    return <GoogleIcon />;
  }

  if (id === "github") {
    return <GitHubIcon />;
  }

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
        if (!active) {
          return;
        }

        setProviders(result ?? {});
      })
      .finally(() => {
        if (active) {
          setProvidersLoading(false);
        }
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
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "48px 40px",
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 16,
          boxShadow: "0 4px 32px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#6366f1",
              letterSpacing: "-0.03em",
              marginBottom: 8,
            }}
          >
            Council
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#1a1a1a",
              marginBottom: 4,
            }}
          >
            Sign in
          </div>
          <div style={{ fontSize: 13, color: "#999" }}>
            Auth.js v5 session flow for the App Router
          </div>
        </div>

        {providersLoading ? (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <Spinner />
          </div>
        ) : oauthProviders.length > 0 ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {oauthProviders.map((provider) => {
                const dark = isDarkProvider(provider.id);
                const loading = loadingProvider === provider.id;

                return (
                  <button
                    key={provider.id}
                    onClick={() => void handleOAuth(provider.id)}
                    disabled={loading}
                    style={{
                      width: "100%",
                      height: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      background: dark ? "#1a1a1a" : "#fff",
                      border: `1px solid ${dark ? "#1a1a1a" : "#e5e5e5"}`,
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      color: dark ? "#fff" : "#1a1a1a",
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                      transition: "opacity 150ms, box-shadow 150ms",
                    }}
                  >
                    {loading ? <Spinner dark={dark} /> : providerIcon(provider.id)}
                    {`Continue with ${provider.name}`}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
              <span style={{ fontSize: 12, color: "#bbb", fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
            </div>
          </>
        ) : null}

        <form onSubmit={handleCredentialsSignIn} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@council.local"
              autoComplete="email"
              required
              style={{
                width: "100%",
                height: 44,
                borderRadius: 8,
                border: "1px solid #e5e5e5",
                padding: "0 14px",
                fontSize: 14,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
              style={{
                width: "100%",
                height: 44,
                borderRadius: 8,
                border: "1px solid #e5e5e5",
                padding: "0 14px",
                fontSize: 14,
              }}
            />
          </label>

          {error ? (
            <div
              style={{
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: 13,
                padding: "10px 12px",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submittingCredentials}
            style={{
              width: "100%",
              height: 44,
              background: "#6366f1",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              cursor: submittingCredentials ? "not-allowed" : "pointer",
              opacity: submittingCredentials ? 0.7 : 1,
            }}
          >
            {submittingCredentials ? "Signing in..." : "Sign in with credentials"}
          </button>
        </form>

        {process.env.NODE_ENV !== "production" ? (
          <div
            style={{
              marginTop: 18,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#64748b",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            Dev fallback credentials: <code>admin@council.local</code> / <code>dev-password</code>
          </div>
        ) : null}

        {isLoggedIn ? (
          <div
            style={{
              marginTop: 18,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>You&apos;re already signed in.</span>
            <button
              onClick={() => router.push("/home")}
              style={{
                background: "none",
                border: "none",
                color: "#15803d",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              Go to /home →
            </button>
          </div>
        ) : null}

        <button
          onClick={() => router.push("/analyze")}
          style={{
            width: "100%",
            height: 44,
            background: "transparent",
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            color: "#666",
            cursor: "pointer",
            marginTop: 18,
          }}
        >
          Try free without an account
        </button>
      </div>

      <a
        href="/"
        style={{ marginTop: 24, fontSize: 13, color: "#999", textDecoration: "none" }}
      >
        Back to home
      </a>
    </div>
  );
}
