# Council 上線後加入地端 Gemma 4 26B MoE 做 Tool Result 預處理的負荷分析

更新日期: 2026-04-16

## 1. 結論先講

以目前 `Council` 的 academic review flow 估算，若在每次 `tool result` 回灌 seat 之前，先送到地端 `Gemma 4 26B A4B / MoE` 做摘要預處理：

- 每個 session 大約會新增 `9` 到 `28` 次本地 Gemma 推論
- 中位估算可先用 `16 calls / session`
- 每個 session 的本地 Gemma token 負荷大約落在 `26k` 到 `81k` tokens
- 以中位估算，約 `46k local tokens / session`
- 真正的壓力點不是平均值，而是 `Round 1` 的 `5-seat` 平行 burst
- 如果預處理同步卡在 seat loop 內，`1 worker` 雖然能跑，但會明顯放大 session latency
- 目前 5-seat 架構下，launch 目標比較合理的是 `至少 3 個 preprocess worker slots`

## 2. 這份估算基於哪些已知事實

### Council 目前執行方式

- academic analyze 預設建立 `5 seats`，可跑 `2 rounds`
- `Round 1` 的 seat turn 以 `Promise.all()` 平行執行
- `Round 2` 的 seat turn 是依序執行
- text-loop runtime 每個 turn 預設最多 `6` 輪、最多 `12` 次 tool call
- `tool result` 目前會原樣拼回下一輪 prompt；text-loop 路徑沒有先做摘要
- `Gemma 4 26B` 已經被列在 `Ollama` 的 `text-loop` seat model 選項裡

### Tool 輸出上限

- `fetch_url` 會把結果截到 `8,000 chars`
- RAG chunk context 的上限是 `9,000 chars`
- 因此單次 `tool result` 的輸入量級，大致可先抓在 `2,000` 到 `3,000` tokens

### 相關程式位置

- [src/app/analyze/page.tsx](/D:/council/src/app/analyze/page.tsx)
- [src/lib/council.ts](/D:/council/src/lib/council.ts)
- [src/lib/agentic-runtime.ts](/D:/council/src/lib/agentic-runtime.ts)
- [src/lib/tools/handlers/web.ts](/D:/council/src/lib/tools/handlers/web.ts)
- [src/lib/tools/handlers/rag.ts](/D:/council/src/lib/tools/handlers/rag.ts)
- [src/lib/council-config.ts](/D:/council/src/lib/council-config.ts)

## 3. 為什麼值得先做預處理

目前 text-loop 的關鍵問題不是「多了一次 tool result」而已，而是同一個結果會被後續輪次反覆帶進 prompt。

流程是：

1. seat 產生 tool call
2. tool 回傳原始結果
3. runtime 把結果包成 `Tool execution results: ...`
4. seat 下一輪再帶著這段內容繼續推理
5. 如果同一 turn 又打第二個、第三個 tool，前面的結果還會繼續被重複帶入

因此，若某個 seat turn 內有 `n` 次 tool result，而每次原始結果大小是 `R` tokens，則原始結果被重複看到的額外成本近似：

`Extra_input_tokens ~= R * n(n + 1) / 2`

這就是預處理值得做的原因：你雖然多打一層本地 Gemma，但可以把後續主模型被反覆餵入的大段結果縮短。

## 4. 每個 Session 會增加多少次 Gemma 呼叫

定義：

- `S = seat 數`
- `c1 = 每個 seat 在 Round 1 的平均 tool result 次數`
- `c2 = 每個 seat 在 Round 2 的平均 tool result 次數`
- `p2 = session 會進入 Round 2 的機率`

則：

`C_session = S * (c1 + p2 * c2)`

以目前 academic flow：

- `S = 5`
- `rounds = 2`
- `Round 2` 會不會跑，受 divergence classifier 影響

估算表：

| 情境 | 假設 | `C_session` |
| --- | --- | --- |
| 保守 | `c1 = 1.0`, `c2 = 1.0`, `p2 = 0.7` | `5 * (1 + 0.7) = 8.5`，約 `9` 次 |
| 中位 | `c1 = 2.0`, `c2 = 1.5`, `p2 = 0.8` | `5 * (2 + 1.2) = 16` 次 |
| 尖峰 | `c1 = 3.0`, `c2 = 2.5`, `p2 = 1.0` | `5 * (3 + 2.5) = 27.5`，約 `28` 次 |

結論：

- 每個 session 會多出大約 `9` 到 `28` 次 Gemma 預處理
- 規劃基準可以先抓 `16 preprocess calls / session`

## 5. 每次 Gemma 預處理大概吃多少 token

定義：

- `I_pre = 預處理輸入 tokens`
- `O_pre = 預處理輸出 tokens`
- `T_pre = I_pre + O_pre`

考慮到現有 tool handler 輸出上限，實務上可先抓：

- `I_pre = 2,000` 到 `3,000`
- `O_pre = 300` 到 `600`

中位估算：

- `I_pre = 2,500`
- `O_pre = 400`
- `T_pre = 2,900 tokens / call`

則每個 session 的本地 Gemma token 負荷為：

`Tokens_session_local = C_session * T_pre`

估算表：

| 情境 | `C_session` | `T_pre` | 本地 Gemma tokens / session |
| --- | --- | --- | --- |
| 保守 | `9` | `2,900` | `26,100` |
| 中位 | `16` | `2,900` | `46,400` |
| 尖峰 | `28` | `2,900` | `81,200` |

