# Marker Parser 重設計 — 完整決策文件

基於 `uploads/reader-debug/vIJ9jSjDgMZR1qu8Yxpla/marker-raw.md` 的實際結構分析。

---

## 1. Raw Data 完整結構圖

```
──────────────────────────────────────────────
[PRE-TITLE ZONE]  → 全部 skip
──────────────────────────────────────────────
![Elsevier logo](xxx_img.jpg)
Elsevier logo
![CEJ journal cover](xxx_img.jpg)
CEJ journal cover
![Check for updates icon](xxx_img.jpg)
Check for updates icon

→ 判斷：第一個 # h1 之前的所有內容，全部丟掉。
──────────────────────────────────────────────
[TITLE]  → 提取為 title
──────────────────────────────────────────────
# CuO/PVA-based ultra-low-volume oral H<sub>2</sub>S detection system...

→ 處理：stripHtml() 時 <sub>2</sub> → ₂（Unicode 下標）
         結果：「CuO/PVA-based ultra-low-volume oral H₂S detection system...」
──────────────────────────────────────────────
[AUTHORS LINE]  → 解析作者
──────────────────────────────────────────────
Moumita Deb<sup>a,i,1</sup>, Chang-Chuan Huang<sup>b,1</sup>, ...

→ 處理：見 Section 4「作者解析邏輯」
──────────────────────────────────────────────
[AFFILIATION LINES]  → 建立 affilMap，附加到作者
──────────────────────────────────────────────
<sup>a</sup> Department of Photonics, National Yang Ming Chiao Tung University...
<sup>b</sup> Department of Electrical Engineering, National Tsing Hua University...
...
<sup>i</sup> Institute of Pioneer Semiconductor Innovation...

→ 判斷：以 <sup>單字母或數字</sup> 開頭的獨立行 = affiliation 行
→ 建立 map：{ a: "Department of Photonics...", b: "...", ... }
──────────────────────────────────────────────
[NOISE ZONE — 要 skip 的段落，嵌在 section 內]
──────────────────────────────────────────────
* Corresponding authors.
E-mail addresses: dhwang@nycu.edu.tw (D.-H. Wang)...
<sup>1</sup> The authors have contributed equally.

→ 判斷：用內容 pattern 過濾（不是 section heading，是段落層級）
→ 規則：
  - /^\*\s*Corresponding authors?/i        → skip
  - /^E-mail addresses?:/i                 → skip
  - /^<sup>\d+<\/sup>\s*(The authors|Equal contribution)/i  → skip
──────────────────────────────────────────────
[## ARTICLE INFO]  → 提取 keywords，section 本身 skip
──────────────────────────────────────────────
## ARTICLE INFO
### Keywords:
Low-volume oral H<sub>2</sub>S gas
Extractor sampling
CuO/PVA
CaCl<sub>2</sub> filter
Clinical tongue coating effect

→ 處理：提取為 ParsedPaper.keywords: string[]（strip HTML）
         keywords: ["Low-volume oral H₂S gas", "Extractor sampling", ...]
         section 本身不進 reader 正文
──────────────────────────────────────────────
[## ABSTRACT]  → 提取為 abstract，不進 sections
──────────────────────────────────────────────
[BODY SECTIONS]  → 正文
──────────────────────────────────────────────
## 1. Introduction
## 2. Experimental section
### 2.1. Sensor fabrication
#### 2.2.1. Traditional high-volume $\text{H}_2\text{S}$ sensing system
...
──────────────────────────────────────────────
[FIGURE BLOCK PATTERN]
──────────────────────────────────────────────
![long AI alt text](xxx_img.jpg)
                                              ← 空行
Figure 5 consists of four subplots...         ← AI 描述段落 → FigureBlock.description
- (a) Volume effect: ...                      ← 或 list → 也存入 description
                                              ← 空行
Figure 5: [verbatim alt text repeat]          ← skip（和 alt 一樣）
                                              ← 空行
**Fig. 5.** Double-tube system 2: (a)...      ← 真正 caption → FigureBlock.caption
                                              ← 空行
fixed condition in the following tests.       ← 正文繼續
──────────────────────────────────────────────
[EMPTY ALT IMAGE + 方程式]
──────────────────────────────────────────────
![](45b2eaa89af6addfe5ecaf7b94549b4e_img.jpg) ← alt 為空
$$\text{O}_2 (\text{ads}) + \text{e}^-...$$  ← 緊接的 MathBlock

→ 決定：alt 為空的圖 = 方程式示意圖，直接 skip（已有 MathBlock 表達同樣內容）
──────────────────────────────────────────────
[## Acknowledgements]  → 保留，可折疊
──────────────────────────────────────────────
→ 決定：保留在原位，UI 上用可折疊的 <details> 元件顯示

[## CRediT / Declaration / Appendix / Data availability]  → 全部 skip
──────────────────────────────────────────────
[## References]  → 保留（支援 citation nav），可折疊
──────────────────────────────────────────────
→ 決定：保留 References section，渲染為可折疊列表
         [N] citation 數字在正文中保留，點擊後 scroll 到 References 區塊
```

