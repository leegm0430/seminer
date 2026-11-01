"""Jira Cloud 무료 플랜 + REST API(표준 라이브러리만 사용)로 TC와 자동 테스트 실패를 Jira에 올린다.

명령:
  python -I tools/jira_sync.py check            # 접속·프로젝트·이슈 유형 확인 (아무것도 만들지 않음)
  python -I tools/jira_sync.py tcs              # TC 목록을 Jira 작업(Task) 이슈로 등록 (이미 올린 것은 건너뜀)
  python -I tools/jira_sync.py bugs             # out/results.json 의 실패 테스트를 버그로 등록 + 스크린샷 첨부
                                                #   같은 테스트가 다시 실패하면 새 버그 대신 기존 버그에 댓글
  --game bloodfall                              # 게임 선택 (기본 slimegame)
  --dry-run                                     # 실제로 보내지 않고 out/jira_dryrun.json 에 보낼 내용만 저장

설정(.env 또는 환경 변수, .env는 git에 올라가지 않는다):
  JIRA_BASE_URL=https://내사이트.atlassian.net
  JIRA_EMAIL=가입한 이메일
  JIRA_API_TOKEN=https://id.atlassian.com/manage-profile/security/api-tokens 에서 만든 토큰
  JIRA_PROJECT_KEY=프로젝트 키(예: SQA)
설정이 비어 있으면 자동으로 --dry-run 으로 동작한다. 유료 앱(Zephyr 등)·Rovo(크레딧)는 쓰지 않는다.
"""
import base64
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, game_arg, load_dotenv, load_results, load_tcs, local_time  # noqa: E402

STATE_FILE = os.path.join(ROOT, "out", "jira_state.json")      # 이미 만든 이슈 키 기록 (git 제외)
DRYRUN_FILE = os.path.join(ROOT, "out", "jira_dryrun.json")
TYPE_NAMES = {"tc": ["Task", "작업"], "bug": ["Bug", "버그"]}   # 사이트 언어에 따라 이름이 다르다


