"""input/<게임>/ 에 넣은 자료(기획서 PDF·이미지·엑셀·글·게임 파일)를 TC 작성용으로 정리한다.

사용:
  python -I tools/prepare_input.py --game rotdl           # input/rotdl/ 정리 → input/rotdl/_입력정리.md
  python -I tools/prepare_input.py --list                 # 자료가 들어 있는 게임 폴더 목록

넣을 수 있는 것 (모두 무료 도구로 읽음, AI API 호출 없음)
  - 기획서 PDF  : pdftotext(무료)로 글자를 뽑는다. 여러 쪽에 반복되는 머리글을 빼고 내용 글자가 거의 없는 쪽(그림·플로우 차트·스캔)은
                  "직접 볼 쪽"으로 표시하고, PyMuPDF(무료)가 있으면 그 쪽을 그림(_pages/p001.png)으로 만들어 Claude Code가 보게 한다
  - 이미지      : png·jpg·gif·webp — 크기만 적고, Claude Code가 직접 본다(화면 캡처·UI 시안·와이어프레임)
  - 엑셀        : xlsx — 시트별 표를 글로 뽑는다. 머리글에 '기대'가 있는 시트는 '기존 TC'로 보고 TC 규칙 점검도 한다
  - 글          : md·txt·csv
  - 게임 파일   : html (또는 game.txt 안에 게임 html 경로 한 줄) → 있으면 '자동 테스트' 진행, 없으면 '문서 전용'(자동 테스트 건너뜀)

만드는 것: input/<게임>/_입력정리.md (TC를 쓰는 사람·AI가 읽는 정리본), input/<게임>/_입력정보.json (모드·파일 목록)
"""
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import INPUT_DIR, ROOT  # noqa: E402