---

## 2. `<sub>` / `<sup>` 完整用法分析

### 查到的 `<sub>` 用法（全部是化學式下標）

| Raw | 轉換結果 |
|-----|---------|
| `H<sub>2</sub>S` | H₂S |
| `CaCl<sub>2</sub>` | CaCl₂ |
| `NO<sub>2</sub>` | NO₂ |
| `NO<sub>x</sub>` | NOₓ |
| `CH<sub>3</sub>SH` | CH₃SH |
| `O<sub>2</sub>` | O₂ |
| `SnO<sub>2</sub>` | SnO₂ |
| `TiO<sub>2</sub>` | TiO₂ |
| `WO<sub>3</sub>` | WO₃ |
| `SiO<sub>2</sub>` | SiO₂ |
| `2p<sub>1/2</sub>` | 2p₁/₂（/ 無法下標，可接受） |

**結論：`<sub>` 只用於化學式下標，無例外，統一轉 Unicode 下標。**

### 查到的 `<sup>` 用法

| 位置 | 用法 | 處理 |
|------|------|------|
| 作者行 | `<sup>a,i,1</sup>` affiliation key | 解析後 skip |
| 機構行開頭 | `<sup>a</sup>` | 用於建 map，skip |
| 等同貢獻 | `<sup>1</sup> The authors...` | skip |
| 化學電荷 | `O<sub>2</sub><sup>-</sup>` | → O₂⁻（轉 Unicode 上標） |
| 化學電荷 | `Cu<sup>2+</sup>` | → Cu²⁺ |

**結論：body text 裡的 `<sup>` 全是化學電荷 / 氧化態，統一轉 Unicode 上標。**

### Unicode 轉換實作（在 stripHtml() 中）

```typescript
// 下標：0-9 + 常用字母 + +-=()
const SUB_MAP: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄',
  '5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'a':'ₐ','e':'ₑ','i':'ᵢ','o':'ₒ','u':'ᵤ','x':'ₓ',
  '+':'₊','-':'₋','=':'₌','(':'₍',')':'₎'
}

// 上標：0-9 + 常用符號
const SUP_MAP: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴',
  '5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻','=':'⁼','n':'ⁿ'
}

// 轉換函數：逐字元查 map，查不到就保留原字
function toSub(s: string): string {
  return [...s].map(c => SUB_MAP[c] ?? c).join('')
}
function toSup(s: string): string {
  return [...s].map(c => SUP_MAP[c] ?? c).join('')
}

// 在 stripHtml 開頭先轉，再移除剩餘 HTML tag
text = text
  .replace(/<sub>([^<]*)<\/sub>/g, (_, c) => toSub(c))
  .replace(/<sup>([^<]*)<\/sup>/g, (_, c) => toSup(c))
  .replace(/<[^>]+>/g, '')
```

---

## 3. Section 過濾規則

```typescript
// 這些 section 完全 skip，不進 blocks 也不進 sections[]
const SKIP_SECTION_REGEX = /^(
  references? |
  credit |
  cr[eé]dit\s+authorship |
  declaration\s+of\s+competing |
  appendix |
  supplementary\s+data |
  data\s+availability |
  article\s+info
)$/ix

// 這些 section 保留但折疊顯示
const COLLAPSIBLE_SECTION_REGEX = /^acknowledgements?$/i

// 這些 section 提取為 metadata（不進 sections[]）
const METADATA_SECTION_REGEX = /^(abstract|article\s+info)$/i
```

---

## 4. 作者解析邏輯

### Step 1：找作者行
- 位置：第一個 `# h1` 之後，第一個 `##` heading 之前
- 特徵：行內包含 `<sup>` 且行內有逗號分隔的名字格式
- 正則：`line.includes('<sup>') && /[A-Z][a-z]/.test(line)`

### Step 2：解析名字 + affiliation keys
```
原始：Moumita Deb<sup>a,i,1</sup>, Chang-Chuan Huang<sup>b,1</sup>
步驟：
  1. split on /,\s*(?=[A-Z])/ (逗號後接大寫) → 每個作者
  2. 對每個作者：提取 <sup> 內容 → 拆成 key list
  3. 過濾掉純數字（1, 2 = 等同貢獻，不是機構）
  4. 保留有 * 的 → isCorresponding = true
  5. 含數字 → equalContribution = true
  6. strip <sup>...</sup> 得到 name

結果：
  { name: "Moumita Deb", keys: ["a","i"], isCorresponding: false, equalContribution: true }
  { name: "Chang-Chuan Huang", keys: ["b"], isCorresponding: false, equalContribution: true }
```

