# Marker Parser 重設計分析

基於 `uploads/reader-debug/vIJ9jSjDgMZR1qu8Yxpla/marker-raw.md` 的實際結構分析。

---

## 1. Raw Data 完整結構圖

```
──────────────────────────────────────────────
[PRE-TITLE ZONE]  ← 全部丟掉
──────────────────────────────────────────────
![Elsevier logo](xxx_img.jpg)
Elsevier logo

![CEJ journal cover](xxx_img.jpg)
CEJ journal cover

![Check for updates icon](xxx_img.jpg)
Check for updates icon
──────────────────────────────────────────────
[TITLE]           ← 第一個 # h1
──────────────────────────────────────────────
# CuO/PVA-based ultra-low-volume oral H<sub>2</sub>S detection system...
──────────────────────────────────────────────
[AUTHORS LINE]    ← 緊接在 # 之後的那一行
──────────────────────────────────────────────
Moumita Deb<sup>a,i,1</sup>, Chang-Chuan Huang<sup>b,1</sup>, Yen-Ming Lai<sup>a</sup>, ...
──────────────────────────────────────────────
[AFFILIATION LINES]  ← <sup>x</sup> 開頭的段落
──────────────────────────────────────────────
<sup>a</sup> Department of Photonics, National Yang Ming Chiao Tung University, 300093, Hsinchu, Taiwan
<sup>b</sup> Department of Electrical Engineering, National Tsing Hua University, 300044, Hsinchu, Taiwan
<sup>c</sup> College of Dentistry, National Yang Ming Chiao Tung University, 112304, Taipei, Taiwan
<sup>d</sup> ULVAC TAIWAN INC., 300092, Hsinchu, Taiwan
<sup>e</sup> Department of Physics, National Yang Ming Chiao Tung University, 300093, Hsinchu, Taiwan
<sup>f</sup> Université de Haute-Alsace, CNRS, IS2M UMR 7361, F-68100, Mulhouse, France
<sup>g</sup> Université de Strasbourg, F-67081, Strasbourg, France
<sup>h</sup> Department of Chemistry, National Taiwan Normal University, 10610, Taipei, Taiwan
<sup>i</sup> Institute of Pioneer Semiconductor Innovation, ...
──────────────────────────────────────────────
[## ARTICLE INFO]  ← 要 skip 或另存 keywords
──────────────────────────────────────────────
## ARTICLE INFO

### Keywords:
Low-volume oral H<sub>2</sub>S gas
Extractor sampling
CuO/PVA
CaCl<sub>2</sub> filter
Clinical tongue coating effect
──────────────────────────────────────────────
[## ABSTRACT]     ← 提取為 abstract，不進 sections
──────────────────────────────────────────────
## ABSTRACT
Hydrogen sulfide (H<sub>2</sub>S), a key volatile biomarker...
──────────────────────────────────────────────
[BODY SECTIONS]   ← 正文
──────────────────────────────────────────────
## 1. Introduction
## 2. Experimental section
### 2.1. Sensor fabrication
#### 2.2.1. Traditional high-volume sensing system
...
──────────────────────────────────────────────
[FIGURE BLOCK PATTERN]  ← 每張圖的固定格式
──────────────────────────────────────────────
![long AI alt text describing the figure](xxx_img.jpg)
                                               ← 空行
Figure 5 consists of four subplots...          ← Marker AI 描述段落（paragraph）
- (a) Volume effect:...                        ← 或是 list items
- (b) Gas concentration effect:...
                                               ← 空行
Figure 5: [verbatim copy of alt text]          ← alt text 的完整複製（要 skip）
                                               ← 空行
**Fig. 5.** Double-tube system 2: (a) Volume   ← 論文原本的 caption（要用這個）
effect – real-time dynamic response...
                                               ← 空行
fixed condition in the following tests.        ← 正文繼續
──────────────────────────────────────────────
[TAIL SECTIONS]   ← 全部 skip
──────────────────────────────────────────────
## CRediT authorship contribution statement
## Declaration of competing interest
## Acknowledgements
## Appendix A. Supplementary data
## Data availability
## References
```

---

## 2. 作者解析邏輯

### Raw 格式

```
# Title (h1)                                ← 第一個 h1
                                            ← 空行
Moumita Deb<sup>a,i,1</sup>, Chang-Chuan   ← 作者行（HTML superscript）
                                            ← 空行
<sup>a</sup> Department of Photonics...     ← 機構行，以 <sup>x</sup> 開頭
<sup>b</sup> Department of Electrical...
```

### 解析規則

**Step 1：找作者行**
- 位置：在 `# Title` 之後、第一個 `## ABSTRACT` 或 `## ARTICLE INFO` 之前
- 特徵：不是 `<sup>` 開頭，不是空行，包含 `<sup>` 在文字中間（affiliation 標記）
- 範例：`Moumita Deb<sup>a,i,1</sup>, Chang-Chuan Huang<sup>b,1</sup>, ...`

**Step 2：解析作者名單**
```
正則：strip <sup>.*?</sup>，然後 split(", ")
輸出：["Moumita Deb", "Chang-Chuan Huang", "Yen-Ming Lai", ...]
```

**Step 3：解析作者的機構標記（affiliation keys）**
```
正則：<sup>(a,i,1)</sup> → keys = ["a", "i", "1"]
過濾掉純數字（"1", "2" 是 equal contribution，不是 affiliation）
保留字母 key：["a", "i"]
```

**Step 4：找機構行**
- 特徵：以 `<sup>x</sup>` 開頭（單個字母或數字）
- 正則：`/^<sup>([a-z\d]+)<\/sup>\s+(.+)/i`
- 建立 map：`{ a: "Department of Photonics, NYCU...", b: "...", ... }`

