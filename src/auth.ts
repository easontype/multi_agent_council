import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";

const DEV_ADMIN_EMAIL = "admin@council.local";
const DEV_ADMIN_PASSWORD = "dev-password";
const DEV_AUTH_SECRET = "council-dev-auth-secret-change-in-production";

class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}

function getAdminEmail() {
  return (
    process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase() ||
    (process.env.NODE_ENV !== "production" ? DEV_ADMIN_EMAIL : "")
  );
}

function getAdminPassword() {
  return (
    process.env.AUTH_ADMIN_PASSWORD ||
    (process.env.NODE_ENV !== "production" ? DEV_ADMIN_PASSWORD : "")
  );
}

function secureEqual(left: string, right: string) {
  // Simple constant-time-ish comparison (dev only — not for production secrets)
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

const providers = [];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub);
}

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

providers.push(
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email =
        typeof credentials.email === "string"
          ? credentials.email.trim().toLowerCase()
          : "";
      const password =
        typeof credentials.password === "string" ? credentials.password : "";
      const adminEmail = getAdminEmail();
      const adminPassword = getAdminPassword();

      if (!adminEmail || !adminPassword) {
        throw new Error(
          "Set AUTH_ADMIN_EMAIL and AUTH_ADMIN_PASSWORD before using credentials auth."
        );
      }

      if (!secureEqual(email, adminEmail) || !secureEqual(password, adminPassword)) {
        throw new InvalidCredentialsError();
      }

      return {
        id: "council-admin",
        name: "Council Admin",
        email: adminEmail,
      };
    },
  })
);

export const authConfig = {
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== "production" ? DEV_AUTH_SECRET : undefined),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers,
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;
      const isProtected =
        pathname.startsWith("/home") ||
        pathname.startsWith("/results");

      if (!isProtected) return true;
      if (auth?.user) return true;

      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