### Step 3：解析機構行（affiliation map）
```
原始：<sup>a</sup> Department of Photonics, NYCU...
正則：/^<sup>([a-z])<\/sup>\s+(.+)/i
建立：affiliationMap = { a: "Department of Photonics...", b: "..." }
```

### Step 4：組合結果
```typescript
type AuthorDetail = {
  name: string               // "Moumita Deb"
  affiliations: string[]     // ["Department of Photonics, NYCU", "Institute of..."]
  isCorresponding: boolean   // Ding-Han Wang ✓（有 *）
  equalContribution: boolean // Moumita Deb ✓（有 1）
}
```

### 型別變更方案（向下相容）

**問題說明：**  
目前 `ParsedPaper.authors: string[]` 是一個純名字陣列，例如 `["Moumita Deb", "Chang-Chuan Huang"]`。  
arXiv 論文只有名字，沒有機構資料。  
如果我們直接把 authors 改成 `AuthorDetail[]`，arXiv 論文就會爛掉。

**解決方案：保留 `authors: string[]`，新增可選欄位 `authorDetails`**

```typescript
export type ParsedPaper = {
  ...現有欄位不動...
  authors: string[]                   // 保留，永遠有值，向下相容
  authorDetails?: AuthorDetail[]      // 新增，只有 PDF 論文才有
  keywords?: string[]                 // 新增，從 ## ARTICLE INFO 提取
}
```

- PDF 論文（Marker API）：`authors` + `authorDetails` 都有
- arXiv 論文：只有 `authors`，`authorDetails` 為 `undefined`
- UI 顯示：有 `authorDetails` 就顯示機構資訊，沒有就只顯示名字

---

## 5. FigureBlock 新結構

```typescript
export type FigureBlock = {
  type: "figure"
  id: string
  src: string
  caption: string        // **Fig. N.** — 論文原本的 caption
  alt: string            // image tag 的 alt text（AI 生成的長描述）
  description?: string   // Marker AI 描述段落全文（供顯示/檢查）
  width?: number
  height?: number
}
```

| Raw 內容 | 對應欄位 |
|---------|---------|
| `![alt text](img.jpg)` 的 alt | `alt` |
| `Figure 5 consists of four subplots...` | `description` |
| `Figure 5: [alt text verbatim]` | 丟掉（重複） |
| `**Fig. 5.** Double-tube system...` | `caption` ← 用這個 |

### UI 顯示邏輯（之後實作）
```
[Figure image]
[caption: Fig. 5. Double-tube system...]
[▼ 展開 AI 描述] ← 點擊展開 description
```

---

## 6. Section Heading 內的 Inline Math

### 問題
```
#### 2.2.1. Traditional high-volume $\text{H}_2\text{S}$ sensing system
```
目前 HeadingBlock 直接渲染 `{block.text}` 為純文字，`$\text{H}_2\text{S}$` 會原文顯示。

### 處理方案

| 方案 | 說明 | 複雜度 |
|------|------|--------|
| A | HeadingBlock 也用 `renderText()` 函數（與 text-block 共用），自動處理 `$...$` | 低，改一行 |
| B | stripMd 時把 heading 裡的 `$...$` 轉成 Unicode（不依賴 KaTeX） | 中 |
| C | 不處理，接受 heading 裡偶爾有 `$...$` raw text | 不需改 |

**建議：方案 A**，與 text-block 共用同一個 `renderText()` 函數，heading 裡的 `$...$` 就會自動 KaTeX 渲染。

---

## 7. Citation 數字 `[1,2]`、`[43]`

**決定：保留，支援點擊 scroll 到 References**

### 兩種實作層次

**Level 1（簡單）：** 不改 parser，References section 不 skip，改為折疊顯示。  
`[43]` 在文字裡就是普通文字，讀者可以手動滾到最下面。

**Level 2（完整）：** 在 `text-block.tsx` 的 `renderText()` 裡多加一層 pattern match：  
`[43]` 或 `[1,2]` → 轉成 `<span class="citation" onClick={scrollToRef(43)}>` 灰色可點擊  
References section 裡的 `[43] ...` 每條 ref 也加 `id="ref-43"`

**建議先做 Level 1，再升 Level 2。**

---

## 8. Supplementary 引用 `(Fig. S1a)`、`(Table S1)`

**決定：灰化顯示**

在 `renderText()` 裡加 pattern：  
`/((?:Fig|Table|Eq)\.\s*S\d+[a-z]?)/g` → 用 `<span class="text-muted-foreground">` 包住

---

## 9. Acknowledgements Section

