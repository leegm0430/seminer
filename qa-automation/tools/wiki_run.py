"""규칙 위키로 TC를 읽어 html 게임을 자동 테스트한다. AI를 쓰지 않아 LLM 회사로 가는 것이 없다.

사용:
  python -I tools/wiki_run.py scan --game mygame --file 게임.html            # 화면 버튼을 wiki/mygame.md 에 채운다
  python -I tools/wiki_run.py run  --game mygame --file 게임.html --tc TC.xlsx   # 읽은 TC를 실행 → 리포트 + 못 읽은 줄 목록
  옵션:
    --parse-only     읽기만 하고 게임은 실행하지 않음 (읽은 비율 확인용)
    --jira           실패한 TC를 Jira에 버그로 등록 (없으면 등록하지 않음)
    --dry-run        --jira 와 함께: 보내지 않고 out/jira_dryrun.json 에만 저장
    --wiki 폴더       게임별 위키 폴더 (기본 wiki/)
    --out 폴더        결과 폴더 (기본 out/wiki/<게임>/)
TC는 엑셀(.xlsx) 또는 tc JSON(.json)이다. 위키에 없는 문장은 추측하지 않고 '못 읽음'으로 남긴다.

흐름: scan → run → 못읽은줄.md 를 보고 wiki/공통문장.md·wiki/<게임>.md 에 등록 → 다시 run
"""
import html
import json
import os
import re
import shutil
import subprocess
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_tc  # noqa: E402
from common import ROOT  # noqa: E402

WIKI_DIR = os.path.join(ROOT, "wiki")
COMMON = os.path.join(WIKI_DIR, "공통문장.md")
GAME_RE = re.compile(r"^[a-z0-9_-]{1,40}$")
SLOTS = {"버튼": r"(?P<버튼>[^\]]+?)", "문구": r"(?P<문구>[^\"]+?)", "값": r"(?P<값>[^\"]+?)", "N": r"(?P<N>\d+(?:\.\d+)?)"}
LABELS = {"passed": "통과", "failed": "실패", "weak": "판정 약함", "blocked": "조작 불가", "unread": "못 읽음"}


def clean(s):
    """비교용 문장: 따옴표 통일, 공백 정리, 끝 마침표 제거, 앞 번호 제거."""
    s = re.sub(r"[“”‘’'`]", '"', str(s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"^\d+[.)]\s*", "", s)
    return s.rstrip(". ").strip()


def tables(path):
    """마크다운 파일의 표 → {제목 또는 '': [[칸, ...], ...]} (머리글·구분 줄 제외)."""
    out, title = {}, ""
    if not os.path.exists(path):
        return out
    lines = open(path, encoding="utf-8").read().splitlines()
    i = 0
    while i < len(lines):
        ln = lines[i].strip()
        if ln.startswith("#"):
            title = ln.lstrip("# ").strip()
        elif ln.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[i + 1].strip()):
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                out.setdefault(title, []).append(cells)
                i += 1
            continue
        i += 1
    return out


