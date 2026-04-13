import { checkSearchRateLimit } from "../rate-limit";

type Handler = (agentId: string, args: Record<string, unknown>, depth: number) => Promise<string>;

export const handlers: Record<string, Handler> = {

  async web_search(agentId, args) {
    const rateLimitErr = checkSearchRateLimit();
    if (rateLimitErr) return rateLimitErr;

    const { query, count = 5 } = args as { query: string; count?: number };
    const resultCount = Math.min(Math.max(1, count), 10);
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;

    if (braveKey) {
      // Brave Search API
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${resultCount}&text_decorations=false&search_lang=zh-hant`;
      const res = await fetch(url, {
        headers: { "Accept": "application/json", "X-Subscription-Token": braveKey },
      });
      if (!res.ok) return `搜尋失敗：HTTP ${res.status}`;
      const data = await res.json() as { web?: { results?: Array<{ title: string; url: string; description?: string }> } };
      const results = data.web?.results ?? [];
      if (!results.length) return `沒有找到「${query}」的相關結果`;
      return results.slice(0, resultCount).map((r, i) =>
        `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description ?? ""}`
      ).join("\n\n");
    } else {
      // DuckDuckGo fallback（instant answers）
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(url, { headers: { "User-Agent": "ClaudeAgentPlatform/1.0" } });
      if (!res.ok) return `搜尋失敗：HTTP ${res.status}`;
      const data = await res.json() as {
        AbstractText?: string; AbstractURL?: string; AbstractSource?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
      };
      const parts: string[] = [];
      if (data.AbstractText) parts.push(`**摘要（${data.AbstractSource}）**\n${data.AbstractText}\n${data.AbstractURL}`);
      const related = (data.RelatedTopics ?? []).slice(0, resultCount - 1);
      for (const t of related) {
        if (t.Text && t.FirstURL) parts.push(`• ${t.Text}\n  ${t.FirstURL}`);
      }
      if (!parts.length) return `沒有找到「${query}」的即時結果。建議設定 BRAVE_SEARCH_API_KEY 以獲得完整搜尋結果（免費：https://brave.com/search/api/）`;
      return parts.join("\n\n");
    }
  },

  async fetch_url(agentId, args) {
    const { url, selector } = args as { url: string; selector?: string };
    if (!/^https?:\/\//i.test(url)) return `⚠️ 無效的 URL：${url}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ClaudeAgentBot/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return `抓取失敗：HTTP ${res.status} ${res.statusText}`;
    const html = await res.text();

    // 簡易 HTML → 純文字轉換
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // 截斷防止 token 爆炸
    if (text.length > 8000) text = text.slice(0, 8000) + "\n\n…（內容已截斷，共 " + html.length + " 字元）";
    void selector; // selector param kept for API compatibility
    return `【${url}】\n\n${text}`;
  },

};
