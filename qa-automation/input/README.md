# input — TC를 만들 자료를 넣는 곳

게임마다 폴더를 하나 만들고(영문 소문자 이름 권장, 예: `rotdl`) 자료를 넣습니다. **이 폴더의 자료는 GitHub에 올라가지 않습니다**(다른 회사 기획서일 수 있어서 `.gitignore`로 제외, 이 안내 파일만 올라감).

| 넣는 것 | 쓰임 |
|---|---|
| 기획서 PDF | 글자를 뽑고, 그림·플로우 차트 쪽은 그림으로 만들어 Claude Code가 직접 본다 |
| 이미지 (png·jpg·gif·webp) | 화면 캡처·UI 시안 — Claude Code가 직접 본다 |
| 엑셀 (xlsx) | 기존 TC면 TC 작성 규칙(044)으로 점검하고 고칠 점·추가 제안을 만든다 |
| 글 (md·txt·csv) | 그대로 읽는다 |
| 게임 파일 (html) 또는 `game.txt` (게임 html 경로 한 줄) | 있으면 자동 테스트까지, 없으면 **문서 전용**(자동 테스트 건너뜀 → TC 작성·검토·추가 제안으로 마무리) |

## 순서

1. `input/<게임>/`에 자료 넣기 — 또는 `QA자동화_실행.bat` **5번**(새 이름이면 폴더를 만들어 열어 주고, 넣은 뒤 정리까지 함)
2. Claude Code에 **"input/<게임> 자료로 TC 작성해줘"** — tc-writing 스킬이 아래를 차례로 한다
   - `python -I tools/prepare_input.py --game <게임>` : 자료 정리 (`_입력정리.md`, `_pages/` 그림)
   - 정리본·그림을 읽고 `tc/<게임>_tc.json` 작성 (AI API 호출 없음 — Claude Code 대화 안에서)
   - `python -I tools/qa_pipeline.py --game <게임>` : 규칙 점검 → (게임 있으면) 자동 테스트 → TC 엑셀 → 검토 리포트
   - Claude Code가 마무리까지 안 했으면 `QA자동화_실행.bat` **6번**으로 마무리 (7번은 모든 게임 TC 규칙 점검만)
3. 결과: `tc/<게임>_TC.xlsx`, `report/<게임>_review.md` (+ 자동 테스트를 했으면 `report/<게임>_report.html`)

`_`로 시작하는 파일·폴더(`_입력정리.md`, `_입력정보.json`, `_pages/`)는 도구가 만든 것이라 지워도 다시 만들어집니다.
PDF 그림 만들기에는 PyMuPDF(무료)가 필요합니다: `python -m pip install pymupdf`