class Wiki:
    def __init__(self, game, wiki_dir):
        self.path = os.path.join(wiki_dir, f"{game}.md")
        self.action_rules, self.check_rules = [], []
        for t in tables(COMMON).values():
            for row in t:
                if len(row) >= 3 and row[0] in ("조작", "판정"):
                    pat = re.compile("^" + re.sub(r"\\\{(버튼|문구|값|N)\\\}", lambda m: SLOTS[m.group(1)], re.escape(clean(row[1]))) + "$")
                    (self.action_rules if row[0] == "조작" else self.check_rules).append((pat, row[2]))
        t = tables(self.path)
        self.buttons = {check_tc.norm(r[0]): r[1].strip("`") for r in t.get("버튼", []) if len(r) >= 2 and r[0]}
        self.bundles = {check_tc.norm(clean(r[0])): r[1] for r in t.get("조작 묶음", []) if len(r) >= 2 and r[0]}
        self.checks = {check_tc.norm(clean(r[0])): r[1] for r in t.get("판정", []) if len(r) >= 2 and r[0]}

    def _action(self, spec, vals):
        """'클릭 {버튼} {N}번' + 값 → 실행기 동작. 버튼이 없으면 ValueError(이유)."""
        s = spec
        for k, v in vals.items():
            s = s.replace("{" + k + "}", v)
        if s == "없음":
            return None
        if s == "새로고침":
            return {"do": "reload", "sel": "", "value": "", "repeat": 1}
        m = re.match(r"^대기 (\d+(?:\.\d+)?)초$", s)
        if m:
            return {"do": "wait", "sel": "", "value": str(int(float(m.group(1)) * 1000)), "repeat": 1}
        m = re.match(r"^키 (.+)$", s)
        if m:
            return {"do": "press", "sel": "", "value": m.group(1), "repeat": 1}
        m = re.match(r"^입력 (.+?) (.+)$", s)
        if m:
            return {"do": "fill", "sel": self._button(m.group(1)), "value": m.group(2), "repeat": 1}
        m = re.match(r"^클릭 (.+?)(?: (\d+)번)?$", s)
        if m:
            return {"do": "click", "sel": self._button(m.group(1)), "value": "", "repeat": max(1, min(100, int(m.group(2) or 1)))}
        raise ValueError(f"위키의 동작을 이해할 수 없음: {s}")

    def _button(self, name):
        sel = self.buttons.get(check_tc.norm(name))
        if not sel:
            raise ValueError(f"버튼 사전에 없음: {name}")
        return sel

    def parse_action_line(self, line, depth=0):
        """조작 한 줄 → 동작 목록. 못 읽으면 ValueError(이유)."""
        c = clean(line)
        bundle = self.bundles.get(check_tc.norm(c))
        if bundle is not None and depth < 5:
            out = []
            for part in bundle.split(" / "):
                out += self.parse_action_line(part, depth + 1)
            return out
        for pat, spec in self.action_rules:
            m = pat.match(c)
            if m:
                a = self._action(spec, m.groupdict())
                return [a] if a else []
        raise ValueError("문장 사전에 없음")

    def parse_check(self, text):
        c = clean(text)
        spec = self.checks.get(check_tc.norm(c))
        vals = {}
        if spec is None:
            for pat, sp in self.check_rules:
                m = pat.match(c)
                if m:
                    spec, vals = sp, m.groupdict()
                    break
        if spec is None:
            raise ValueError("문장 사전에 없음")
        for k, v in vals.items():
            spec = spec.replace("{" + k + "}", v)
        kind, _, arg = spec.partition(" ")
        if kind == "보임":
            return {"kind": "text_visible", "text": arg}
        if kind == "안보임":
            return {"kind": "text_hidden", "text": arg}
        if kind in ("비활성", "활성"):
            return {"kind": "disabled" if kind == "비활성" else "enabled", "sel": self._button(arg)}
        raise ValueError(f"위키의 판정을 이해할 수 없음: {spec}")


def split_steps(text):
    parts = re.split(r"\n|→|->", str(text or ""))
    return [p.strip() for p in parts if p.strip()]


def split_pre(text):
    return [p.strip() for p in re.split(r"\n", str(text or "")) if p.strip()]


def load_rows(path):
    """TC 파일 → [{id, title, priority, cat1, cat2, pre, steps, expected}]. 시트마다 번호가 겹치면 시트 이름을 붙인다."""
    if path.lower().endswith(".json"):
        data = json.load(open(path, encoding="utf-8"))
        rows = [dict(t) for k in ("automated", "manual") for t in data.get(k, [])]
    else:
        rows, last = [], {}
        for r in check_tc.rows_from_xlsx(path):
            sheet = r.get("sheet", "")
            pre = r.get("pre") or last.get(sheet, "")      # 엑셀은 위 칸과 같은 사전 조건을 비워 두기도 한다(병합)
            last[sheet] = pre
            rows.append({**r, "pre": pre})
    rows = [r for r in rows if str(r.get("steps") or "").strip() and str(r.get("expected") or "").strip() and r.get("id")]
    n = Counter(str(r["id"]) for r in rows)
    for r in rows:
        r["id"] = f"{r.get('sheet', '')}-{r['id']}" if n[str(r["id"])] > 1 else str(r["id"])
    return rows


