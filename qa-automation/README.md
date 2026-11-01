# 슬라임 게임 QA 자동화 (Playwright + Jira 무료 플랜)

- 작성일: 2026-11-01
- 작성자: Claude Code (자동화 대상 선정·코드 초안) / 원본 TC·게임: LKM
- 비용: 0원 — Playwright(오픈소스), Python 표준 라이브러리 + openpyxl(오픈소스, TC 엑셀용), Jira Cloud 무료 플랜 REST API만 사용. 유료 앱(Zephyr)·Rovo(크레딧)·AI API 호출 없음.

## 무엇을 하나

```
TC/슬라임게임_TC.xlsx (71건, LKM 작성)
   └─ 자동화할 22건 + 탐색 중 추가 1건 선정 → tc/slimegame_tc.json (검토: 초안 → LKM이 확인함/버림)
        └─ tc/slimegame_TC.xlsx : 원본 엑셀 + 자동화 칸(결과·Jira·검토) — 리포트 만들 때 자동 갱신
        └─ tests/slimegame.spec.js : Playwright가 크롬에서 게임을 직접 조작
             └─ out/results.json → tools/make_report.py → report/slimegame_report.html
             └─ 실패 → tools/jira_sync.py bugs → Jira 버그 이슈 + 스크린샷 (같은 실패는 댓글만)
```

## 결과 (2026-11-01)

| 항목 | 값 |
|---|---|
| 자동화한 기존 TC | 22 / 71 (나머지 49건은 자동화하지 않은 이유를 리포트·엑셀에 기록) |
| 테스트 | 17개, 한 번 도는 데 약 3~5분 |
| 발견한 버그 | **탐색-1: 게임 오버 뒤에도 보드 점수가 오른다** — 결과 창·최고 기록은 게임 오버 순간 점수인데, 물리 엔진이 멈추지 않아 진행 중이던 병합 점수가 보드에만 더해짐. 직접 재현 3판 중 2판. 기존 TC에 없던 항목 |
| 심은 버그 데모 | 점수 공식 ×8 → ×9로 바꾼 사본에서 병합 점수 테스트가 24 대신 27을 잡아냄 (`report/slimegame_bugdemo.html`) |

## BLOODFALL (2026-11-01 추가)

| 항목 | 값 |
|---|---|
| TC | 기존 TC가 없어 **기획서 v0.9를 근거로 AI가 초안 작성** — 38건(자동 30 + 수동 8), 각 TC에 근거 조항(§) 표기 (`tc/bloodfall_tc.json`) |
| 판정 방식 | 슬라임과 달리 상태·함수가 전역이라 **내부 값(체력·레벨·타이머)을 직접 읽어** 판정 + 화면 확인. 몬스터·오브·박스를 테스트가 직접 배치해 상황을 빠르게 만듦 |
| 테스트 | 23개, 약 1.5분 → 22 통과, 1 실패 (`report/bloodfall_report.html`) |
| 발견 | **BF-04 기획-구현 불일치**: 기획서 §31.1은 "드래프트 10초 미선택 시 피스톨 자동 배정"인데, 구현은 레벨업과 같은 무작위 선택(§33)을 씀. 무작위 값을 고정하지 않고 3번 방치 → 피스톨·샷건·레이저 각 1회 |
| Jira | TC 38건 SCRUM-48~85, 불일치 SCRUM-86 (스크린샷·TC 연결·분석 댓글) |

```powershell
npm run test:bloodfall
npm run report:bloodfall
npm run jira:tcs:bloodfall     # 한 번만 (다시 돌려도 중복 없음)
npm run jira:bugs:bloodfall
```

## 카드팩 스튜디오 (2026-11-02 추가)

