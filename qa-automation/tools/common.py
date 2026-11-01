"""리포트·Jira 연동이 같이 쓰는 함수 — Playwright 결과(JSON)와 TC 목록 읽기."""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS_FILE = os.path.join(ROOT, "out", "results.json")
GAMES = ("slimegame", "bloodfall")   # tc/<게임>_tc.json, tests/<게임>.spec.js
TC_ID_RE = re.compile(r"\[((?:공통|플레이|탐색|BF)-\d+)\]")


def game_arg(argv, default="slimegame"):
    """명령줄에서 --game <이름> 을 읽는다."""
    if "--game" in argv:
        g = argv[argv.index("--game") + 1]
        if g not in GAMES:
            raise SystemExit(f"--game 은 {', '.join(GAMES)} 중 하나")
        return g
    return default
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_tcs(game="slimegame"):
    return load_json(os.path.join(ROOT, "tc", f"{game}_tc.json"))


def iter_specs(suite):
    for spec in suite.get("specs", []):
        yield spec
    for child in suite.get("suites", []):
        yield from iter_specs(child)


def load_results(path=RESULTS_FILE, game=None):
    """테스트 하나당 {title, tc_ids, status, duration_ms, error, screenshot}. game을 주면 그 게임의 테스트 파일 결과만."""
    data = load_json(path)
    rows = []
    for suite in data.get("suites", []):
        if game and os.path.basename(suite.get("file") or suite.get("title", "")) != f"{game}.spec.js":
            continue
        for spec in iter_specs(suite):
            for t in spec.get("tests", []):
                r = (t.get("results") or [{}])[-1]
                err = ANSI_RE.sub("", (r.get("error") or {}).get("message", "")).strip()
                shot = next((a.get("path") for a in r.get("attachments", [])
                             if a.get("name") == "screenshot" and a.get("path")), None)
                rows.append({
                    "title": spec["title"],
                    "tc_ids": TC_ID_RE.findall(spec["title"]),
                    "status": r.get("status", "skipped"),
                    "duration_ms": r.get("duration", 0),
                    "error": err,
                    "screenshot": shot,
                })
    return data.get("stats", {}), rows


RANK = {"failed": 3, "timedOut": 3, "interrupted": 2, "skipped": 1, "passed": 0}
LABEL = {"passed": "통과", "failed": "실패", "timedOut": "시간 초과", "skipped": "건너뜀", "interrupted": "중단", None: "미실행"}


def results_by_tc(rows):
    """TC 번호 → 테스트 결과. TC 하나가 여러 테스트에 걸리면 가장 나쁜 결과를 쓴다."""
    by_tc = {}
    for r in rows:
        for tc in r["tc_ids"]:
            cur = by_tc.get(tc)
            if cur is None or RANK.get(r["status"], 0) > RANK.get(cur["status"], 0):
                by_tc[tc] = r
    return by_tc


def load_jira_state():
    """jira_sync.py가 기록한 이슈 키 {tcs: {TC번호: 키}, bugs: {테스트 이름: 키}}. 없으면 빈 값."""
    path = os.path.join(ROOT, "out", "jira_state.json")
    return load_json(path) if os.path.exists(path) else {"tcs": {}, "bugs": {}}


def local_time(iso):
    """Playwright의 UTC 시각(2026-11-01T01:25:00.000Z)을 이 PC 시간대로 바꿔 'YYYY-MM-DD HH:MM'으로."""
    import datetime as dt
    if not iso:
        return dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    t = dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return t.astimezone().strftime("%Y-%m-%d %H:%M")


def load_dotenv():
    """qa-automation/.env 를 읽어 환경 변수로 넣는다(이미 있는 값은 덮어쓰지 않음). .env는 git에 올리지 않는다."""
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
