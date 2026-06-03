#!/usr/bin/env python3
"""
pdf_extract.py — Extract text blocks and images from a PDF using PyMuPDF.
Usage: python scripts/pdf_extract.py <pdf_path> <output_images_dir>
Output: JSON to stdout
"""

import sys
import json
import os
import re
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print(json.dumps({"error": "PyMuPDF not installed. Run: pip install pymupdf"}))
    sys.exit(1)

# Common academic section names (order matters: more specific first)
_SECTION_RE = re.compile(
    r"^(\d+[\.\s]+|[ivxlcdm]+[\.\s]+)?"  # optional numbering: "1.", "1 ", "ii."
    r"(abstract|introduction|background|related\s+work|"
    r"methods?|methodology|experimental(\s+section)?|materials?\s*(and\s*methods?)?|"
    r"results?(\s+and\s+discussion)?|discussion|"
    r"conclusion|summary|future\s+work|"
    r"references|bibliography|acknowledgements?|appendix|supplementary)",
    re.IGNORECASE,
)

# PyMuPDF span flags
_FLAG_SUPERSCRIPT = 1   # bit 0
_FLAG_BOLD        = 16  # bit 4

_CAPTION_RE = re.compile(
    r"^(fig(?:ure)?s?\.?\s*[\d]+|table\s*[\d]+|scheme\s*[\d]+|chart\s*[\d]+)",
    re.IGNORECASE,
)


def _find_col_gutter(text_els: list, page_width: float) -> float:
    """
    XY-Cut: find the vertical gutter between columns using X-projection gap analysis.
    Scans sorted X intervals for the largest gap in the middle 60% of the page.
    Falls back to page midpoint if no clear gutter is found.
    """
    if len(text_els) < 3:
        return page_width / 2

    intervals = sorted((e["bbox"][0], e["bbox"][2]) for e in text_els)
    lo = page_width * 0.2
    hi = page_width * 0.8

    best_gap = 0.0
    best_gutter = page_width / 2
    sweep_x = intervals[0][1]

    for x0, x1 in intervals[1:]:
        if x0 > sweep_x:
            mid = (x0 + sweep_x) / 2
            if lo <= mid <= hi:
                gap = x0 - sweep_x
                if gap > best_gap:
                    best_gap = gap
                    best_gutter = mid
        sweep_x = max(sweep_x, x1)

    # Require at least a 1% gap to count as a real gutter
    return best_gutter if best_gap >= page_width * 0.01 else page_width / 2


def _is_two_column(text_els: list, page_width: float) -> bool:
    """True if a clear column gutter exists and both sides have content."""
    if len(text_els) < 4:
        return False
    gutter = _find_col_gutter(text_els, page_width)
    if gutter == page_width / 2:
        # No real gap found — fall back to original width-based heuristic
        narrow = page_width * 0.55
        left  = sum(1 for e in text_els if (e["bbox"][2] - e["bbox"][0]) < narrow and (e["bbox"][0] + e["bbox"][2]) / 2 <  gutter)
        right = sum(1 for e in text_els if (e["bbox"][2] - e["bbox"][0]) < narrow and (e["bbox"][0] + e["bbox"][2]) / 2 >= gutter)
    else:
        left  = sum(1 for e in text_els if (e["bbox"][0] + e["bbox"][2]) / 2 <  gutter)
        right = sum(1 for e in text_els if (e["bbox"][0] + e["bbox"][2]) / 2 >= gutter)
    return left >= 2 and right >= 2


def _sort_two_col(page_els: list, page_width: float, is_page_one: bool = False) -> list:
    """
    Reading order for a 2-column page.
    Uses XY-Cut gutter detection: elements are classified by center-X vs gutter,
    not by width — so wide asymmetric columns (e.g. Elsevier) are handled correctly.
    Full-width elements (physically spanning the gutter) are placed before/between/after columns.
    
    [Abstract-Watershed Fix] For page 1, we identify the bottom coordinate of the Abstract
    and treat everything above/including it as a full-width header block to prevent it
    from being sorted after the Introduction column.
    """
    text_els = [e for e in page_els if e["type"] == "text"]
    gutter = _find_col_gutter(text_els, page_width)

    # Find the lowest bottom-Y (y1) of any block containing "abstract" near its start on Page 1
    abstract_y1 = None
    if is_page_one:
        for el in page_els:
            if el["type"] == "text":
                text_lower = el.get("text", "").lower().strip()
                if "abstract" in text_lower[:50]:
                    y1 = el["bbox"][3]
                    if abstract_y1 is None or y1 > abstract_y1:
                        abstract_y1 = y1

    left, right, full = [], [], []
    for el in page_els:
        x0, y0, x1, y1 = el["bbox"]
        cx = (x0 + x1) / 2
        
        # If Page 1 and the block sits above or is part of the abstract, force it to 'full'
        if is_page_one and abstract_y1 is not None and y1 <= abstract_y1 + 5:
            full.append(el)
            continue

        # Full-width: element physically spans the gutter (with 3pt tolerance)
        if x0 < gutter - 3 and x1 > gutter + 3:
            full.append(el)
        elif cx < gutter:
            left.append(el)
        else:
            right.append(el)

    left.sort(key=lambda e: e["y"])
    right.sort(key=lambda e: e["y"])
    full.sort(key=lambda e: e["y"])

    if not left or not right:
        return sorted(page_els, key=lambda e: e["y"])

    first_col_y = min(left[0]["y"], right[0]["y"])
    last_col_y  = max(left[-1]["y"], right[-1]["y"])

    pre  = [e for e in full if e["y"] <= first_col_y]
    mid_ = [e for e in full if first_col_y < e["y"] < last_col_y]
    post = [e for e in full if e["y"] >= last_col_y]

    return pre + left + mid_ + right + post


