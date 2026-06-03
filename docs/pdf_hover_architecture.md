# PDF 高畫質重排渲染與句子級 Hover 互動整合方案設計 (PDF Reflow Rendering & Sentence Hover AI Integration)

本設計文檔旨在為專案提供一套**基於 HTML 重排渲染（Reflow Rendering）**的論文閱讀與 AI 互動架構。
我們致力於解決 PDF 轉換成網頁時常見的「**排版跑版、雙欄順序錯亂、數學公式破碎、圖表錯置**」等痛點，同時完美融入**句子級 Hover 選單與 AI 上下文感知**功能。

---

## 1. 核心技術架構 (Core Architecture)

重排渲染的核心優勢在於能提供如電子書般的極致流暢閱讀體驗。為了徹底解決排版與互動問題，我們採用以下四大核心技術模組：

```
+---------------------------------------------------------------------------------------+
|  Parsed PDF (Marker API / Local Python)                                               |
|  ├── Text & Equations  -->  Parsed to LaTeX/KaTeX  --> HTML Spans (Hoverable)         |
|  └── Figures & Tables   -->  PyMuPDF BBox Clip     --> Image Anchors <img>             |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
|  Frontend Reader Layout (responsive columns: grid / columns-2)                         |
|  +---------------------------------------+  +---------------------------------------+ |
|  |  [Column 1]                           |  |  [Column 2]                           | |
|  |  The quick brown fox jumps over...    |  |  This is a seamless multi-column      | |
|  |  [span: sentence_1] (Hovered!)        |  |  reading experience.                  | |
|  |  +--------------------+               |  |                                       | |
|  |  | Hover AI Popover   |               |  |  +---------------------------------+  | |
|  |  | [解釋] [質疑] [提問] |               |  |  | Cropped Table Image <img>       |  | |
|  |  +--------------------+               |  |  +---------------------------------+  | |
|  +---------------------------------------+  +---------------------------------------+ |
+---------------------------------------------------------------------------------------+
```

---

## 2. 論文排版四大優化方案 (Layout Optimization Schemes)

