import { db } from '@/lib/db/db'
import { ensureAccountSchema } from '@/lib/db/account-db'

export type WorkspaceTier = 'free' | 'pro'

let tierSchemaReady: Promise<void> | null = null

async function ensureTierColumns(): Promise<void> {
  if (!tierSchemaReady) {
    tierSchemaReady = (async () => {
      await ensureAccountSchema()
      await db.query(`
        ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free';
        ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
        ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
      `)
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_stripe_customer_id
          ON workspaces(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_stripe_subscription_id
          ON workspaces(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
      `)
    })().catch((err) => {
      tierSchemaReady = null
      throw err
    })
  }
  await tierSchemaReady
}

export async function getWorkspaceTierByEmail(email: string): Promise<WorkspaceTier> {
  await ensureTierColumns()
  const { rows } = await db.query(
    `SELECT w.tier
     FROM workspaces w
     JOIN users u ON u.id = w.owner_user_id
     WHERE u.primary_email = $1 AND w.kind = 'personal'
     LIMIT 1`,
    [email.trim().toLowerCase()],
  )
  return ((rows[0]?.tier as WorkspaceTier) ?? 'free')
}

export async function setWorkspaceTierByCustomerId(
  customerId: string,
  tier: WorkspaceTier,
  subscriptionId: string | null,
): Promise<void> {
  await ensureTierColumns()
  await db.query(
    `UPDATE workspaces
     SET tier = $2,
         stripe_subscription_id = $3,
         updated_at = NOW()
     WHERE stripe_customer_id = $1`,
    [customerId, tier, subscriptionId],
  )
}

export async function linkStripeCustomer(email: string, customerId: string): Promise<void> {
  await ensureTierColumns()
  await db.query(
    `UPDATE workspaces w
     SET stripe_customer_id = $2, updated_at = NOW()
     FROM users u
     WHERE u.id = w.owner_user_id
       AND u.primary_email = $1
       AND w.kind = 'personal'
       AND (w.stripe_customer_id IS NULL OR w.stripe_customer_id = $2)`,
    [email.trim().toLowerCase(), customerId],
  )
}

export async function getWorkspaceStripeCustomerId(email: string): Promise<string | null> {
  await ensureTierColumns()
  const { rows } = await db.query(
    `SELECT w.stripe_customer_id
     FROM workspaces w
     JOIN users u ON u.id = w.owner_user_id
     WHERE u.primary_email = $1 AND w.kind = 'personal'
     LIMIT 1`,
    [email.trim().toLowerCase()],
  )
  return (rows[0]?.stripe_customer_id as string | null) ?? null
}
