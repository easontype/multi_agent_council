import { Pool } from "pg";

// ─── Connection Pool ──────────────────────────────────────────────────────────

const globalPool = global as typeof global & { _pgPool?: Pool };

function getPool(): Pool {
  if (!globalPool._pgPool) {
    globalPool._pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    globalPool._pgPool.on("error", (err) => {
      console.error("PostgreSQL pool error:", err);
    });
  }
  return globalPool._pgPool;
}

export const db = {
  query: async (text: string, params?: unknown[]) => {
    const pool = getPool();
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === "development" && duration > 500) {
      console.warn(`Slow query (${duration}ms):`, text);
    }
    return res;
  },

  getClient: async () => {
    const pool = getPool();
    return pool.connect();
  },
};