### 方案一：淘汰手寫規則，升級為 Document AI 佈局引擎 (Marker)
手寫的幾何投影規則（如雙欄比例切分）容易在遇到跨欄圖表、居中公式時崩潰。
*   **作法**：整合專案現有的 [paper-ingest.ts](file:///d:/council/src/lib/paper-ingest.ts) 中的 **Marker API** (或於本地部署 `marker` / `nougat` python 庫)。
*   **優勢**：
    1.  利用佈局模型（LayoutLM）先進行**版面分析（Layout Analysis）**，識別出段落、標題、公式與圖表。
    2.  將複雜數學公式精準轉化為 LaTeX 語法（例如 `$$...$$`），表格轉化為 Markdown Table。
    3.  保證輸出擁有 100% 正確的「閱讀故事線」Markdown。

### 方案二：輕量級幾何解析演算法升級 (XY-Cut 遞迴投影)
如果必須在 Python 本地進行輕量快速解析，需改造 [pdf_extract.py](file:///d:/council/scripts/pdf_extract.py) 的雙欄排序演算法：
*   **作法**：使用經典的 **XY-Cut（遞迴投影切分演算法）**。
    1.  **水平/垂直空白投影**：分析頁面文字區塊的投影特徵，精確定位雙欄中間的「垂直走廊」（Gutter）。
    2.  **區塊成組（Block Clustering）**：在排序前，將物理距離極近、字型樣式一致的文字行合併為一個**語義段落區塊（Semantic Block）**。
    3.  **先打包再排序**：以段落為單位進行左右欄排序，徹底避免「左欄的句子穿插到右欄」的混亂排序現象。

### 方案三：圖表與表格的「混合視覺裁剪」 (Hybrid Visual Cropping)
科學論文中的「三線表（Table）」與「科學插圖（Figure）」若用純 HTML 渲染，格式極易散架。
*   **作法**：
    1.  後端 PyMuPDF 解析到 `type: "image"` 或 `role: "table"` 時，獲取其 `bbox: [x0, y0, x1, y1]`。
    2.  利用 PyMuPDF 裁切功能將該區域直接輸出成高解析度圖片：
        ```python
        page = doc[page_num]
        pix = page.get_pixmap(clip=fitz.Rect(x0, y0, x1, y1), dpi=200)
        pix.save(f"uploads/reader-images/{paper_id}/crop_{block_id}.png")
        ```
    3.  前端重排渲染時，遇到此 Block 直接以圖片 `<img>` 方式嵌入。
*   **優勢**：保證圖表與表格 100% 還原 PDF 原貌，免去 HTML 渲染崩潰的痛苦。

### 方案四：CSS 響應式佈局與公式防護 (CSS Columns & Math Guard)
*   **CSS Columns 排版**：利用 CSS 多欄屬性，在寬螢幕上模擬 PDF 的「雙欄報紙排版」，在窄螢幕（手機）上自動退化為單欄，兼顧大器排版與行動端響應：
    ```css
    .academic-reflow-content {
      column-count: 2;
      column-gap: 2.5rem;
      column-rule: 1px solid var(--border);
    }
    @media (max-width: 1024px) {
      .academic-reflow-content {
        column-count: 1;
      }
    }
    ```
*   **公式滾動防護**：限制長公式的寬度，確保不會撐開整個網頁：
    ```css
    .katex-display {
      overflow-x: auto;
      max-width: 100%;
      padding: 0.5rem 0;
    }
    ```

---

## 3. 數據模型與解析器升級 (Types & Parser Alterations)

為了在 HTML 重排中實現「句子 Hover」，我們需要在前端數據中將段落分詞，並保留對應語境。

### [MODIFY] [src/lib/reader/types.ts](file:///d:/council/src/lib/reader/types.ts)
```typescript
// 確保 Sentence 與 TextBlock 支援基礎屬性，方便渲染
export type Sentence = {
  id: string
  text: string
  startChar: number
  endChar: number
}

export type TextBlock = {
  type: "paragraph"
  id: string
  text: string
  sentences: Sentence[]
  isCropImage?: boolean   // [NEW] 標記該區塊是否為原圖裁切（如複雜表格/圖表）
  cropSrc?: string        // [NEW] 裁切圖片的伺服器路徑
}
```

---

## 4. 前端渲染與 Hover 融入機制 (Frontend Reflow & Hover Sync)

重排下的 Hover 實作非常單純，我們可以在 [text-block.tsx](file:///d:/council/src/components/reader/text-block.tsx) 中直接透過事件代理與絕對定位氣泡完美融入。

### [MODIFY] [src/components/reader/text-block.tsx](file:///d:/council/src/components/reader/text-block.tsx)

```tsx
"use client"

import { useState, useRef } from "react"
import type { TextBlock } from "@/lib/reader/types"
import { HoverAIPopover } from "./hover-ai-popover"

interface Props {
  block: TextBlock
  paperId: string
}

export function TextBlockView({ block, paperId }: Props) {
  // 追蹤當前滑鼠懸停的句子與其螢幕位置
  const [hovered, setHovered] = useState<{
    sentenceId: string
    text: string
    rect: DOMRect
  } | null>(null)

  const paraRef = useRef<HTMLParagraphElement>(null)

  // 1. [NEW] 處理複雜表格或圖表直接渲染裁切好的高解析度原圖
  if (block.isCropImage && block.cropSrc) {
    return (
      <div className="my-6 flex flex-col items-center gap-2">
        <img 
          src={block.cropSrc} 
          alt="Paper Visual Anchor" 
          className="rounded border border-border shadow-md max-w-full h-auto object-contain hover:shadow-lg transition-shadow"
        />
      </div>
    )
  }

  // 2. 處理事件代理以監測滑鼠懸停
  function handleMouseOver(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.dataset.sentenceId) return
    const rect = target.getBoundingClientRect()
    setHovered({
      sentenceId: target.dataset.sentenceId,
      text: target.textContent ?? "",
      rect,
    })
  }

  function handleMouseLeave() {
    setHovered(null)
  }

  return (
    <div className="relative mb-4 group/para">
      {/* 行動響應式的論文重排段落 */}
      <p
        ref={paraRef}
        className="text-sm leading-8 text-foreground/90 tracking-wide text-justify"
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
      >
        {block.sentences.map((s) => (
          <span
            key={s.id}
            data-sentence-id={s.id}
            className="cursor-pointer transition-all duration-150 rounded px-0.5 hover:bg-yellow-100/60 dark:hover:bg-yellow-950/40 hover:text-foreground"
          >
            {s.text}{" "}
          </span>
        ))}
      </p>

      {/* 3. 當使用者 Hover 句子時，無縫在滑鼠處彈出 AI 氣泡 */}
      {hovered && (
        <HoverAIPopover
          paperId={paperId}
          blockId={block.id}
          sentenceId={hovered.sentenceId}
          selectedText={hovered.text}
          context={block.text} // 提供整段落作為 AI 的推理脈絡
          rect={hovered.rect}
        />
      )}
    </div>
  )
}
```

---

## 5. 後端處理流：AI 智能問答與脈絡結合 (Backend prompt Flow)

當使用者點擊 Hover Popover 的「解釋」或「質疑」時，前端打包句子並呼叫後端 API：

```typescript
// POST /api/reader/ask
// 後端將接收到的 sentence 和前後文段落拼接，確保 AI 具備「精確語義感知」：

const prompt = [
  `You are helping a researcher read the paper "${paper.title}".`,
  ``,
  `The researcher is hovering over and focusing on the following sentence:`,
  `"${selectionText}"`,
  ``,
  `Surrounding Paragraph Context for better comprehension:`,
  `${context}`,
  ``,
  `Question: ${question}`,
  ``,
  `Answer in 2–4 sentences. Keep your tone precise, scholarly, and objective.`,
].join("\n")
```

---

## 6. Migration Checklist (給 claudecode 的執行指南)

1.  **整合 Markdown 渲染**：引入 `react-markdown` 與 `rehype-katex`，支援 LaTeX 解析。
2.  **升級 Python 裁切邏輯**：在 [pdf_extract.py](file:///d:/council/scripts/pdf_extract.py) 中，對於 Tables 和 Figures，利用 PyMuPDF `get_pixmap(clip=...)` 裁剪為圖片，儲存在 `uploads/reader-images` 資料夾下，並設定 `isCropImage: true` 及 `cropSrc` 返回。
3.  **啟用多欄排版**：在重排閱讀器外層包裹一個容器，配置 CSS `column-count: 2`（或使用 CSS grid 分欄），提供類似原裝 PDF 閱讀的優雅左右排版。
4.  **對齊 TextBlockView 渲染**：將更新後的 `TextBlockView` 程式碼套用至專案，啟用 Hover 事件代理，綁定 `<HoverAIPopover>`。
