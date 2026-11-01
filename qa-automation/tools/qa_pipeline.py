"""TC JSON이 생긴 뒤의 나머지를 한 번에: 규칙 점검 → (게임 파일이 있으면) 자동 테스트·리포트 → TC 엑셀 → 검토 리포트.

사용:
  python -I tools/qa_pipeline.py --game rotdl              # 모드는 input/<게임>/_입력정보.json 또는 TC JSON의 target으로 판단
  python -I tools/qa_pipeline.py --game rotdl --no-test    # 게임 파일이 있어도 자동 테스트는 건너뜀

흐름 (TC 작성 규칙 044, tc-writing 스킬)
  1. input/<게임>/ 에 기획서·이미지·엑셀(·게임 파일) 넣기 → tools/prepare_input.py 로 정리
  2. Claude Code가 정리본을 읽고 tc/<게임>_tc.json 작성 (AI API 호출 없음 — 대화 안에서 씀)
  3. 이 스크립트: 게임 파일이 없으면 자동 테스트를 건너뛰고 TC 검토·추가 제안 리포트까지 만들고 끝낸다
결과: tc/<게임>_TC.xlsx, report/<게임>_review.md (+ 자동 테스트를 했으면 report/<게임>_report.html)
"""
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_tc  # noqa: E402
import export_tc_xlsx  # noqa: E402
from common import INPUT_DIR, RESULTS_FILE, ROOT, load_tcs  # noqa: E402

PORTFOLIO = os.path.dirname(ROOT)       # 01_포토폴리오 — TC JSON의 target 경로 기준


