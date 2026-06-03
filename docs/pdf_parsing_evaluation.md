# PDF 本地解析引擎評估與技術方案選擇 (PDF Parsing Evaluation & Engine Selection)

本文件針對 Council 專案目前採用的 PDF 解析架構進行調研與評估，對比 **現有本地 PyMuPDF 方案**、**Marker（本地）** 以及 **Docling（IBM, 本地）** 的效能、資源消耗量與複雜度，並提出最適合本專案的本地端優化整合方案。

---

## 1. 目前專案的 PDF 解析現狀與痛點

目前專案的 PDF 處理流程如下：
* **Ingestion 階段 ([paper-ingest.ts](file:///d:/council/src/lib/paper-ingest.ts))**：先透過輕量級的 `pdf-parse` 套件快速提取純文字並切片進行 RAG Embedding，隨後非同步打 Marker API (Datalab.to) 獲取高品質 Markdown，再用語意匹配算法將二者對齊。
* **Reader 階段 ([pdf-parser.ts](file:///d:/council/src/lib/reader/pdf-parser.ts))**：呼叫本地 Python 腳本 [pdf_extract.py](file:///d:/council/scripts/pdf_extract.py)（基於 PyMuPDF/fitz），透過 XY-Cut 垂直走廊檢測與手寫座標規則處理雙欄排序及圖表裁剪。

### 主要痛點
1. **本地 Marker 運行速度極慢**：Marker 包含多個基於 PyTorch 的深度學習模型（LayoutLMv3、YOLOv8/Texify、EasyOCR）。在沒有配置 NVIDIA GPU/CUDA 的本機環境下，模型在 CPU 上進行矩陣運算，導致單頁解析時間高達 **10~30 秒**，整篇論文常需數分鐘以上。
2. **對齊演算法脆弱**：`pdf-parse` 與 Marker API 產生的文字流格式有落差，在 `paper-ingest.ts` 中以首尾字串正則匹配的方式容易失誤，導致 RAG 區塊與 Markdown 錨點的對齊成功率低。
3. **PyMuPDF 手寫規則維護成本高**：[pdf_extract.py](file:///d:/council/scripts/pdf_extract.py) 中的 XY-Cut 幾何排序演算法需要人工微調邊界，對於非標準的學術雙欄佈局（如 Elsevier、IEEE 等）容易出現解析順序錯亂。

---

## 2. 三種本地解析技術對比

下表對比了適合 Council 專案的本地解析技術：

| 評估維度 | 1. 現有的 PyMuPDF 方案<br>(`pdf_extract.py`) | 2. Marker (本地運行) | 3. Docling (IBM, 本地運行) |
| :--- | :--- | :--- | :--- |
| **運算速度 (CPU)**| ⚡ **極快**<br>(每頁 < 0.5 秒，整篇 1~3 秒) | 🐢 **極慢**<br>(每頁約 10 ~ 30 秒) | 🛵 **中等偏慢**<br>(每頁約 2 ~ 8 秒，比 Marker 快數倍) |
| **公式解析 (LaTeX)**| ❌ **無能力** (符號破碎) | 🏆 **極強** (還原度高) | 🥈 **強** (能輸出 LaTeX 公式) |
| **雙欄佈局排序** | ⚠️ **普通/易出錯** (依賴座標規則) | 🏆 **極佳** (LayoutLM 語意排序) | 🏆 **極佳** (DocLayNet 佈局模型) |
| **資源消耗 (CPU/RAM)**| 🟢 **極低** (~50MB) | 🔴 **極高** (需加載多個 PyTorch 模型) | 🟡 **中等** (~1.5GB, 使用 ONNX 優化) |
| **本機部署難度** | 🟢 **極低** (pymupdf) | 🔴 **高** (PyTorch, CUDA, OCR 版本衝突) | 🟡 **中等** (安裝簡單，內建 ONNX runtime) |

---

## 3. 為什麼本機 Docling 效能優於 Marker？

在同樣沒有配置 GPU（純 CPU 運算）的本機環境下，Docling 的解析效率顯著優於 Marker，主因如下：
1. **模型格式與推理引擎優化**：IBM Docling 將佈局分析與表格模型預設轉換為 **ONNX 格式**，並採用 `onnxruntime` 推理。ONNX 針對 CPU 矩陣運算做了深度優化，效能與記憶體管理皆優於原生的 PyTorch。
2. **記憶體佔用小**：Docling 加載模型所需的記憶體（RAM）較小，且原生支援多執行緒限制與分頁流式處理，較不易導致系統卡頓或 OOM。

---

## 4. 專案融入與最佳化整合方案 (Refined Integration Strategy)

為了兼顧「使用者上傳的**即時性**」與「RAG 解析的**高品質**」，建議採取以下雙軌整合方案：

```
上傳 PDF 論文
  │
  ├──► [快速預覽軌道] ──► 執行 pdf_extract.py (PyMuPDF) ──► 1秒內生成 HTML 重排版面 (可進行句子 Hover)
  │
  └──► [背景精細化軌道] ──► 執行 Docling (輕量配置) ──► 10秒內生成高品質 Markdown ──► 進行 Markdown Chunking ──► 寫入 RAG
```

### 1) 快速預覽軌道（保留 PyMuPDF 體驗）
保留現有的 [pdf_extract.py](file:///d:/council/scripts/pdf_extract.py) 的執行路徑。因為使用者無法忍受上傳 PDF 後等待十幾秒才能看見預覽。PyMuPDF 的即時解析能保證用戶在一秒內進入閱讀器介面。

### 2) 背景精細化軌道（引入輕量配置的 Docling）
當論文成功入庫後，在背景任務中調用 Docling。為避免 CPU 過載並提升解析速度，我們可以**關閉不必要的模型**（如不需要圖片分類、不要跑重度 OCR 等）：

```python
# 示例：輕量化配置 Docling (scripts/docling_light_extract.py)
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

# 1. 關閉重度 OCR 與圖片標註，僅保留版面分析與表格結構
pipeline_options = PdfPipelineOptions()
pipeline_options.do_ocr = False               # 若 PDF 已有文字層，關閉 OCR 可加快數倍
pipeline_options.do_table_structure = True    # 保留高質量的三線表解析

# 2. 初始化轉換器
converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
    }
)
```

### 3) 實施「同源 Markdown Chunking」重構 RAG
將 [paper-ingest.ts](file:///d:/council/src/lib/paper-ingest.ts) 修改為：背景的 Docling 輸出 Markdown 後，直接將此 Markdown 進行分塊（Chunking），而非使用 pdf-parse。
* **好處**：RAG 儲存的每一個區塊本身即是標準 Markdown（包含正確的標題層級與 LaTeX 公式），且能**原生自帶精準定位錨點**，徹底解決了目前專案利用首尾正則匹配對齊失敗的痛點。