def build_plans(rows, wiki):
    plans, unread = [], Counter()
    samples, why = {}, {}
    per_tc = {}
    for r in rows:
        actions, problems = [], []
        for label, lines in (("사전 조건", split_pre(r.get("pre"))), ("조작", split_steps(r.get("steps")))):
            for line in lines:
                try:
                    actions += wiki.parse_action_line(line)
                except ValueError as e:
                    problems.append((label, line, str(e)))
        check = None
        try:
            check = wiki.parse_check(r.get("expected"))
        except ValueError as e:
            problems.append(("기대 결과", str(r.get("expected")), str(e)))
        if problems:
            per_tc[r["id"]] = problems
            for label, line, reason in problems:
                key = (label, clean(line))
                unread[key] += 1
                samples.setdefault(key, r["id"])
                why[key] = reason
        else:
            plans.append({"id": r["id"], "actions": actions, "check": check})
    return plans, per_tc, unread, samples, why


def run_node(*argv):
    node = shutil.which("node") or shutil.which("node.exe")
    if not node:
        sys.exit("node가 없습니다. Node.js가 필요합니다.")
    res = subprocess.run([node, os.path.join(ROOT, "tools", "local_runner.cjs"), *argv], cwd=ROOT)
    if res.returncode:
        sys.exit("실행기가 실패했습니다.")


def cmd_scan(game, target, wiki_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(wiki_dir, exist_ok=True)
    scan_path = os.path.join(out_dir, "_화면요소.json")
    run_node("scan", target, scan_path)
    scan = json.load(open(scan_path, encoding="utf-8"))
    path = os.path.join(wiki_dir, f"{game}.md")
    have = {check_tc.norm(r[0]) for r in tables(path).get("버튼", []) if r and r[0]} if os.path.exists(path) else set()
    new, used = [], set(have)
    for e in scan["elements"]:
        name = (e["text"] or e["sel"]).replace("|", " ").strip()
        key = check_tc.norm(name)
        if key and key not in used:
            used.add(key)
            new.append(f"| {name} | `{e['sel']}` |")
    if not os.path.exists(path):
        body = [f"# {game} 위키", "", "TC 문장을 이 게임의 화면과 연결합니다. 이름은 TC에 쓴 이름과 같아야 합니다. 같은 버튼을 다른 이름으로 쓰면 줄을 더합니다.", "",
                "## 버튼", "", "| 이름 | 화면 요소 |", "|---|---|", *new, "",
                "## 조작 묶음", "", "여러 조작이나 사전 조건을 한 문장으로 등록합니다. 조작은 ` / `로 나눕니다.", "",
                "| 문장 | 조작 |", "|---|---|", "", "## 판정", "", "기대 결과 문장을 판정으로 바꿉니다. 예: `보임 성장 게이지: 50%`", "",
                "| 기대 결과 | 판정 |", "|---|---|", ""]
        open(path, "w", encoding="utf-8").write("\n".join(body))
    elif new:
        lines = open(path, encoding="utf-8").read().splitlines()
        at = next(i for i, x in enumerate(lines) if x.strip() == "|---|---|")   # 첫 표가 버튼 표
        lines[at + 1:at + 1] = new
        open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"[{game}] 버튼 {len(new)}개 등록 · canvas {scan['canvas']}개 → {path}")
    if scan["canvas"]:
        print("  canvas 안의 내용은 위키로 판정할 수 없습니다. 화면의 글자·버튼만 판정합니다.")


