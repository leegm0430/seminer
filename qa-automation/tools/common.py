"""리포트·Jira 연동이 같이 쓰는 함수 — Playwright 결과(JSON)와 TC 목록 읽기."""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TC_FILE = os.path.join(ROOT, "tc", "slimegame_tc.json")
RESULTS_FILE = os.path.join(ROOT, "out", "results.json")
TC_ID_RE = re.compile(r"\[((?:공통|플레이|탐색)-\d+)\]")
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_tcs():
    return load_json(TC_FILE)


def iter_specs(suite):
    for spec in suite.get("specs", []):
        yield spec
    for child in suite.get("suites", []):
        yield from iter_specs(child)


def load_results(path=RESULTS_FILE):
    """테스트 하나당 {title, tc_ids, status, duration_ms, error, screenshot}"""
    data = load_json(path)
    rows = []
    for suite in data.get("suites", []):
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