**決定：保留在原位，用折疊 `<details>` 顯示**

```tsx
// content-renderer.tsx 裡 section 渲染時
if (section.collapsible) {
  return (
    <details className="mb-6">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
        {section.title}
      </summary>
      <div className="mt-3">...</div>
    </details>
  )
}
```

需要在 `PaperSection` 加 `collapsible?: boolean` 欄位。

---

## 10. Keywords 外部儲存

**決定：存入 `contentJson.keywords`，同時也存入 `reader_papers` DB 欄位，供論文庫頁面顯示**

### 需要的改動

**DB（db.ts）：**
```sql
ALTER TABLE reader_papers ADD COLUMN keywords TEXT[] DEFAULT '{}';
```

**上傳流程（papers/route.ts）：**
解析完成後把 `parsedPaper.keywords` 同時存進 DB 的 `keywords` 欄位。

**論文庫頁面（reader/page.tsx）：**
列表中每篇論文顯示 keywords 作為 tag：
```tsx
{paper.keywords?.map(kw => (
  <span key={kw} className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
    {kw}
  </span>
))}
```

**Reader 頁面（paper-reader-shell.tsx）：**
標題下方也顯示 keywords tag（與 journal/publishedDate 並列）。

---

## 11. Column Break 合併策略（不變）

現有 `mergeFragmentedParagraphs()` 規則：
- 前段不以 `.!?:` 結尾 → 合併

Raw data 驗證：
- `...monitored via` → via 不以 `.!?:` 結尾 → ✓ 合併
- `...transport channel for` → for → ✓ 合併

目前規則已夠用，不需修改。

---

## 12. 新 Parser 流程總覽

```
markdownToParsedPaper(markdown, imageUrlMap, paperId, filename)
  │
  ├── [Step 1] 找第一個 # h1 的行號 → 切掉 pre-title zone
  │
  ├── [Step 2] 提取 title（h1 文字，stripHtml 轉 Unicode sub/sup）
  │
  ├── [Step 3] 在 h1 到第一個 ## 之間：
  │     ├── 找作者行（含 <sup> 的行）→ 解析 AuthorDetail[]
  │     ├── 找機構行（<sup>x</sup> 開頭）→ 建 affiliationMap
  │     └── 其他行全部 skip（機構、對應作者 email、等同貢獻）
  │
  ├── [Step 4] 找 ## ARTICLE INFO → 提取 keywords[]（section skip）
  │
  ├── [Step 5] 找 ## ABSTRACT → 提取 abstract 文字（section skip）
  │
  ├── [Step 6] buildSections(剩餘 lines)
  │     ├── SKIP_SECTION_REGEX → 整個 section 跳過
  │     ├── COLLAPSIBLE_SECTION_REGEX → section.collapsible = true
  │     ├── References → section.isReferences = true（折疊）
  │     └── 其他 → 正常 parseBlocks()
  │
  └── [Step 7] parseBlocks(lines)
        ├── $$...$$ → MathBlock
        ├── ```...``` → CodeBlock
        ├── ![alt](img) → FigureBlock（新邏輯）
        │     ├── alt 為空 → skip（方程式圖）
        │     ├── 向前掃 40 行找 **Fig. N.**
        │     ├── 中間的 AI 描述 → description 欄位
        │     └── Figure N: 重複行 → skip
        ├── |---|--- → TableBlock
        ├── - / 1. → ListBlock
        ├── NOISE patterns → skip（Corresponding authors 等）
        └── paragraph → TextBlock（tokenizeSentences 保護 $...$）
```

---

## 13. 型別變更總覽（types.ts）

```typescript
// FigureBlock：加 description
export type FigureBlock = {
  type: "figure"
  id: string
  src: string
  caption: string
  alt: string
  description?: string   // ← 新增
  width?: number
  height?: number
}

// PaperSection：加 collapsible, isReferences
export type PaperSection = {
  id: string
  title: string
  level: number
  blocks: ContentBlock[]
  collapsible?: boolean    // ← 新增，Acknowledgements 等
  isReferences?: boolean   // ← 新增，References section
}

// ParsedPaper：加 keywords, authorDetails
export type ParsedPaper = {
  paperId: string
  title: string
  authors: string[]              // 保留（向下相容）
  authorDetails?: AuthorDetail[] // ← 新增（PDF only）
  abstract: string
  journal?: string
  publishedDate?: string
  keywords?: string[]            // ← 新增
  sections: PaperSection[]
  figures: FigureBlock[]
  sourceType: "arxiv" | "pdf"
  arxivId?: string
  parsedAt: string
}

// 新增型別
export type AuthorDetail = {
  name: string
  affiliations: string[]
  isCorresponding: boolean
  equalContribution: boolean
}
```