## 6. 尖峰併發在哪裡

`Round 1` 目前是 `5` 個 seats 平行跑。每個 seat 在 text-loop 內，一次只會等一個 tool result 回來再繼續下一輪，因此：

- 單一 session 的 Gemma 預處理尖峰併發，理論上接近 `5`
- `Round 2` 因為 seat 依序執行，尖峰通常接近 `1`

也就是說，壓力不是 steady-state average，而是 launch 後多個 session 同時進入 `Round 1` 的 burst。

若同時有 `N` 個 session 進入 `Round 1`，則瞬間預處理併發近似：

`Burst_concurrency ~= 5 * N`

例子：

| 同時進入 Round 1 的 session | 預估併發 |
| --- | --- |
| `1` | `5` |
| `2` | `10` |
| `3` | `15` |

## 7. Worker 數量怎麼抓

定義：

- `W = preprocess worker slots`
- `L_pre = 單次預處理平均耗時`

對於一個 burst，排隊波數近似：

`waves = ceil(Burst_concurrency / W)`

額外排隊懲罰近似：

`queue_penalty ~= (waves - 1) * L_pre`

假設：

- 單一 session 進入 `Round 1`
- `Burst_concurrency = 5`
- `L_pre = 10s`

則：

| `W` | 需要幾波消化 `5` 個請求 | 額外排隊時間 |
| --- | --- | --- |
| `1` | `5` 波 | 約 `40s` |
| `2` | `3` 波 | 約 `20s` |
| `3` | `2` 波 | 約 `10s` |
| `5` | `1` 波 | 近乎 `0s` |

結論：

- `1 worker` 不是不能跑，而是會把 session latency 明顯放大
- 若 launch 期仍是 5-seat academic flow，`3 workers` 是比較合理的下限
- 目標不是完全消除 queue，而是把單 session 的 Round 1 burst 壓在 `2 波` 內

## 8. 預處理可以換回多少下游 token 節省

定義：

- `R = 原始 tool result tokens`
- `P = 預處理後摘要 tokens`
- `n = 單一 seat turn 的 tool result 次數`

則單一 turn 可能省下的 seat model input tokens 近似：

`Saved_turn ~= (R - P) * n(n + 1) / 2`

例子：

- `R = 2,400`
- `P = 500`
- `n = 2`

則：

`Saved_turn ~= (2,400 - 500) * 3 = 5,700 tokens`

如果用 `5-seat / 2-round` 去抓 `10` 個 seat turn 都有類似效果：

`Saved_session ~= 57,000 input tokens`

這還沒算 moderator 看到的內容也會因 seats 引用較短摘要而同步縮短。也就是說，本地 Gemma 層雖然新增了約 `46k local tokens / session`，但換回下游主模型 token 節省的量級，可能接近甚至超過這個數字。

## 9. 換算成系統容量

如果用中位估算：

- `16 preprocess calls / session`
- `L_pre` 秒 / call
- `W` 個 worker slots

則理論上本地 Gemma 層的 session 處理上限約為：

`Sessions_per_hour ~= (W * 3600) / (16 * L_pre)`

例子：

| `W` | `L_pre` | 理論上限 sessions/hour |
| --- | --- | --- |
| `1` | `10s` | `22.5` |
| `2` | `10s` | `45` |
| `3` | `10s` | `67.5` |
| `3` | `6s` | `112.5` |
| `5` | `10s` | `112.5` |

這是純 throughput 上限，不含 burst queue、其他 seat model latency、DB I/O、tool handler latency，也不含 GPU batching 效果。

## 10. Launch 建議

### 建議的起始容量假設

- 規劃基準先用 `16 preprocess calls / session`
- 壓力測試至少覆蓋 `1`, `2`, `3` 個 session 同時進入 `Round 1`
- 先量出真實 `L_pre p50 / p95 / p99`

### 建議的 worker 目標

- 如果預處理同步卡在 seat loop 內：`至少 3 個 preprocess worker slots`
- 如果想吸收 `2 個 session` 同時進 Round 1 而不讓 queue 過長，目標應再往上加
- 如果未來 seat 數超過 `5` 或 `Round 2` 保持全開，這個 sizing 需要重新算

### 上線後必收的指標

- `tool_result_preprocess_requests_total`
- `tool_result_preprocess_latency_ms`
- `tool_result_preprocess_queue_depth`
- `tool_result_raw_chars`
- `tool_result_summary_chars`
- `session_round1_duration_ms`
- `session_round2_duration_ms`
- `preprocess_bypass_rate`

## 11. 風險與未定項

- 目前 repo 沒有真實 production traffic，因此這份分析是 `per-session` 與 `burst-based` sizing，不是實際流量預測
- `Gemma 4 26B A4B` 的真實 tokens/s 會強烈依賴 GPU、量化、batching、context 長度與 Ollama 服務參數
- 如果之後把預處理做成非同步旁路，而不是卡住 seat loop，容量模型會改寫
- 如果摘要品質不穩，省下 token 也可能換來 reasoning 退化；上線前要做 quality gate

## 12. 模型資料來源

- Google Gemma release notes：Gemma 4 於 `2026-03-31` 發布，含 `E2B`、`E4B`、`31B` 與 `26B A4B`  
  https://ai.google.dev/gemma/docs/releases
- Hugging Face model card：`google/gemma-4-26B-A4B-it`  
  https://huggingface.co/google/gemma-4-26B-A4B-it
