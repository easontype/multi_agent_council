import { db } from "../db";

// ── Web search rate limiter (in-memory) ──────────────────────────────────────

const SEARCH_LIMIT_PER_MIN = 5;   // 每分鐘最多 5 次
const SEARCH_LIMIT_PER_DAY = 200; // 每日最多 200 次（月限 1000，保留緩衝）

const searchLog: number[] = []; // timestamps (ms)

export function checkSearchRateLimit(): string | null {
  const now = Date.now();
  const oneMin = now - 60_000;
  const oneDay = now - 86_400_000;

  // 清掉超過一天的紀錄
  while (searchLog.length && searchLog[0] < oneDay) searchLog.shift();

  const perMin = searchLog.filter(t => t > oneMin).length;
  const perDay = searchLog.length;

  if (perMin >= SEARCH_LIMIT_PER_MIN) {
    return `⚠️ 搜尋限流：每分鐘上限 ${SEARCH_LIMIT_PER_MIN} 次，請稍後再試`;
  }
  if (perDay >= SEARCH_LIMIT_PER_DAY) {
    return `⚠️ 搜尋限流：今日已達上限 ${SEARCH_LIMIT_PER_DAY} 次（月限 1000 次，保護額度）`;
  }
  searchLog.push(now);
  return null; // ok
}

// ── 每日工具呼叫計數（存 rate_limit_counters 表）────────────────────────────
export async function checkDailyToolLimit(tool: string, limit: number): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `tool:${tool}`;
  const { rows } = await db.query(
    `SELECT count FROM rate_limit_counters WHERE key = $1 AND date = $2`,
    [key, today]
  );
  const count = rows.length ? Number(rows[0].count) : 0;
  if (count >= limit) {
    return `⚠️ 今日 ${tool} 已達每日上限（${count}/${limit}），明日重置。`;
  }
  await db.query(
    `INSERT INTO rate_limit_counters (key, date, count) VALUES ($1, $2, 1)
     ON CONFLICT (key, date) DO UPDATE SET count = rate_limit_counters.count + 1`,
    [key, today]
  );
  return null;
}
