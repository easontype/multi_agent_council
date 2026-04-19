import { auth } from "@/auth";
import { ensureUserAccountByEmail, type AccountContext } from "@/lib/db/account-db";

interface AuthUserLike {
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

export async function ensureAccountContextForAuthUser(
  user: AuthUserLike | null | undefined,
): Promise<AccountContext | null> {
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!email) return null;

  return ensureUserAccountByEmail({
    email,
    displayName: user?.name ?? null,
    avatarUrl: user?.image ?? null,
  });
}

export async function resolveAuthAccountContext(): Promise<AccountContext | null> {
  const session = await auth();
  return ensureAccountContextForAuthUser(session?.user);
}