KINDS = {
    "pdf": (".pdf",), "image": (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"),
    "xlsx": (".xlsx", ".xlsm"), "text": (".md", ".txt", ".csv"), "game": (".html", ".htm"),
}
LOW_TEXT = 40           # 머리글을 뺀 한 쪽 글자가 이보다 적으면 그림·스캔 쪽으로 본다
RENDER_ZOOM = 1.4       # 직접 볼 쪽을 그림으로 만들 때 배율
MAX_ROWS = 400          # 엑셀 시트마다 뽑을 최대 줄 수


def kind_of(name):
    ext = os.path.splitext(name)[1].lower()
    return next((k for k, exts in KINDS.items() if ext in exts), None)


def pdf_text(path):
    """쪽별 글자 목록. PyMuPDF(무료) → 없으면 pdftotext(무료) → 둘 다 없으면 None."""
    try:
        import pymupdf
        with pymupdf.open(path) as doc:
            return [pg.get_text() for pg in doc]
    except ImportError:
        pass
    exe = shutil.which("pdftotext") or next((c for c in (r"C:\Program Files\Git\mingw64\bin\pdftotext.exe",) if os.path.exists(c)), None)
    if not exe:
        return None
    out = subprocess.run([exe, "-layout", "-enc", "UTF-8", path, "-"], capture_output=True)
    text = out.stdout.decode("utf-8", errors="replace")
    pages = text.split("\f")
    if pages and not pages[-1].strip():
        pages = pages[:-1]
    return pages


def content_chars(pages):
    """쪽마다 '내용' 글자 수: 여러 쪽에 반복되는 줄(머리글·꼬리글)과 날짜·쪽 번호만 있는 줄은 뺀다."""
    import re
    from collections import Counter
    norm = lambda line: re.sub(r"\s+", " ", line).strip()                      # noqa: E731
    seen = Counter(x for t in pages for x in {norm(line) for line in t.splitlines() if norm(line)})
    common = {x for x, n in seen.items() if n >= max(3, len(pages) * 0.3)}
    filler = re.compile(r"^[\d\s/.\-]*$")                                       # 12/7/2025 9, 쪽 번호
    return [sum(len(norm(line)) for line in t.splitlines() if norm(line) and norm(line) not in common and not filler.match(norm(line)))
            for t in pages]


def render_pages(pdf_path, pages, out_dir):
    """PyMuPDF가 있으면 쪽을 png로 만든다. 만든 파일 경로 목록 (없으면 빈 목록)."""
    try:
        import pymupdf
    except ImportError:
        try:
            import fitz as pymupdf
        except ImportError:
            return []
    os.makedirs(out_dir, exist_ok=True)
    made = []
    with pymupdf.open(pdf_path) as doc:
        for n in pages:
            if 1 <= n <= len(doc):
                f = os.path.join(out_dir, f"p{n:03d}.png")
                doc[n - 1].get_pixmap(matrix=pymupdf.Matrix(RENDER_ZOOM, RENDER_ZOOM)).save(f)
                made.append(f)
    return made


def xlsx_dump(path):
    """[(시트, 줄 목록, TC 시트인지)]"""
    from openpyxl import load_workbook
    wb = load_workbook(path, data_only=True, read_only=True)
    out = []
    for ws in wb.worksheets:
        lines, is_tc = [], False
        for row in ws.iter_rows(values_only=True):
            vals = [str(v).replace("\n", " / ").strip() for v in row if v is not None and str(v).strip()]
            if not vals:
                continue
            if any("기대" in v or "expected" in v.lower() for v in vals):
                is_tc = True
            lines.append(" | ".join(vals))
            if len(lines) >= MAX_ROWS:
                lines.append(f"... ({MAX_ROWS}줄 넘음, 나머지는 원본 확인)")
                break
        out.append((ws.title, lines, is_tc))
    return out


def image_size(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return f"{im.width}×{im.height}"
    except Exception:
        return "크기 확인 못 함"


def game_target(folder, files):
    """게임 파일 경로(있으면). html 파일이 있거나 game.txt에 경로가 적혀 있으면 그 경로."""
    htmls = [f for f in files if kind_of(f) == "game"]
    if htmls:
        return os.path.join(folder, htmls[0])
    gt = os.path.join(folder, "game.txt")
    if os.path.exists(gt):
        p = open(gt, encoding="utf-8").read().strip().strip('"')
        if p and not os.path.isabs(p):
            p = os.path.normpath(os.path.join(ROOT, p))
        return p if p and os.path.exists(p) else None
    return None


def prepare(game):
    folder = os.path.join(INPUT_DIR, game)
    if not os.path.isdir(folder):
        sys.exit(f"자료 폴더가 없습니다: {folder}\n  → 폴더를 만들고 기획서·이미지·엑셀을 넣은 뒤 다시 실행하세요.")
    files = sorted(f for f in os.listdir(folder) if not f.startswith("_") and f != "game.txt" and os.path.isfile(os.path.join(folder, f)))
    target = game_target(folder, files)
    mode = "자동 테스트" if target else "문서 전용"
    md = [f"# {game} 입력 정리", "", "- 정리 도구: tools/prepare_input.py (자동 생성, 원본 자료가 바뀌면 다시 실행)",
          f"- 모드: **{mode}**" + (f" — 게임 파일 `{target}`" if target else " — 실행할 게임 파일이 없어 자동 테스트는 건너뛰고, TC 작성·검토·추가 제안까지만 한다"),
          "", "## 파일 목록", "", "| 파일 | 종류 | 메모 |", "|---|---|---|"]
    info = {"game": game, "mode": mode, "target": target, "files": [], "look_pages": {}, "images": [], "tc_sheets": []}
    body = []
    for f in files:
        p = os.path.join(folder, f)
        k = kind_of(f)
        memo = ""
        if k == "pdf":
            pages = pdf_text(p)
            if pages is None:
                memo = "pdftotext 없음 → PDF를 직접 열어 봐야 함"
                info["look_pages"][f] = "전체"
            else:
                low = [i + 1 for i, n in enumerate(content_chars(pages)) if n < LOW_TEXT]
                pngs = render_pages(p, low, os.path.join(folder, "_pages", os.path.splitext(f)[0][:40]))
                memo = f"{len(pages)}쪽, 글자 {sum(len(t) for t in pages):,}자" + (f", 내용이 그림인 쪽 {len(low)}개(직접 보기" + (f", 그림 {len(pngs)}장 만듦" if pngs else ", PyMuPDF 없으면 PDF를 직접 열어 볼 것") + ")" if low else "")
                if low:
                    info["look_pages"][f] = low
                    info.setdefault("page_images", {})[f] = [os.path.relpath(x, folder) for x in pngs]
                body += [f"## PDF: {f}", ""]
                for i, t in enumerate(pages, 1):
                    t = "\n".join(line.rstrip() for line in t.strip().splitlines() if line.strip())
                    body += [f"### {i}쪽" + (" (내용이 그림 — _pages 그림을 직접 볼 것)" if i in low else ""), "", "```", t or "(글자 없음)", "```", ""]
        elif k == "xlsx":
            sheets = xlsx_dump(p)
            tc_sheets = [s for s, _, tc in sheets if tc]
            memo = f"시트 {len(sheets)}개" + (f", 기존 TC 시트: {', '.join(tc_sheets)}" if tc_sheets else "")
            if tc_sheets:
                info["tc_sheets"].append(f)
            body += [f"## 엑셀: {f}", ""]
            for s, lines, tc in sheets:
                body += [f"### 시트: {s}" + (" (기존 TC)" if tc else ""), "", "```", *lines, "```", ""]
        elif k == "image":
            memo = image_size(p) + " → 직접 보고 화면 요소(버튼·문구·수치)를 뽑을 것"
            info["images"].append(f)
        elif k == "text":
            txt = open(p, encoding="utf-8", errors="replace").read()
            memo = f"글자 {len(txt):,}자"
            body += [f"## 글: {f}", "", "```", txt.strip(), "```", ""]
        elif k == "game":
            memo = "게임 파일 → 자동 테스트 대상"
        else:
            memo = "읽지 않는 형식 (pdf·png·jpg·xlsx·md·txt·csv·html만)"
        md.append(f"| {f} | {k or '기타'} | {memo} |")
        info["files"].append({"name": f, "kind": k, "memo": memo})
    if os.path.exists(os.path.join(folder, "game.txt")):
        md.append(f"| game.txt | 게임 경로 | {'찾음: ' + target if target else '적힌 경로에 파일이 없음'} |")
    md += ["", "## TC 작성 순서 (tc-writing 스킬)", "",
           "1. 이 정리본과 이미지·'직접 볼 쪽'을 읽고 TC 작성 규칙(044)대로 `tc/" + game + "_tc.json`을 쓴다 (coverage = 기획서 장·화면, covers 필수)",
           "2. 기존 TC 엑셀이 있으면 `existing_review`(고칠 점)와 `suggestions`(빠진 TC 추가 제안)를 JSON에 적는다 — 사용자 엑셀은 고치지 않는다",
           f"3. `python -I tools/qa_pipeline.py --game {game}` → 규칙 점검 · TC 엑셀 · (게임 파일이 있으면) 자동 테스트 · 검토 리포트", ""]
    with open(os.path.join(folder, "_입력정리.md"), "w", encoding="utf-8") as fp:
        fp.write("\n".join(md + body))
    with open(os.path.join(folder, "_입력정보.json"), "w", encoding="utf-8") as fp:
        json.dump(info, fp, ensure_ascii=False, indent=2)
    print(f"[{game}] 모드: {mode}")
    for x in info["files"]:
        print(f"  - {x['name']} ({x['kind'] or '기타'}) {x['memo']}")
    if info["look_pages"]:
        print("  직접 볼 PDF 쪽:", "; ".join(f"{k}: {v}" for k, v in info["look_pages"].items()))
    print(f"  정리본: {os.path.join(folder, '_입력정리.md')}")
    return info


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    if "--list" in args or "--game" not in args:
        names = sorted(d for d in os.listdir(INPUT_DIR) if os.path.isdir(os.path.join(INPUT_DIR, d))) if os.path.isdir(INPUT_DIR) else []
        print("자료 폴더:", ", ".join(names) or "(없음)", "\n사용: python -I tools/prepare_input.py --game <폴더 이름>")
        return
    prepare(args[args.index("--game") + 1])


if __name__ == "__main__":
    main()