class Jira:
    def __init__(self, dry_run):
        load_dotenv()
        self.base = os.environ.get("JIRA_BASE_URL", "").rstrip("/")
        self.email = os.environ.get("JIRA_EMAIL", "")
        self.token = os.environ.get("JIRA_API_TOKEN", "")
        self.project = os.environ.get("JIRA_PROJECT_KEY", "")
        missing = [k for k, v in (("JIRA_BASE_URL", self.base), ("JIRA_EMAIL", self.email),
                                  ("JIRA_API_TOKEN", self.token), ("JIRA_PROJECT_KEY", self.project)) if not v]
        self.dry_run = dry_run or bool(missing)
        if missing and not dry_run:
            print(f"설정 없음({', '.join(missing)}) → 드라이런으로 실행합니다. 실제 등록은 하지 않습니다.")
        self.sent = []
        self._types = None
        self.bug_fallback = False

    # ---------- HTTP ----------
    def _auth(self):
        raw = f"{self.email}:{self.token}".encode()
        return "Basic " + base64.b64encode(raw).decode()

    def call(self, method, path, body=None, data=None, headers=None):
        if self.dry_run and method != "GET":
            self.sent.append({"method": method, "path": path, "body": body,
                              "file": (headers or {}).get("X-Dryrun-File")})
            return {"key": f"DRY-{len(self.sent)}", "id": "0"}
        h = {"Authorization": self._auth(), "Accept": "application/json", **(headers or {})}
        h.pop("X-Dryrun-File", None)
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            h["Content-Type"] = "application/json"
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                text = r.read().decode("utf-8")
                return json.loads(text) if text else {}
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")[:500]
            raise SystemExit(f"Jira 오류 {e.code} {method} {path}\n{detail}")

    # ---------- 이슈 유형 ----------
    def issue_type(self, kind):
        """프로젝트에 있는 이슈 유형 중 Task/작업, Bug/버그를 찾는다."""
        if self.dry_run:
            return {"name": TYPE_NAMES[kind][0]}
        if self._types is None:
            res = self.call("GET", f"/rest/api/2/issue/createmeta/{self.project}/issuetypes")
            self._types = res.get("issueTypes") or res.get("values") or []
        for t in self._types:
            if t.get("name") in TYPE_NAMES[kind]:
                return {"id": t["id"]}
        if kind == "bug":
            # 최근 스크럼 템플릿에는 버그 유형이 없을 수 있다 → 작업 유형 + bug 라벨로 대신한다.
            # 프로젝트 설정에서 '버그' 유형을 추가하면 다음 실행부터 자동으로 버그 유형을 쓴다.
            self.bug_fallback = True
            return self.issue_type("tc")
        names = ", ".join(t.get("name", "?") for t in self._types)
        raise SystemExit(f"프로젝트에 {TYPE_NAMES[kind]} 유형이 없습니다. 있는 유형: {names}\n"
                         "Jira 프로젝트 설정 → 이슈 유형에서 추가하거나 소프트웨어(스크럼/칸반) 템플릿으로 만드세요.")

    # ---------- 동작 ----------
    def create(self, kind, summary, description, labels):
        issuetype = self.issue_type(kind)
        if kind == "bug" and self.bug_fallback:
            summary, labels = "[버그] " + summary, labels + ["bug"]
        body = {"fields": {"project": {"key": self.project or "DRY"}, "issuetype": issuetype,
                           "summary": summary[:250], "description": description, "labels": labels}}
        return self.call("POST", "/rest/api/2/issue", body=body)["key"]

    def comment(self, key, text):
        self.call("POST", f"/rest/api/2/issue/{key}/comment", body={"body": text})

    def attach(self, key, file_path):
        name = os.path.basename(file_path)
        if self.dry_run:
            self.call("POST", f"/rest/api/2/issue/{key}/attachments", headers={"X-Dryrun-File": name})
            return
        boundary = uuid.uuid4().hex
        with open(file_path, "rb") as f:
            payload = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\n"
                       "Content-Type: image/png\r\n\r\n").encode() + f.read() + f"\r\n--{boundary}--\r\n".encode()
        self.call("POST", f"/rest/api/2/issue/{key}/attachments", data=payload,
                  headers={"X-Atlassian-Token": "no-check", "Content-Type": f"multipart/form-data; boundary={boundary}"})

    def link(self, bug_key, tc_key):
        body = {"type": {"name": "Relates"}, "inwardIssue": {"key": bug_key}, "outwardIssue": {"key": tc_key}}
        try:
            self.call("POST", "/rest/api/2/issueLink", body=body)
        except SystemExit as e:  # 링크 유형 이름이 다른 사이트도 있다 — 링크는 실패해도 버그 등록은 유지
            print(f"  (TC 연결 생략: {str(e).splitlines()[0]})")

    def save_dryrun(self):
        if self.dry_run:
            os.makedirs(os.path.dirname(DRYRUN_FILE), exist_ok=True)
            with open(DRYRUN_FILE, "w", encoding="utf-8") as f:
                json.dump(self.sent, f, ensure_ascii=False, indent=2)
            print(f"드라이런: 요청 {len(self.sent)}건을 보내지 않고 {DRYRUN_FILE} 에 저장했습니다.")


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {"tcs": {}, "bugs": {}}


def save_state(state, jira):
    if jira.dry_run:
        return  # 드라이런은 가짜 키라 기록하지 않는다
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def cmd_check(jira):
    if jira.dry_run:
        sys.exit("설정이 비어 있어 확인할 수 없습니다. README의 'Jira 연결' 순서대로 .env를 채우세요.")
    me = jira.call("GET", "/rest/api/2/myself")
    proj = jira.call("GET", f"/rest/api/2/project/{jira.project}")
    print(f"접속 OK: {me.get('displayName')} / 프로젝트 {proj.get('key')} · {proj.get('name')}")
    tc_t, bug_t = jira.issue_type("tc"), jira.issue_type("bug")
    print("TC 유형:", tc_t, "/ 버그 유형:", bug_t,
          "(버그 유형 없음 → 작업 + bug 라벨로 등록)" if jira.bug_fallback else "")