| 항목 | 값 |
|---|---|
| 대상 | `스토리게임만들기/card-studio/studio.html` — 카드팩 만들기(속성·카드·밸런스·설명·그림·등록) + 속성 카드 대전 + 카드뽑기 확률 |
| TC | 기획서가 없어 **화면 안내 문구와 코드 규칙**을 근거로, **TC 작성 규칙(044)에 맞춰** AI가 초안 작성 — 55건(자동 47 + 수동 8). 경계값(이름 1/2글자, 합 7/8/12/13, 등급 코스트, 그림 3/4장, 천장 9/10/100/101)·실패 케이스·새로고침 케이스 포함. 규칙 점검 0건 (`tc/cardstudio_tc.json`) |
| 판정 방식 | 화면: 진행 상태를 localStorage에 넣어 원하는 단계에서 시작, 무작위는 Date.now 고정. 규칙: 전역 엔진(CardRules·BattleEngine·Gacha)을 직접 불러 판정. 진행 파일 `얼음_진행.json`을 불러오기·저장 테스트에 사용 |
| 테스트 | 47개, 약 35초 → 46 통과, 1 실패 (`report/cardstudio_report.html`) |
| 발견 | **CS-46 새로고침하면 카드뽑기 천장 카운트가 0으로 돌아감** — 3팩 뽑은 뒤 새로고침하고 1팩 더 뽑으면 "4 / 천장 20"이 아니라 "1 / 천장 20". flow2.js 178줄 `drawState`가 저장되지 않는 변수. 안내 문구의 "19팩 연속이면 20번째 팩 전설 보장"과 어긋남 → 기획 확인 필요 |
| Jira | TC 55건 SCRUM-87~141, CS-46 → SCRUM-142 (스크린샷·SCRUM-132 연결·분석 댓글) |

```powershell
npm run test:cardstudio
npm run report:cardstudio            # 리포트 + tc/cardstudio_TC.xlsx (표지 포함)
npm run jira:tcs:cardstudio          # 한 번만
npm run jira:bugs:cardstudio
```

## TC 엑셀 (tc/<게임>_TC.xlsx)

| 파일 | 내용 |
|---|---|
| `tc/slimegame_TC.xlsx` | LKM 원본 TC 엑셀을 복사하고 오른쪽에 자동화 칸을 붙인 것. 원본 `TC/슬라임게임_TC.xlsx`는 고치지 않음. 탐색-1은 지정항목 시트 맨 아래에 추가 |
| `tc/bloodfall_TC.xlsx`, `tc/cardstudio_TC.xlsx` | AI 초안 TC를 같은 양식(번호·우선순위·분류·사전 조건·테스트 내용·기대 결과·비고)으로 정리 + 근거. 첫 시트는 **표지**(작성·TC 수·우선순위 정의·결과 정의, 규칙 044 S1) |

- 자동화 칸: TC ID · 자동/수동 · 자동화하지 않은 이유 · 최근 결과 · 실행 시각 · Jira TC · Jira 버그 · 검토
- 결과 표기는 규칙 044의 결과 정의: PASS / Fail / N/T (수동 TC는 사람이 실행하기 전까지 N/T)
- `npm run report` / `npm run report:bloodfall` 을 돌리면 그 게임 엑셀이 함께 갱신된다. 엑셀만 다시 만들려면 `npm run tc:xlsx`
- **검토 칸은 엑셀에서 직접 고친다**(초안/확인함/버림 목록). 다음 갱신 때 `tc/*.json`에 옮겨 적힌다. 다른 칸을 엑셀에서 고치면 다음 갱신 때 지워지니, TC 내용은 JSON에서 고친다
- 엑셀에서 파일을 연 채로 갱신하면 저장이 안 된다 → 닫고 다시 실행
- openpyxl(무료 오픈소스 파이썬 라이브러리)이 필요: `pip install openpyxl`

## TC 작성 규칙 점검 (tools/check_tc.py)

TC 작성 규칙(`AX부트캠프study/Resources/2026-11-02 044. TC 작성 규칙.md`) 중 기계로 볼 수 있는 것을 점검한다: 빈 칸, 기대 결과가 "확인/되는지"로 끝남, "정상"뿐인 결과, 내용 복사, 확률 TC 횟수, 번호, High 비율, 우선순위 표기 섞임.

```powershell
npm run tc:check                                              # qa-automation 게임 전부
python -I tools/check_tc.py --xlsx "../TC/운빨존많겜TC작성자_이경민.xlsx"   # 직접 쓴 엑셀 TC
```

TC 엑셀을 만들 때(`tc:xlsx`, 리포트)도 점검 결과가 한 줄로 나온다. 문장 품질·빠진 케이스는 사람이 044 점검표로 본다.

