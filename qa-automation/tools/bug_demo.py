"""회귀 테스트가 버그를 잡는지 보여 주는 데모.

원본 slimegame.html은 건드리지 않는다. out/ 폴더에 사본을 만들고 점수 공식만 일부러 틀리게 바꾼 뒤
같은 테스트를 그 사본에 돌린다. 결과는 out/results.json(이후 jira_sync.py bugs가 읽음)과
report/slimegame_bugdemo.html 에 남는다. 원래 결과로 되돌리려면 npm test 를 다시 돌린다.
"""
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT  # noqa: E402
import make_report  # noqa: E402

ORIGINAL = os.path.join(os.path.dirname(ROOT), "slimegame.html")
BUGGY = os.path.join(ROOT, "out", "slimegame_buggy.html")
CORRECT = "Math.round((i+1)*(i+2)/2 * 8)"
PLANTED = "Math.round((i+1)*(i+2)/2 * 9)"   # 심은 버그: 병합 점수가 8배 → 9배


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    src = open(ORIGINAL, encoding="utf-8").read()
    if CORRECT not in src:
        sys.exit("원본에서 점수 공식을 찾지 못함 — 게임 코드가 바뀌었는지 확인")
    os.makedirs(os.path.dirname(BUGGY), exist_ok=True)
    with open(BUGGY, "w", encoding="utf-8") as f:
        f.write(src.replace(CORRECT, PLANTED, 1))
    print(f"버그 심은 사본: {BUGGY}\n  {CORRECT}  →  {PLANTED}")

    env = dict(os.environ, SLIME_TARGET=BUGGY)
    code = subprocess.call("npx playwright test", cwd=ROOT, env=env, shell=True)
    shutil.copyfile(os.path.join(ROOT, "out", "results.json"), os.path.join(ROOT, "out", "results_bugdemo.json"))
    path, ok, bad = make_report.build(os.path.join(ROOT, "out", "results_bugdemo.json"),
                                      os.path.join(ROOT, "report", "slimegame_bugdemo.html"),
                                      "버그 심은 사본(점수 공식 ×9)")
    print(f"리포트 저장: {path} (통과 {ok}, 실패 {bad})")
    print("테스트가 버그를 잡았습니다." if code != 0 else "주의: 테스트가 심은 버그를 잡지 못했습니다.")


if __name__ == "__main__":
    main()