def write_unread(path, game, unread, samples, why, total, readable):
    L = [f"# {game} 못 읽은 줄", "", f"- TC {total}건 중 {readable}건을 읽었습니다.",
         "- 많이 나오는 줄부터 등록하면 효과가 큽니다. 문장 유형은 `wiki/공통문장.md`, 이 게임 고유 내용은 게임 위키에 등록합니다.",
         "- 사람이 눈으로 봐야 하는 문장은 등록하지 말고 수동 TC로 둡니다.", "",
         "| 횟수 | 종류 | 줄 | 이유 | 예 |", "|---|---|---|---|---|"]
    for (label, line), n in unread.most_common():
        L.append(f"| {n} | {label} | {line.replace('|', ' ')[:120]} | {why[(label, line)]} | {samples[(label, line)]} |")
    open(path, "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_report(path, game, rows, status, detail, shots, unread_n, blocked):
    e = html.escape
    count = Counter(status.values())
    tiles = "".join(f"<div class='tile {k}'><b>{count.get(k, 0)}</b>{LABELS[k]}</div>" for k in LABELS)
    body = []
    for r in rows:
        st = status[r["id"]]
        img = f"<br><img src='screenshots/{e(shots[r['id']])}' alt='실패 화면'>" if shots.get(r["id"]) else ""
        body.append(f"<tr class='{st}'><td>{e(str(r['id']))}</td><td>{e(str(r.get('pre') or ''))}</td><td>{e(str(r.get('steps') or ''))}</td>"
                    f"<td>{e(str(r.get('expected') or ''))}</td><td class='r'>{LABELS[st]}</td><td>{e(detail.get(r['id'], ''))}{img}</td></tr>")
    page = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>{e(game)} 위키 자동 테스트</title><style>
body{{font-family:"Malgun Gothic",system-ui,sans-serif;margin:24px;color:#1d2129;line-height:1.5}}
.tiles{{display:flex;gap:10px;margin:16px 0}}.tile{{border:1px solid #ddd;border-radius:6px;padding:8px 18px;text-align:center}}.tile b{{display:block;font-size:24px}}
table{{border-collapse:collapse;width:100%;font-size:14px}}th,td{{border:1px solid #ddd;padding:6px 8px;vertical-align:top;text-align:left;white-space:pre-line}}th{{background:#f3f4f6}}
.passed .r{{color:#15803d;font-weight:700}}.failed .r{{color:#b91c1c;font-weight:700}}.weak .r,.blocked .r{{color:#a16207;font-weight:700}}.unread .r{{color:#6b7280}}img{{max-width:420px;margin-top:6px;border:1px solid #ddd}}
</style></head><body><h1>{e(game)} — 위키 자동 테스트</h1>
<p>AI 없이 위키 규칙으로 TC를 읽었습니다. 게임의 외부 요청 {blocked}건을 막았습니다. 못 읽은 줄 {unread_n}종은 <code>못읽은줄.md</code>에 있습니다.</p>
<div class="tiles">{tiles}</div>
<table><tr><th>번호</th><th>사전 조건</th><th>테스트 내용</th><th>기대 결과</th><th>결과</th><th>설명</th></tr>{''.join(body)}</table></body></html>"""
    open(path, "w", encoding="utf-8").write(page)


def send_jira(game, target, rows, status, detail, shots, shot_dir, dry):
    import jira_sync
    jira = jira_sync.Jira(dry_run=dry)
    state = jira_sync.load_state()
    try:
        rel = os.path.relpath(target, os.path.dirname(ROOT))
    except ValueError:                     # 게임 파일이 다른 드라이브에 있으면 상대 경로가 없다
        rel = os.path.basename(target)
    tcs = {"game": game, "target": rel}
    made = again = 0
    for r in rows:
        if status[r["id"]] != "failed":
            continue
        title = f"[위키 {game}] [{r['id']}] {r.get('title') or clean(r.get('expected'))[:50]}"
        res = {"title": title, "tc_ids": [str(r["id"])], "error": detail.get(r["id"], ""), "screenshot": None}
        shot = os.path.join(shot_dir, shots[r["id"]]) if shots.get(r["id"]) else None
        prev = state["bugs"].get(title)
        if prev:
            jira.comment(prev, f"위키 자동 테스트에서 다시 실패했습니다.\n{{noformat}}\n{res['error']}\n{{noformat}}")
            again += 1
            continue
        summary, desc = jira_sync.bug_report(res, {**r, "title": r.get("title") or r["id"]}, tcs, game, "", [])
        key = jira.create("bug", summary, desc, ["auto-qa", game, "초안", "wiki"])
        if shot and os.path.exists(shot):
            jira.attach(key, shot)
        state["bugs"][title] = key
        made += 1
    jira_sync.save_state(state, jira)
    jira.save_dryrun()
    print(f"[{game}] Jira: 새 버그 {made}건 · 다시 실패 댓글 {again}건" + (" (드라이런)" if jira.dry_run else ""))


def describe(check):
    kind = {"text_visible": "문구가 보여야 함", "text_hidden": "문구가 안 보여야 함", "disabled": "비활성이어야 함", "enabled": "활성이어야 함"}[check["kind"]]
    return f"판정: {check.get('text') or check.get('sel')} — {kind}. 실제: 그렇지 않음"


def cmd_run(game, target, tc_path, wiki_dir, out_dir, parse_only, jira, dry):
    wiki = Wiki(game, wiki_dir)
    rows = load_rows(tc_path)
    plans, per_tc, unread, samples, why = build_plans(rows, wiki)
    os.makedirs(out_dir, exist_ok=True)
    write_unread(os.path.join(out_dir, "못읽은줄.md"), game, unread, samples, why, len(rows), len(plans))
    print(f"[{game}] TC {len(rows)}건 · 읽음 {len(plans)}건 · 못 읽음 {len(per_tc)}건 · 못 읽은 줄 {len(unread)}종")
    if parse_only:
        return
    if not target:
        sys.exit("--file 에 게임 html을 쓰세요.")
    plan_path = os.path.join(out_dir, "plan.json")
    json.dump(plans, open(plan_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    res_path = os.path.join(out_dir, "results.json")
    shot_dir = os.path.join(out_dir, "screenshots")
    run_node("run", target, plan_path, res_path, shot_dir)
    res = json.load(open(res_path, encoding="utf-8"))
    by = {x["id"]: x for x in res["results"]}
    plan_by = {p["id"]: p for p in plans}
    status, detail, shots = {}, {}, {}
    for r in rows:
        i = r["id"]
        if i in by:
            status[i], shots[i] = by[i]["status"], by[i]["screenshot"]
            detail[i] = describe(plan_by[i]["check"]) if by[i]["status"] == "failed" else by[i]["detail"]
        else:
            status[i] = "unread"
            detail[i] = " · ".join(f"{a}: {c}" for a, _, c in per_tc[i])
    write_report(os.path.join(out_dir, "report.html"), game, rows, status, detail, shots, len(unread), res.get("blocked", 0))
    c = Counter(status.values())
    print(f"[{game}] " + " · ".join(f"{LABELS[k]} {c.get(k, 0)}" for k in LABELS) + f" · 막은 외부 요청 {res.get('blocked', 0)}건")
    print(f"  결과: {out_dir} (report.html, 못읽은줄.md)")
    if jira:
        send_jira(game, target, rows, status, detail, shots, shot_dir, dry)


def arg(args, name, default=None):
    return args[args.index(name) + 1] if name in args else default


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    cmd = args[0] if args else ""
    game = arg(args, "--game", "")
    if cmd not in ("scan", "run") or not GAME_RE.match(game):
        sys.exit(__doc__)
    target = arg(args, "--file")
    if target and not os.path.isfile(target):
        sys.exit(f"게임 파일이 없습니다: {target}")
    target = os.path.abspath(target) if target else None
    wiki_dir = os.path.abspath(arg(args, "--wiki", WIKI_DIR))
    out_dir = os.path.abspath(arg(args, "--out", os.path.join(ROOT, "out", "wiki", game)))
    if cmd == "scan":
        if not target:
            sys.exit("--file 에 게임 html을 쓰세요.")
        cmd_scan(game, target, wiki_dir, out_dir)
        return
    tc_path = arg(args, "--tc", os.path.join(ROOT, "tc", f"{game}_tc.json"))
    if not os.path.isfile(tc_path):
        sys.exit(f"TC 파일이 없습니다: {tc_path}")
    cmd_run(game, target, tc_path, wiki_dir, out_dir, "--parse-only" in args, "--jira" in args, "--dry-run" in args)


if __name__ == "__main__":
    main()