## 더블클릭 실행 (QA자동화_실행.bat)

1. 게임 선택(1 슬라임 / 2 BLOODFALL / 3 카드팩 스튜디오 / 4 전부)
2. 게임마다 자동 테스트 → 리포트·TC 엑셀 갱신 → 리포트를 브라우저로 열기
3. **마지막에** "Jira에 등록할까요? (Y/N)" — Y면 실패한 테스트를 Jira 버그로 등록, N이면 건너뜀

실행 전에 TC 엑셀을 닫아 둔다. 게임별 결과는 `out/results_<게임>.json`에 따로 남겨 마지막 Jira 단계에서 쓴다.

## 실행 (PowerShell, 이 폴더에서)

```powershell
npm install                     # 처음 한 번
npx playwright install chromium # 처음 한 번 (브라우저 내려받기)
npm test                        # 테스트 실행
npm run report                  # report/slimegame_report.html 만들기
npm run bug-demo                # 점수 공식을 틀리게 바꾼 사본으로 같은 테스트 → 버그를 잡는지 확인
npx playwright show-report out/playwright-report   # Playwright 기본 리포트 보기
```

> bug-demo 뒤에는 `out/results.json`이 사본 결과로 바뀐다. 원래 결과로 돌리려면 `npm test`를 다시 돌린다.

## Jira 연결 (무료 플랜)

1. https://www.atlassian.com/software/jira/free 에서 무료 사이트 만들기 (예: `내이름.atlassian.net`)
2. 프로젝트 만들기: 소프트웨어 → **스크럼 또는 칸반** 템플릿 (작업·버그 유형이 들어 있음). 프로젝트 키 예: `SQA`
3. API 토큰 만들기: https://id.atlassian.com/manage-profile/security/api-tokens
4. `.env.example`을 복사해 `.env`로 이름을 바꾸고 값을 채운다. **`.env`는 git에 올라가지 않는다. 토큰을 다른 파일·코드·채팅에 적지 않는다.**
5. 확인 → 등록

```powershell
python -I tools/jira_sync.py check   # 접속·프로젝트·이슈 유형 확인 (아무것도 만들지 않음)
python -I tools/jira_sync.py tcs     # TC를 작업 이슈로 등록 (한 번만, 다시 돌려도 중복 없음)
npm test
python -I tools/jira_sync.py bugs    # 실패한 테스트를 버그로 등록 + 스크린샷 첨부 + 관련 TC 연결
```

설정이 비어 있으면 자동으로 **드라이런**: Jira에 보내지 않고 보낼 내용만 `out/jira_dryrun.json`에 저장한다.

## 판정 방식과 한계

- 게임 코드는 고치지 않았다. 화면에 보이는 값(점수, 다음 슬라임 이름, 결과 창, 버튼 위치)으로만 판정한다.
- 다음 슬라임은 무작위라 테스트 안에서 `Math.random`을 정해진 순서로 바꿔 매번 같은 결과가 나오게 했다.
- 탐색-1처럼 매번 생기지 않는 버그는 최대 3판을 이어서 확인한다. 그래도 놓칠 수 있다.
- 커서 위치·경고선 60% 판정·애니메이션처럼 캔버스 안이나 게임 내부 값은 화면으로 읽을 수 없어 수동 TC로 남겼다.
- 멀티(P2P) 대결은 외부 중계 서버와 두 사람이 필요해 이번 범위에서 뺐다.

## 파일

| 경로 | 내용 | git |
|---|---|---|
| `tests/slimegame.spec.js` | 테스트 코드 | 올림 |
| `tc/*_tc.json` | 자동화 TC·검토 상태·수동 TC 이유 (스크립트가 읽는 원본) | 올림 |
| `tc/*_TC.xlsx` | 사람이 보는 TC 엑셀 (자동 생성) | 올림 |
| `tools/` | 리포트·Jira 연동·버그 데모 (Python 표준 라이브러리) | 올림 |
| `report/` | 포트폴리오용 결과 리포트 | 올림 |
| `out/` | 실행 결과·스크린샷·Jira 기록 | 안 올림 |
| `.env` | Jira 토큰 | **절대 안 올림** |
