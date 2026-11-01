"""QA 자동화 실행 화면 (내 PC 전용 작은 서버 + web/index.html)

사용: QA자동화_화면.bat 더블클릭  (또는 python -I tools/web_ui.py)
  → http://127.0.0.1:8765 이 브라우저로 열린다. 이 창(검은 창)을 닫으면 화면도 멈춘다.

안전장치
  - 127.0.0.1에서만 받는다(같은 와이파이의 다른 기기도 접속 못 함). Host 머리글도 확인한다.
  - 실행은 정해진 동작(테스트·자료 정리·마무리·규칙 점검·Jira 등록)만. 게임 이름은 영문 소문자·숫자·_- 만 받는다.
  - 다른 사이트가 몰래 버튼을 누르지 못하게 POST에는 X-QA-UI 머리글이 있어야 한다.
  - Jira 토큰은 .env에만 있고 화면으로 보내지 않는다.
파이썬 표준 라이브러리만 사용 (추가 설치 없음).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

ROOT = common.ROOT
WEB = os.path.join(ROOT, "web")
NAME_RE = re.compile(r"^[a-z0-9_-]{1,40}$")
UPLOAD_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".xlsx", ".xlsm", ".md", ".markdown", ".txt", ".csv", ".html", ".htm"}
ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
PY = [sys.executable, "-I", "-X", "utf8"]
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
         ".md": "text/plain; charset=utf-8", ".png": "image/png", ".json": "application/json; charset=utf-8",
         ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}


def games():
    """tc/<게임>_tc.json 이 있는 게임 (실행 중 새로 생긴 것도 잡히게 매번 다시 찾는다)."""
    tc_dir = os.path.join(ROOT, "tc")
    keys = sorted(f[:-8] for f in os.listdir(tc_dir) if f.endswith("_tc.json"))
    return sorted(keys, key=lambda k: (k != "slimegame", k))


# ---------------------------------------------------------------- 작업 실행 (한 번에 하나)

class Job:
    def __init__(self):
        self.lock = threading.Lock()
        self.reset("", [])

    def reset(self, title, steps):
        self.title, self.steps, self.lines, self.done, self.code, self.started = title, steps, [], False, None, time.time()

    def busy(self):
        return bool(self.title) and not self.done

    def start(self, title, steps):
        with self.lock:
            if self.busy():
                return False
            self.reset(title, steps)
        threading.Thread(target=self._run, daemon=True).start()
        return True

    def log(self, text):
        self.lines.append(ANSI.sub("", text.rstrip("\r\n")))

    def _run(self):
        env = {k: v for k, v in os.environ.items() if k != "FORCE_COLOR"}
        env.update(PYTHONIOENCODING="utf-8", NO_COLOR="1")
        code = 0
        for label, step in self.steps:
            self.log(f"===== {label} =====")
            if callable(step):
                try:
                    step(self.log)
                except Exception as e:      # 화면에 보이게만 하고 다음 단계는 하지 않는다
                    self.log(f"오류: {e}")
                    code = 1
                    break
                continue
            p = subprocess.Popen(step, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env,
                                 text=True, encoding="utf-8", errors="replace")
            for line in p.stdout:
                self.log(line)
            p.wait()
            if p.returncode:
                self.log(f"(끝난 코드 {p.returncode})")
                code = p.returncode
        self.log("===== 끝 =====")
        self.code, self.done = code, True


JOB = Job()


def npx(*args):
    exe = shutil.which("npx") or shutil.which("npx.cmd") or "npx"
    return ["cmd", "/c", exe, *args] if os.name == "nt" else [exe, *args]


def copy_results(game):
    def f(log):
        if os.path.exists(common.RESULTS_FILE):
            shutil.copyfile(common.RESULTS_FILE, os.path.join(ROOT, "out", f"results_{game}.json"))
            log(f"결과 파일 보관: out/results_{game}.json")
    return f


def restore_results(game):
    def f(log):
        src = os.path.join(ROOT, "out", f"results_{game}.json")
        if not os.path.exists(src):
            raise RuntimeError(f"{game} 테스트 결과가 없습니다. 먼저 테스트를 실행하세요.")
        shutil.copyfile(src, common.RESULTS_FILE)
    return f


def plan(action, game):
    """(제목, 단계 목록) 또는 오류 문구"""
    if action == "check":
        return "TC 규칙 점검", [("모든 게임 TC 점검", PY + ["tools/check_tc.py", "--all"])]
    if not NAME_RE.match(game or ""):
        return "게임 이름은 영문 소문자·숫자·_-만 쓸 수 있어요 (예: mygame)."
    has_tc = os.path.exists(os.path.join(ROOT, "tc", f"{game}_tc.json"))
    has_spec = os.path.exists(os.path.join(ROOT, "tests", f"{game}.spec.js"))
    if action == "test":
        if not has_spec:
            return f"tests/{game}.spec.js 가 없어 자동 테스트를 할 수 없어요."
        return f"[{game}] 자동 테스트", [("1/2 자동 테스트 실행", npx("playwright", "test", f"tests/{game}.spec.js")),
                                       ("결과 보관", copy_results(game)),
                                       ("2/2 리포트·TC 엑셀 갱신", PY + ["tools/make_report.py", "--game", game])]
    if action == "prepare":
        if not os.path.isdir(os.path.join(common.INPUT_DIR, game)):
            return f"input/{game} 폴더에 자료가 없어요. 먼저 파일을 올리세요."
        return f"[{game}] 자료 정리", [("자료 정리", PY + ["tools/prepare_input.py", "--game", game])]
    if action == "pipeline":
        if not has_tc:
            return f"tc/{game}_tc.json 이 없어요. 먼저 자료를 정리하고 Claude Code에 'input/{game} 자료로 TC 작성해줘'라고 요청하세요."
        return f"[{game}] TC 마무리", [("규칙 점검 · (게임 있으면) 자동 테스트 · TC 엑셀 · 검토 리포트", PY + ["tools/qa_pipeline.py", "--game", game])]
    if action == "jira":
        if not has_tc:
            return f"tc/{game}_tc.json 이 없어요."
        return f"[{game}] Jira 버그 등록", [("이 게임 결과 불러오기", restore_results(game)),
                                          ("실패한 테스트를 Jira 버그로", PY + ["tools/jira_sync.py", "bugs", "--game", game])]
    return "모르는 동작이에요."


# ---------------------------------------------------------------- 상태

def game_status(g):
    t = common.load_tcs(g)
    st = {"key": g, "name": t.get("game", g), "auto": len(t["automated"]), "manual": len(t["manual"]),
          "testable": os.path.exists(os.path.join(ROOT, "tests", f"{g}.spec.js")),
          "files": {}, "result": None, "review_items": sum(len(t.get(k) or []) for k in ("existing_review", "spec_issues", "suggestions"))}
    for label, rel in (("리포트", f"report/{g}_report.html"), ("검토 리포트", f"report/{g}_review.md"), ("TC 엑셀", f"tc/{g}_TC.xlsx")):
        if os.path.exists(os.path.join(ROOT, rel)):
            st["files"][label] = rel
    res = os.path.join(ROOT, "out", f"results_{g}.json")
    if os.path.exists(res):
        try:
            stats, rows = common.load_results(res, g)
            if rows:
                st["result"] = {"passed": sum(r["status"] == "passed" for r in rows),
                                "failed": sum(r["status"] in ("failed", "timedOut") for r in rows),
                                "total": len(rows), "when": common.local_time(stats.get("startTime"))}
        except Exception:
            pass
    return st


def status():
    inputs = []
    if os.path.isdir(common.INPUT_DIR):
        for d in sorted(os.listdir(common.INPUT_DIR)):
            p = os.path.join(common.INPUT_DIR, d)
            if os.path.isdir(p):
                files = [f for f in sorted(os.listdir(p)) if not f.startswith("_") and os.path.isfile(os.path.join(p, f))]
                inputs.append({"key": d, "files": files, "prepared": os.path.exists(os.path.join(p, "_입력정리.md")),
                               "has_tc": os.path.exists(os.path.join(ROOT, "tc", f"{d}_tc.json"))})
    common.load_dotenv()
    jira_ok = all(os.environ.get(k) for k in ("JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN", "JIRA_PROJECT_KEY"))
    return {"games": [game_status(g) for g in games()], "inputs": inputs, "jira": jira_ok,
            "job": {"title": JOB.title, "busy": JOB.busy()}}


# ---------------------------------------------------------------- HTTP

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):          # 검은 창이 요청 기록으로 가득 차지 않게
        pass

    def _host_ok(self):
        return (self.headers.get("Host") or "").split(":")[0] in ("127.0.0.1", "localhost")

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, bytes):
            data = body
        else:
            data = (body if isinstance(body, str) else json.dumps(body, ensure_ascii=False)).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _file(self, path):
        with open(path, "rb") as f:
            self._send(200, f.read(), TYPES.get(os.path.splitext(path)[1].lower(), "application/octet-stream"))

    def do_GET(self):
        if not self._host_ok():
            return self._send(403, {"error": "host"})
        u = urllib.parse.urlparse(self.path)
        if u.path in ("/", "/index.html"):
            return self._file(os.path.join(WEB, "index.html"))
        if u.path == "/api/status":
            return self._send(200, status())
        if u.path == "/api/job":
            since = int(urllib.parse.parse_qs(u.query).get("since", ["0"])[0] or 0)
            return self._send(200, {"title": JOB.title, "busy": JOB.busy(), "done": JOB.done, "code": JOB.code,
                                    "lines": JOB.lines[since:], "next": len(JOB.lines)})
        if u.path.startswith("/files/"):
            full = os.path.normpath(os.path.join(ROOT, urllib.parse.unquote(u.path[len("/files/"):])))
            allowed = [os.path.join(ROOT, d) + os.sep for d in ("report", "tc")]
            if any(full.startswith(a) for a in allowed) and os.path.isfile(full):
                return self._file(full)
            return self._send(404, {"error": "없는 파일"})
        return self._send(404, {"error": "없는 주소"})

    def do_POST(self):
        if not self._host_ok() or self.headers.get("X-QA-UI") != "1":
            return self._send(403, {"error": "막힌 요청"})
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        length = int(self.headers.get("Content-Length") or 0)
        if u.path == "/api/upload":
            game = (q.get("game") or [""])[0]
            name = os.path.basename(urllib.parse.unquote(self.headers.get("X-Filename") or ""))
            if not NAME_RE.match(game):
                return self._send(400, {"error": "게임 이름은 영문 소문자·숫자·_-만 쓸 수 있어요."})
            if not name or os.path.splitext(name)[1].lower() not in UPLOAD_EXT or name.startswith("_"):
                return self._send(400, {"error": f"올릴 수 없는 파일: {name} (pdf·이미지·xlsx·md(마크다운)·txt·csv·html만)"})
            if length > 200 * 1024 * 1024:
                return self._send(400, {"error": "200MB가 넘는 파일은 올릴 수 없어요."})
            folder = os.path.join(common.INPUT_DIR, game)
            os.makedirs(folder, exist_ok=True)
            with open(os.path.join(folder, name), "wb") as f:
                left = length
                while left > 0:
                    chunk = self.rfile.read(min(left, 1 << 20))
                    if not chunk:
                        break
                    f.write(chunk)
                    left -= len(chunk)
            return self._send(200, {"ok": True, "saved": f"input/{game}/{name}"})
        body = json.loads(self.rfile.read(length) or b"{}")
        if u.path == "/api/run":
            p = plan(body.get("action"), body.get("game"))
            if isinstance(p, str):
                return self._send(400, {"error": p})
            if not JOB.start(*p):
                return self._send(409, {"error": f"'{JOB.title}' 작업이 아직 진행 중이에요."})
            return self._send(200, {"ok": True, "title": p[0]})
        if u.path == "/api/open-folder":
            game = body.get("game") or ""
            target = os.path.join(common.INPUT_DIR, game) if NAME_RE.match(game) else common.INPUT_DIR
            os.makedirs(target, exist_ok=True)
            if os.name == "nt":
                os.startfile(target)
            return self._send(200, {"ok": True})
        return self._send(404, {"error": "없는 주소"})


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    server, port = None, None
    for p in range(8765, 8785):
        try:
            server, port = ThreadingHTTPServer(("127.0.0.1", p), Handler), p
            break
        except OSError:
            continue
    if not server:
        sys.exit("빈 포트(8765~8784)를 찾지 못했어요.")
    url = f"http://127.0.0.1:{port}/"
    print(f"QA 자동화 화면: {url}\n이 창을 닫으면 화면도 멈춥니다. (끝내려면 Ctrl+C 또는 창 닫기)")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