def _sort_reading_order(elements: list) -> list:
    """Sort all elements in reading order, per-page with 2-column awareness."""
    pages: dict = {}
    for el in elements:
        p = el["page"]
        if p not in pages:
            pages[p] = []
        pages[p].append(el)

    result = []
    for page_num in sorted(pages.keys()):
        page_els = pages[page_num]
        page_width = page_els[0].get("pageWidth", 612)
        text_els = [e for e in page_els if e["type"] == "text"]

        if _is_two_column(text_els, page_width):
            result.extend(_sort_two_col(page_els, page_width, is_page_one=(page_num == 1)))
        else:
            result.extend(sorted(page_els, key=lambda e: e["y"]))

    return result



def extract_pdf(pdf_path: str, images_dir: str) -> dict:
    doc = fitz.open(pdf_path)
    os.makedirs(images_dir, exist_ok=True)

    elements = []
    seen_image_xrefs = set()

    for page_num in range(len(doc)):
        page = doc[page_num]
        page_width = page.rect.width
        page_height = page.rect.height

        # ── Text blocks ───────────────────────────────────────────────────────
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

        for block in blocks:
            if block["type"] != 0:
                continue

            lines_text = []
            font_sizes = []
            bold_spans = 0
            total_spans = 0

            for line in block.get("lines", []):
                line_text = ""
                for span in line.get("spans", []):
                    # Skip superscript spans (citation numbers, footnote marks)
                    if span.get("flags", 0) & _FLAG_SUPERSCRIPT:
                        continue
                    text = span.get("text", "")
                    line_text += text
                    size = span.get("size", 12)
                    font_sizes.append(size)
                    total_spans += 1
                    if span.get("flags", 0) & _FLAG_BOLD:
                        bold_spans += 1
                if line_text.strip():
                    lines_text.append(line_text)

            full_text = " ".join(lines_text).strip()
            if not full_text or len(full_text) < 2:
                continue

            # Skip blocks that are purely numeric/punctuation leftovers
            if re.fullmatch(r"[\d\s,\.\[\]\(\)\-–—]+", full_text) and len(full_text) < 8:
                continue

            avg_size = sum(font_sizes) / len(font_sizes) if font_sizes else 12
            is_bold = total_spans > 0 and (bold_spans / total_spans) >= 0.7
            bbox = block["bbox"]

            elements.append({
                "type": "text",
                "page": page_num + 1,
                "text": full_text,
                "fontSize": round(avg_size, 1),
                "isBold": is_bold,
                "bbox": bbox,
                "x": bbox[0],
                "y": bbox[1],
                "pageWidth": page_width,
                "pageHeight": page_height,
            })

        # ── Images ────────────────────────────────────────────────────────────
        # Build xref→bbox map from get_image_info(xrefs=True) for this page
        xref_to_bbox: dict = {}
        for info in page.get_image_info(xrefs=True):
            xref_val = info.get("xref")
            if xref_val:
                xref_to_bbox[xref_val] = list(info["bbox"])

        for img_info in page.get_images(full=True):
            xref = img_info[0]
            if xref in seen_image_xrefs:
                continue
            seen_image_xrefs.add(xref)

            # Skip images not actually placed on this page
            if xref not in xref_to_bbox:
                continue

            # Skip running-header images on pages 2+ (top margin zone)
            img_bbox = xref_to_bbox[xref]
            if page_num > 0 and img_bbox[1] < page_height * 0.12:
                continue

            try:
                img_data = doc.extract_image(xref)
            except Exception:
                continue

            if not img_data or not img_data.get("image"):
                continue

            w, h = img_data.get("width", 0), img_data.get("height", 0)
            if w < 60 or h < 60:
                continue

            ext = img_data.get("ext", "png")
            filename = f"img_{page_num + 1}_{xref}.{ext}"
            with open(os.path.join(images_dir, filename), "wb") as f:
                f.write(img_data["image"])

            bbox = xref_to_bbox[xref]
            elements.append({
                "type": "image",
                "page": page_num + 1,
                "filename": filename,
                "width": w,
                "height": h,
                "bbox": bbox,
                "x": bbox[0],
                "y": bbox[1],
                "pageWidth": page_width,
                "pageHeight": page_height,
            })

    # Sort by page, respecting 2-column layout when detected
    elements = _sort_reading_order(elements)

    # Compute median font size from text blocks
    text_sizes = [e["fontSize"] for e in elements if e["type"] == "text"]
    median_size = sorted(text_sizes)[len(text_sizes) // 2] if text_sizes else 12

    # Assign heading roles
    for el in elements:
        if el["type"] != "text":
            continue
        size = el["fontSize"]
        is_bold = el.get("isBold", False)
        text = el["text"].strip()

        if size >= median_size * 1.4:
            el["role"] = "heading1"
        elif size >= median_size * 1.15:
            el["role"] = "heading2"
        elif is_bold and _SECTION_RE.match(text) and len(text) < 80:
            el["role"] = "heading1"
        elif _CAPTION_RE.match(text):
            el["role"] = "caption"
        else:
            el["role"] = "paragraph"

    doc.close()
    return {
        "elements": elements,
        "pageCount": len(doc) if not doc.is_closed else page_num + 1,
        "medianFontSize": round(median_size, 1),
    }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: pdf_extract.py <pdf_path> <images_dir>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    images_dir = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    try:
        result = extract_pdf(pdf_path, images_dir)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