def cmd_tcs(jira, state, game):
    tcs = load_tcs(game)
    made = skipped = 0
    for kind, items in (("auto", tcs["automated"]), ("manual", tcs["manual"])):
        for tc in items:
            if tc["id"] in state["tcs"]:
                skipped += 1
                continue
            desc = (f"게임: {tcs['game']} ({tcs['target']})\n원본: {tcs['source_tc']}\n"
                    + (f"근거: 기획서 {tc['basis']}\n" if tc.get("basis") else "")
                    + f"자동화: {'예 (Playwright)' if kind == 'auto' else '아니오'}\n"
                    + (f"검토: {tc['review']}" if kind == "auto" else f"자동화하지 않은 이유: {tc['reason']}"))
            key = jira.create("tc", f"[TC {tc['id']}] {tc.get('title') or tc.get('reason')}", desc,
                              ["TC", game, kind])
            state["tcs"][tc["id"]] = key
            made += 1
            print(f"  {key}  TC {tc['id']}")
    print(f"TC 이슈 {made}건 등록 (이 게임에서 이미 올린 것 {skipped}건 건너뜀)")


def cmd_bugs(jira, state, game):
    stats, rows = load_results(game=game)
    tcs = load_tcs(game)
    basis = {tc["id"]: tc.get("basis") for tc in tcs["automated"]}
    failed = [r for r in rows if r["status"] in ("failed", "timedOut")]
    when = local_time(stats.get("startTime"))
    if not failed:
        print("실패한 테스트가 없어 등록할 버그가 없습니다.")
        return
    for r in failed:
        err = "\n".join(r["error"].splitlines()[:15])
        prev = state["bugs"].get(r["title"])
        if prev:
            jira.comment(prev, f"자동 테스트 {when} 실행에서 다시 실패했습니다.\n{{noformat}}\n{err}\n{{noformat}}")
            print(f"  {prev}  다시 실패 → 댓글 추가: {r['title']}")
            continue
        refs = [f"기획서 {basis[t]}" for t in r["tc_ids"] if basis.get(t) and basis[t] != "-"]
        desc = (f"h3. 자동 테스트 실패 (Playwright)\n*테스트:* {r['title']}\n*관련 TC:* {', '.join(r['tc_ids'])}\n"
                + (f"*근거:* {', '.join(refs)}\n" if refs else "")
                + f"*실행:* {when}\n*환경:* Chromium(Playwright), 1280×800, {tcs['target']}\n\n"
                f"h3. 오류 내용\n{{noformat}}\n{err}\n{{noformat}}\n\n"
                "h3. 확인할 것\n# 같은 조건으로 직접 재현되는지 확인\n# 재현되면 심각도·우선순위 지정, 안 되면 테스트 문제로 분류\n\n"
                "_이 이슈는 자동으로 만든 초안입니다. 사람이 재현을 확인한 뒤 진행합니다._")
        key = jira.create("bug", f"[자동] {r['title']} 실패", desc, ["auto-qa", game, "초안"])
        if r["screenshot"] and os.path.exists(r["screenshot"]):
            jira.attach(key, r["screenshot"])
        for tc in r["tc_ids"]:
            if tc in state["tcs"]:
                jira.link(key, state["tcs"][tc])
        state["bugs"][r["title"]] = key
        print(f"  {key}  새 버그: {r['title']}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    if not args or args[0] not in ("check", "tcs", "bugs"):
        sys.exit(__doc__)
    game = game_arg(args)
    jira = Jira(dry_run="--dry-run" in args)
    state = load_state()
    {"check": lambda: cmd_check(jira), "tcs": lambda: cmd_tcs(jira, state, game),
     "bugs": lambda: cmd_bugs(jira, state, game)}[args[0]]()
    save_state(state, jira)
    jira.save_dryrun()


if __name__ == "__main__":
    main()
