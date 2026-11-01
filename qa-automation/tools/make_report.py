"""Playwright 결과 + TC 목록으로 포트폴리오용 결과 리포트 HTML을 만든다.

사용:
  python -I tools/make_report.py                       # 슬라임 게임: out/results.json → report/slimegame_report.html
  python -I tools/make_report.py --game bloodfall      # BLOODFALL → report/bloodfall_report.html
  (기본 실행이면 tc/<게임>_TC.xlsx 의 결과 칸도 함께 갱신한다)
  python -I tools/make_report.py --results out/results_bugdemo.json --out report/slimegame_bugdemo.html --label "버그 심은 사본"
"""
import argparse
import datetime as dt
import html
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import GAMES, LABEL, ROOT, RESULTS_FILE, load_results, load_tcs, local_time, results_by_tc  # noqa: E402


def esc(s):
    return html.escape(str(s or ""))


def build(results_path, out_path, label, game="slimegame"):
    stats, rows = load_results(results_path, game)
    tcs = load_tcs(game)
    out_dir = os.path.dirname(out_path)
    asset_dir = os.path.join(out_dir, "assets")
    has_basis = any("basis" in tc for tc in tcs["automated"])

    by_tc = results_by_tc(rows)

    passed = sum(r["status"] == "passed" for r in rows)
    failed = [r for r in rows if r["status"] in ("failed", "timedOut")]
    auto_n = len(tcs["automated"])
    explore_n = sum(tc["id"].startswith("탐색") for tc in tcs["automated"])
    total_sec = sum(r["duration_ms"] for r in rows) / 1000

    tc_rows = []
    for tc in tcs["automated"]:
        r = by_tc.get(tc["id"])
        st = r["status"] if r else None
        basis = f"<td>{esc(tc.get('basis'))}</td>" if has_basis else ""
        tc_rows.append(
            f"<tr class='st-{st or 'none'}'><td>{esc(tc['id'])}</td><td>{esc(tc['title'])}</td>{basis}"
            f"<td class='res'>{LABEL.get(st, st)}</td><td>{(r['duration_ms'] / 1000 if r else 0):.1f}초</td>"
            f"<td>{esc(tc['review'])}</td></tr>")

    manual_rows = "".join(f"<tr><td>{esc(m['id'])}</td><td>{esc(m['reason'])}</td></tr>" for m in tcs["manual"])

    fail_blocks = []
    for i, r in enumerate(failed, 1):
        img = ""
        if r["screenshot"] and os.path.exists(r["screenshot"]):
            os.makedirs(asset_dir, exist_ok=True)
            name = f"{os.path.splitext(os.path.basename(out_path))[0]}_fail{i}.png"
            shutil.copyfile(r["screenshot"], os.path.join(asset_dir, name))
            img = f"<img src='assets/{name}' alt='실패 화면'>"
        first = "\n".join(r["error"].splitlines()[:8])
        fail_blocks.append(f"<div class='fail'><h3>{esc(r['title'])}</h3><pre>{esc(first)}</pre>{img}</div>")

    title = f"{esc(tcs['game'])} 자동 테스트 결과{(' — ' + esc(label)) if label else ''}"
    ratio = (f"{auto_n - explore_n} / {tcs['total_tc']}", f"자동화한 TC / 전체 TC{f' (+탐색 중 추가 {explore_n})' if explore_n else ''}")
    page = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
  :root {{ --bg:#f6f7f9; --card:#fff; --text:#1d2129; --muted:#6b7280; --line:#e5e7eb; --ok:#15803d; --bad:#b91c1c; --warn:#a16207; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --bg:#111418; --card:#1b1f25; --text:#e6e8eb; --muted:#9aa3ae; --line:#2b313a; --ok:#4ade80; --bad:#f87171; --warn:#facc15; }} }}
  body {{ margin:0; background:var(--bg); color:var(--text); font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif; line-height:1.5; }}
  main {{ max-width:1040px; margin:0 auto; padding:28px 16px 48px; }}
  h1 {{ font-size:22px; margin:0 0 4px; }} h2 {{ font-size:18px; margin:32px 0 10px; }}
  .sub, .note {{ color:var(--muted); font-size:14px; }}
  .cards {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin:18px 0; }}
  .card {{ background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 14px; }}
  .card b {{ display:block; font-size:24px; }} .card span {{ color:var(--muted); font-size:13px; }}
  table {{ width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:10px; overflow:hidden; font-size:14px; }}
  th, td {{ padding:8px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }}
  th {{ font-size:13px; color:var(--muted); }}
  .st-passed .res {{ color:var(--ok); font-weight:700; }} .st-failed .res, .st-timedOut .res {{ color:var(--bad); font-weight:700; }}
  .st-none .res, .st-skipped .res {{ color:var(--warn); }}
  .fail {{ background:var(--card); border:1px solid var(--bad); border-radius:10px; padding:12px 14px; margin-bottom:12px; }}
  .fail h3 {{ margin:0 0 8px; font-size:15px; }} pre {{ white-space:pre-wrap; font-size:12px; margin:0 0 8px; }}
  .fail img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }}
</style></head><body><main>
<h1>{title}</h1>
<div class="sub">실행: {esc(local_time(stats.get("startTime")))} · 도구: Playwright(Chromium) · 대상: {esc(tcs['target'])} · 리포트 생성: {dt.date.today()}</div>
<div class="cards">
  <div class="card"><b>{ratio[0]}</b><span>{ratio[1]}</span></div>
  <div class="card"><b>{len(rows)}</b><span>테스트 수 (TC 여러 개를 묶은 것 포함)</span></div>
  <div class="card"><b style="color:var(--ok)">{passed}</b><span>통과</span></div>
  <div class="card"><b style="color:var(--bad)">{len(failed)}</b><span>실패</span></div>
  <div class="card"><b>{total_sec:.0f}초</b><span>전체 실행 시간</span></div>
</div>
<p class="note">TC 출처: {esc(tcs['source_tc'])}</p>

<h2>실패 상세</h2>
{''.join(fail_blocks) or '<p class="note">실패한 테스트가 없습니다.</p>'}

<h2>자동화한 TC ({auto_n}건)</h2>
<p class="note">검토 칸: {esc(tcs['review_rule'])}</p>
<table><tr><th>TC</th><th>내용</th>{'<th>근거</th>' if has_basis else ''}<th>결과</th><th>시간</th><th>검토</th></tr>{''.join(tc_rows)}</table>

<h2>자동화하지 않은 TC와 이유</h2>
<table><tr><th>TC</th><th>이유</th></tr>{manual_rows}</table>
</main></body></html>
"""
    os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(page)
    return out_path, passed, len(failed)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", default="slimegame", choices=GAMES)
    ap.add_argument("--results", default=RESULTS_FILE)
    ap.add_argument("--out", default=None)
    ap.add_argument("--label", default="")
    a = ap.parse_args()
    out = a.out or os.path.join("report", f"{a.game}_report.html")
    path, ok, bad = build(a.results if os.path.isabs(a.results) else os.path.join(ROOT, a.results),
                          out if os.path.isabs(out) else os.path.join(ROOT, out), a.label, a.game)
    print(f"리포트 저장: {path} (통과 {ok}, 실패 {bad})")
    if a.results == RESULTS_FILE and a.out is None:   # 기본 실행이면 TC 엑셀의 결과 칸도 같이 갱신
        import export_tc_xlsx
        export_tc_xlsx.export(a.game)


if __name__ == "__main__":
    main()