**Step 5：組合作者物件**
```typescript
type Author = {
  name: string
  affiliationKeys: string[]      // ["a", "i"]
  affiliations: string[]         // ["Department of Photonics...", "Institute of..."]
  equalContribution?: boolean    // 有 "1" 或 "2"
}
```

---

## 3. FigureBlock 新結構

### 現有結構

```typescript
export type FigureBlock = {
  type: "figure"
  id: string
  src: string
  caption: string      // 現在是 alt text（錯誤）
  alt: string
  width?: number
  height?: number
}
```

### 新結構（建議）

```typescript
export type FigureBlock = {
  type: "figure"
  id: string
  src: string
  caption: string        // **Fig. N.** — 論文原本的 caption（concise）
  alt: string            // AI 生成的長描述（accessibility 用）
  description?: string   // Marker AI 描述段落的全文（供 UI 顯示/檢查）
  width?: number
  height?: number
}
```

### Raw 中三種文字的對應關係

| Raw 內容 | 對應欄位 | 說明 |
|---------|---------|------|
| `![alt text](img.jpg)` 的 alt | `alt` | Marker 生成，詳細描述圖片內容 |
| `Figure 5 consists of four subplots...` | `description` | Marker 生成，更完整的文字描述 |
| `Figure 5: [alt text verbatim]` | 丟掉 | 就是 alt text 的重複 |
| `**Fig. 5.** Double-tube system...` | `caption` | 論文原本的 caption，用這個 |

---

## 4. 要 Skip 的 Section 列表

```typescript
const SKIP_SECTIONS = /^(
  references?|
  credit|
  cr[eé]dit\s+authorship|
  declaration\s+of\s+competing|
  acknowledgements?|
  appendix|
  supplementary\s+data|
  data\s+availability|
  article\s+info|
  keywords?
)$/ix
```

---

## 5. Column Break 合併（mergeFragmentedParagraphs）

### 現有邏輯
前一段不以 `.!?:` 結尾 → 合併

### Raw 中的 Column Break 範例

```
# Raw line 87-89（跨欄）：
"...monitored via"
""
"a flow meter..."
```
→ 前段結尾是 `via`（不是 `.!?:`），已可合併 ✓

```
# Raw line 93-94：
"...transport channel for"
""
"the analyte gas..."
```
→ 前段結尾是 `for`，已可合併 ✓

```
# Raw line 73-75：
"demonstrated oral $\text{H}_2\text{S}$ clinical trials and confirmed the tongue coating effect..."
""
"demonstrated oral $\text{H}_2\text{S}$ clinical trials..."
```
→ 這兩段不是斷行，是 Marker 重複輸出（第二段是同樣的內容）→ 需要去重？

### 可能需要擴充的情況
- 前段結尾是 `)` 或 `]`（公式結尾） → 也應該合併
- 前段結尾是 `]` 如 `[43].` → 已有 `.` 所以不會合併（正確）

**建議**：把條件改成「前段結尾**不是**完整句子結尾」，完整句子結尾 = `.!?:` 後面跟空格或結束。

---

## 6. 新 Parser 流程（重寫方案）

```
parsePdfViaMarkerAPI(buffer, paperId, filename)
  │
  ├── callMarkerAPI() → { markdown, images }
  ├── saveMarkerImages() → imageUrlMap
  ├── writeFile(debug/marker-raw.md)
  │
  └── markdownToParsedPaper(markdown, imageUrlMap, paperId, filename)
        │
        ├── [Step 1] 找第一個 # h1 的位置 → 切掉 pre-title zone
        │
        ├── [Step 2] 提取 metadata
        │     ├── title: 第一個 # h1 的文字（strip HTML）
        │     ├── authors: h1 之後的作者行（strip <sup>，split ","）
        │     ├── affiliations: <sup>x</sup> 開頭的行 → map
        │     └── authorObjects: 作者 + 對應機構
        │
        ├── [Step 3] 找 ## ABSTRACT → 提取 abstract 文字
        │
        ├── [Step 4] buildSections(lines after abstract)
        │     ├── 遇到 ## heading → new section
        │     ├── 遇到 SKIP_SECTIONS → 整個 section 跳過
        │     └── 每個 section → parseBlocks()
        │
        └── [Step 5] parseBlocks(lines)
              ├── $$...$$ → MathBlock
              ├── ```...``` → CodeBlock
              ├── ![](img) → FigureBlock（新 lookahead：找 **Fig.**）
              ├── |---|--- → TableBlock
              ├── - / 1. → ListBlock
              └── paragraph → TextBlock（tokenizeSentences，保護 $...$）
```

---

## 7. 待決定事項

- [ ] `description` 欄位：UI 上如何顯示？折疊在 caption 下面？還是 hover 展開？
- [ ] `Author` 型別：加到 `ParsedPaper` 還是保留 `authors: string[]`（向下相容）？
- [ ] Keywords：是否加到 `ParsedPaper.keywords?: string[]`？
- [ ] `## ARTICLE INFO` 裡的 keywords 要不要存？

---

## 8. 型別變更摘要

```typescript
// types.ts 需要的改動

// FigureBlock：加 description
export type FigureBlock = {
  type: "figure"
  id: string
  src: string
  caption: string      // **Fig. N.** 原文 caption
  alt: string          // Marker AI long alt text
  description?: string // Marker AI 描述段落（可 undefined）
}

// ParsedPaper：可選擴充
export type ParsedPaper = {
  ...現有欄位...
  keywords?: string[]           // 從 ARTICLE INFO 提取
  authorDetails?: AuthorDetail[] // 如果決定做完整 author 解析
}

// 新增（若決定實作）
export type AuthorDetail = {
  name: string
  affiliationKeys: string[]
  affiliations: string[]
  equalContribution: boolean
}
```