def input_info(game):
    p = os.path.join(INPUT_DIR, game, "_입력정보.json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


def resolve_target(tcs, info):
    """실행할 게임 파일 경로. 없으면 None."""
    for cand in ((info or {}).get("target"), tcs.get("target")):
        if not cand:
            continue
        p = cand if os.path.isabs(cand) else os.path.join(PORTFOLIO, cand)
        if os.path.exists(p) and p.lower().endswith((".html", ".htm")):
            return p
    return None


def run_tests(game):
    """playwright 실행 → 게임별 결과 복사 → 리포트. (통과, 실패)"""
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    subprocess.run([npx, "playwright", "test", f"tests/{game}.spec.js"], cwd=ROOT)   # --reporter를 붙이면 results.json이 안 써진다
    shutil.copyfile(RESULTS_FILE, os.path.join(ROOT, "out", f"results_{game}.json"))
    import make_report
    _, ok, bad = make_report.build(RESULTS_FILE, os.path.join(ROOT, "report", f"{game}_report.html"), "", game)
    return ok, bad


def rule_table(found, limit=10, with_sheet=False):
    out = []
    for rule, label in check_tc.RULES.items():
        hits = found.get(rule)
        if hits:
            ids = [f"{s}: {i}" if with_sheet else str(i) for s, i in hits]
            more = f" 외 {len(ids) - limit}건" if len(ids) > limit else ""
            out.append(f"| {rule} | {label} | {len(hits)} | {', '.join(ids[:limit])}{more} |")
    return out or ["| - | 걸린 곳 없음 | 0 | |"]


def write_review(game, tcs, info, mode, target, test_result, skip_reason):
    auto, manual = tcs["automated"], tcs["manual"]
    allt = auto + manual
    found = check_tc.check_rows(check_tc.rows_for_game(game))
    gaps = check_tc.coverage_gaps(game)
    if gaps:
        found["C3"] = gaps
    prio = Counter(t.get("priority", "") for t in allt)
    L = [f"# {tcs['game']} — TC 작성·검토 리포트", "",
         f"- 만든 날: {dt.date.today()} · 도구: tools/qa_pipeline.py (Claude Code가 쓴 TC JSON을 점검·정리)",
         f"- 모드: **{mode}**" + (f" — 게임 파일 `{target}`" if target else ""),
         f"- TC 출처: {tcs.get('source_tc', '')}", ""]
    if info:
        L += ["## 1. 넣은 자료", "", "| 파일 | 종류 | 메모 |", "|---|---|---|"]
        L += [f"| {f['name']} | {f['kind'] or '기타'} | {f['memo']} |" for f in info["files"]] + [""]
    L += ["## 2. 작성한 TC", "",
          f"- 전체 **{len(allt)}건** (자동 {len(auto)} · 수동 {len(manual)}) · 우선순위 " + ", ".join(f"{k} {v}" for k, v in prio.items() if k),
          f"- 엑셀: `tc/{game}_TC.xlsx` (첫 시트 표지, 검토 칸은 '초안' — 사람이 확인함/버림으로 바꾼다)", ""]
    cov = check_tc.coverage_table(game)
    if cov:
        L += ["| 근거 | 내용 | TC 수 |", "|---|---|---|"] + [f"| {i} | {n} | {k} |" for i, n, k in cov] + [""]
    L += ["## 3. 규칙 점검 (TC 작성 규칙 044, 기계 점검)", "", "| 규칙 | 내용 | 건수 | TC |", "|---|---|---|---|"] + rule_table(found) + [""]
    L += ["## 4. 자동 테스트", ""]
    if test_result:
        L += [f"- 실행함: 통과 {test_result[0]} · 실패 {test_result[1]} → `report/{game}_report.html`", ""]
    else:
        L += [f"- **건너뜀** — {skip_reason}", "- 대신 아래 5·6장(기존 TC 검토·추가 제안)으로 마무리했다.", ""]
    L += ["## 5. 기존 TC 검토", ""]
    sheets = (info or {}).get("tc_sheets", [])
    for f in sheets:
        rows = check_tc.rows_from_xlsx(os.path.join(INPUT_DIR, game, f))
        L += [f"### {f} — 기계 점검 ({len(rows)}줄)", "", "| 규칙 | 내용 | 건수 | 위치(시트: 번호) |", "|---|---|---|---|"]
        L += rule_table(check_tc.check_rows(rows), limit=8, with_sheet=True) + [""]
    if not sheets:
        L += ["- 넣은 자료에 기존 TC 엑셀이 없음", ""]
    rev = tcs.get("existing_review") or []
    if rev:
        L += ["### 사람 눈으로 본 검토 의견 (Claude Code 초안)", "", "| 위치 | 문제 | 고칠 방법 |", "|---|---|---|"]
        L += [f"| {r.get('where', '')} | {r.get('issue', '')} | {r.get('fix', '')} |" for r in rev] + [""]
    spec = tcs.get("spec_issues") or []
    if spec:
        L += ["### 기획서 확인 필요 (기획서 안에서 서로 다르거나 빠진 곳)", "", "| 위치 | 내용 | 확인할 것 |", "|---|---|---|"]
        L += [f"| {r.get('where', '')} | {r.get('issue', '')} | {r.get('ask', '')} |" for r in spec] + [""]
    sug = tcs.get("suggestions") or []
    L += ["## 6. 추가 제안 (기존 TC에 없던 것)", ""]
    if sug:
        L += ["| 제안 | 이유 | 해당 TC |", "|---|---|---|"]
        L += [f"| {s.get('title', '')} | {s.get('why', '')} | {s.get('tc', '')} |" for s in sug] + [""]
    else:
        L += ["- 없음", ""]
    L += ["## 7. 사람이 할 일", "",
          f"- `tc/{game}_TC.xlsx` 검토 칸을 '확인함/버림'으로 바꾸기 (AI 초안)",
          "- 5장 검토 의견 중 받아들일 것만 원본 TC 엑셀에 반영 (원본은 자동으로 고치지 않음)"]
    if not test_result:
        L.append(f"- 실행할 게임 파일이 생기면 `input/{game}/`에 html을 넣거나 `game.txt`에 경로를 적고 다시 실행 → 자동 테스트까지 진행")
    L.append("")
    path = os.path.join(ROOT, "report", f"{game}_review.md")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fp:
        fp.write("\n".join(L))
    return path


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    if "--game" not in args:
        sys.exit(__doc__)
    game = args[args.index("--game") + 1]
    if not os.path.exists(os.path.join(ROOT, "tc", f"{game}_tc.json")):
        sys.exit(f"tc/{game}_tc.json 이 없습니다. 먼저 Claude Code에 'input/{game} 자료로 TC 작성해줘'라고 요청하세요 (tc-writing 스킬).")
    tcs = load_tcs(game)
    info = input_info(game)
    target = resolve_target(tcs, info)
    mode = "자동 테스트" if target else "문서 전용"
    print(f"[{game}] 모드: {mode}")
    print("  1) " + check_tc.summary(game))

    test_result, skip = None, ""
    if not target:
        skip = "실행할 게임 파일이 없음 (input 폴더에 html 없음, game.txt 없음)"
    elif "--no-test" in args:
        skip = "--no-test 로 실행"
    elif not os.path.exists(os.path.join(ROOT, "tests", f"{game}.spec.js")):
        skip = f"테스트 코드(tests/{game}.spec.js)가 아직 없음 — Claude Code가 TC를 보고 작성한 뒤 다시 실행"
    else:
        print("  2) 자동 테스트 실행")
        test_result = run_tests(game)
    if skip:
        print(f"  2) 자동 테스트 건너뜀: {skip}")
    print("  3) TC 엑셀")
    export_tc_xlsx.export(game)
    print(f"  4) 검토 리포트: {write_review(game, tcs, info, mode, target, test_result, skip)}")


if __name__ == "__main__":
    main()
