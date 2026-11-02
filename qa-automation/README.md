# AI 활용 게임 QA 자동화 (Playwright + Jira 무료 플랜)

- 작성일: 2026-11-01 (2026-11-02 현재 기준으로 다시 씀)
- 작성자: Claude Code (TC 초안·테스트 코드·도구) / 원본 TC·게임·TC 작성 규칙 확인: LKM
- 비용: 0원 — Playwright(오픈소스), Python 표준 라이브러리 + openpyxl·PyMuPDF(오픈소스), Jira Cloud 무료 플랜 REST API만 사용. 유료 앱(Zephyr)·Rovo(크레딧)·AI API 호출 없음.
- 소개 페이지: [index.html](index.html) (공개 주소 https://leegm0430.github.io/seminer/qa-automation/)

## 1. 전체 흐름

```
기획서 PDF·이미지·기존 TC 엑셀
 → TC 작성 (Claude Code + TC 작성 규칙)
 → 규칙 점검
 → Playwright 자동 테스트
 → 리포트·TC 엑셀
 → Jira TC·버그 이슈
```

| 단계 | 도구 | 하는 일 | AI 필요 |
|---|---|---|---|
| 자료 정리 | `tools/prepare_input.py` | `input/<게임>/`의 PDF 글자 뽑기(그림 쪽은 그림으로), 엑셀 시트 읽기·기존 TC 시트 찾기, 게임 파일 유무 확인 | 아니요 |
| TC 작성 | Claude Code (`tc-writing` 스킬) | 규칙을 먼저 읽고 `tc/<게임>_tc.json` + `tests/<게임>.spec.js` 작성 | **예 (내 PC의 Claude Code)** |
| 규칙 점검 | `tools/check_tc.py`, `TC점검도구.html` | 규칙 중 기계로 볼 수 있는 것 점검 | 아니요 |
| 자동 테스트 | Playwright (`tests/*.spec.js`) | 크롬에서 게임을 직접 조작해 TC마다 판정 | 아니요 |
| 리포트·TC 엑셀 | `tools/make_report.py`, `tools/export_tc_xlsx.py` | `report/<게임>_report.html`, `tc/<게임>_TC.xlsx` | 아니요 |
| Jira | `tools/jira_sync.py` | TC → 작업 이슈, 실패 → 버그 이슈 + 스크린샷 (같은 실패는 댓글만) | 아니요 |

게임 파일이 없으면 자동 테스트를 건너뛰고 `report/<게임>_review.md`(기존 TC 검토·기획서 확인 필요·추가 제안)로 끝난다 (`tools/qa_pipeline.py`).

### 이미 작성된 TC를 넣으면?

TC 작성 단계를 **건너뛰지 않고**, 하는 일이 "새로 쓰기"에서 "읽고 고르고 보충하기"로 바뀐다. 자동 테스트는 TC마다 테스트 코드가 있어야 돌기 때문에, 기존 TC만 있어도 테스트 코드는 이 단계에서 써야 한다.

| 넣은 자료 | TC 작성 단계에서 하는 일 | 예 |
|---|---|---|
| 기획서만 | 규칙대로 TC를 처음부터 씀 | BLOODFALL, 카드팩 스튜디오 |
| 기존 TC + 게임 | ① 기존 TC에서 자동화할 것을 골라 테스트 코드 작성 ② 규칙 위반·고칠 점 검토(`existing_review`) ③ 규칙으로 빠진 TC 보충(별도 번호·시트) | 슬라임 게임 |
| 기존 TC + 기획서 (게임 없음) | ② 검토 ③ 기획서 대비 보충 + 기획서 모순(`spec_issues`) | 캡스톤 RotDL |

- 사용자가 쓴 TC 엑셀(`TC/*.xlsx`)은 **고치지 않는다**. 고칠 점은 제안만 하고, 보충 TC는 따로 둔다.
- 기존 TC를 **보충 없이 그대로** 자동화만 하려면 요청할 때 "보충 없이 기존 TC만 자동화"라고 적는다 (①만 함).
- **점검만** 하려면 TC 작성 단계 없이 `TC점검도구.html`에 엑셀을 넣는다.

## 2. TC 작성 규칙

원본: `AX부트캠프study/Resources/2026-11-02 044. TC 작성 규칙.md` (브런치 TC 글·ISTQB 용어·LKM이 쓴 TC 2종을 참고해 정리). Claude Code는 `tc-writing` 스킬로 TC를 쓰기 전에 이 문서를 읽는다.

| 묶음 | 핵심 |
|---|---|
| S 파일 구성 | 표지(우선순위·결과 정의), 머리 정보(버전·기준일), 기본 칸 |
| W 한 줄 쓰기 | TC 하나 = 확인 하나, 기대 결과는 `~ 됨/표시 됨/없음`, 숫자·문구 그대로 |
| D 무엇을 TC로 | 정상·실패 짝, 경계값 n−1·n·n+1, 끊김·환경, 확률은 횟수·판정 범위 |
| C 커버리지 | 화면 요소·안내 문구·규칙 값마다 TC, 근거 대응표에 TC 0건인 칸 없게 |
| P·Q·A | 우선순위 비율, 번호·표기 통일, AI 초안은 검토 칸 `초안` |

## 3. 적용 결과 (2026-11-02 실제 실행)

| 대상 | TC | 자동 테스트 | 찾은 것 | 결과물 |
|---|---|---|---|---|
| 슬라임 게임 (`../slimegame.html`) | LKM 71 + AI 보충 190 (SG-xxx) | 202개 → **199 통과** | 탐색-1 게임 오버 뒤 보드 점수 증가(간헐적, 3판 중 2판꼴로 재현) · **SG-1506 폭 360px 화면 보드 10px 잘림** · SG-1010 없는 방 코드에 [다시 연결 시도] 없음(LKM TC 플레이-27과 다름) | `report/slimegame_report.html`, `tc/slimegame_TC.xlsx` |
| BLOODFALL (`../뱀서라이크/bloodfall_playable.html`) | 기획서 v0.9로 38 + AI 보충 173 (BF-101~) | 194개 → **190 통과** | BF-04 미선택 시 주무기 무작위(기획 피스톨) · **BF-1402 무기 1개면 전리품 카드 2장(기획 3장)** · **BF-1118 그레이브 워든 광폭화 1.35배(기획 1.3배)** · **BF-1714 게임 중 연결 끊김 안내 안 보임** | `report/bloodfall_report.html`, `tc/bloodfall_TC.xlsx` |
| 카드팩 스튜디오 (`../스토리게임만들기/card-studio/studio.html`) | 338 (자동 327 · 수동 11) | 327개 → **326 통과** | **CS-1116 새로고침하면 카드뽑기 천장 카운트 0** (`flow2.js` 178줄 `drawState` 저장 안 됨) | `report/cardstudio_report.html`, `tc/cardstudio_TC.xlsx` |
| 캡스톤 RotDL (기획서 PDF 145쪽, 게임 없음) | 120 | 건너뜀 (문서만) | 기존 TC 고칠 점 12 · 기획서 서로 다른 부분 7 (예: 낮·밤 2시간 vs 12시간) · 추가 제안 7 | `report/rotdl_review.md`, `tc/rotdl_TC.xlsx` |

- AI가 쓴 TC는 모두 **초안** — TC 엑셀의 검토 칸에서 LKM이 `확인함`/`버림`으로 바꾼다.
- 카드팩 TC는 처음 55건(확인을 한 줄에 묶음)이었고, 규칙에 커버리지(C1~C5)를 넣은 뒤 338건이 됐다. 같은 규칙으로 슬라임·BLOODFALL을 다시 훑어 위의 새 결함·불일치 5건을 찾았다.
- 기획서와 다른 점·기존 TC 고칠 점은 `tc/<게임>_tc.json`의 `spec_issues`·`existing_review`·`suggestions`에 있다.

## 4. 판정 방식

| 게임 | 방법 |
|---|---|
| 공통 | **TC 하나 = 테스트 하나**. 테스트 이름에 `[TC 번호]`를 넣어 결과를 TC에 연결 |
| BLOODFALL·카드팩 | 상태·함수가 전역이라 게임 상태를 직접 맞춰(보스 등장 직전, 체력 30% 등) 내부 값과 화면을 함께 판정. 카드팩은 진행 상태를 localStorage에 넣어 원하는 단계에서 시작 |
| 슬라임 | 코드가 즉시 실행 함수 안이라 값을 못 읽음 → 페이지가 열리기 전에 물리 엔진(Matter) 생성 함수를 감싸 엔진을 붙잡고, 원하는 단계 슬라임을 원하는 위치에 놓아 병합 점수·경고선 경계(59/60/61%)·0.55초 유예를 확인 |
| 온라인(P2P) | 실제 연결 대신 가짜 Peer로 서버 응답·상대 메시지를 테스트가 보냄. 시간 초과는 시계를 빠르게 돌려 확인. **실제 두 기기 연결은 수동 TC** |
| 무작위 | `Math.random`·`Date.now` 고정, 확률은 수천~수만 번 뽑아 범위로 판정 (예: 아이템 박스 2,000마리 중 70~130개) |

주의: 슬라임 게임은 드롭 쿨다운(0.42초)을 페이지가 열린 뒤 시간으로 재서, 테스트는 페이지를 열고 0.7초 기다린 뒤 조작한다. 처음 실패한 테스트 중 상당수가 이런 테스트 쪽 문제였고, 실패는 원인(테스트 / 게임 / 기획)을 나눈 뒤에 결함으로 기록했다.

## 5. 실행

### 처음 한 번

```powershell
npm install
npx playwright install chromium
pip install openpyxl pymupdf
```

### 더블클릭

| 파일 | 하는 일 |
|---|---|
| `QA자동화_실행.bat` | 메뉴: 1 슬라임 / 2 BLOODFALL / 3 카드팩 / 4 전부 (테스트 → 리포트·엑셀 → **마지막에 Jira 등록 Y/N**), 5 자료 넣기·정리 / 6 자료로 만든 TC 마무리 / 7 TC 규칙 점검만 |
| `TC점검도구.html` | 서버·설치 없이 브라우저에서 TC 엑셀·JSON 규칙 점검 + 기획서 대비 빠진 문구·버튼·수치 후보. HTML·CSV 내려받기. 파일은 브라우저 밖으로 안 나감 (PDF만 무료 pdf.js를 인터넷에서 불러옴) |
| `QA자동화_화면.bat` | 내 PC 안에서만 도는 작은 서버(`tools/web_ui.py`) + 실행 화면(`web/index.html`): 게임별 테스트·Jira 등록·자료 올리기·TC 마무리. 127.0.0.1 전용, 정해진 동작만 실행. 검은 창을 닫으면 멈춤 |

### 명령 (이 폴더에서)

```powershell
npm test                     # 슬라임 (npm run report 로 리포트·엑셀)
npm run test:bloodfall       # npm run report:bloodfall
npm run test:cardstudio      # npm run report:cardstudio
npm run tc:check             # 모든 게임 TC 규칙 점검
npm run tc:xlsx              # TC 엑셀만 다시 만들기
npm run input -- --game rotdl      # 자료 정리
npm run pipeline -- --game rotdl   # TC JSON이 생긴 뒤 마무리 (게임 없으면 테스트 건너뜀)
npm run bug-demo             # 점수 공식을 틀리게 바꾼 사본으로 슬라임 테스트 → 버그를 잡는지 확인
```

- `playwright test`에 `--reporter`를 붙이면 `out/results.json`이 안 써져 리포트가 비므로 붙이지 않는다.
- bug-demo 뒤에는 `out/results.json`이 사본 결과로 바뀐다 → `npm test`를 다시 돌린다.

### 자료로 TC 만들기

`input/<게임>/`에 기획서 PDF·이미지·마크다운·기존 TC 엑셀(게임이 있으면 html 또는 경로를 적은 `game.txt`)을 넣고 `npm run input -- --game <게임>` → Claude Code에 `/tc-writing input/<게임> 자료로 TC 작성해줘 (TC 작성 규칙 044 적용)` → `npm run pipeline -- --game <게임>`. 자세한 방법은 [input/README.md](input/README.md). `input/`의 자료는 git에 올리지 않는다.

## 6. TC 엑셀 (tc/<게임>_TC.xlsx)

| 파일 | 내용 |
|---|---|
| `slimegame_TC.xlsx` | LKM 원본 엑셀 복사(필수·지정항목 시트) + 오른쪽 자동화 칸 + **'AI 보충 TC' 시트**(SG-xxx). 원본 `TC/슬라임게임_TC.xlsx`는 고치지 않음 |
| `bloodfall_TC.xlsx`, `cardstudio_TC.xlsx`, `rotdl_TC.xlsx` | 표지(작성·TC 수·우선순위 정의·결과 정의) + TC 시트 (번호·우선순위·분류·확인 항목·근거·사전 조건·테스트 내용·기대 결과·비고) |

- 자동화 칸: TC ID · 자동/수동 · 자동화하지 않은 이유 · 최근 결과(PASS/Fail/N/T) · 실행 시각 · Jira TC · Jira 버그 · 검토
- **검토 칸만 엑셀에서 고친다**(초안/확인함/버림). 다음 갱신 때 JSON에 옮겨 적힌다. TC 내용은 `tc/<게임>_tc.json`에서 고친다.
- 엑셀을 연 채로 갱신하면 저장이 안 된다 → 닫고 다시 실행.

## 7. Jira (무료 플랜)

1. https://www.atlassian.com/software/jira/free 에서 무료 사이트·스크럼 프로젝트 만들기
2. API 토큰: https://id.atlassian.com/manage-profile/security/api-tokens
3. `.env.example`을 `.env`로 복사해 값을 채운다. **`.env`는 git에 올라가지 않는다. 토큰을 다른 파일·코드·채팅에 적지 않는다.**

```powershell
python -I tools/jira_sync.py check                    # 접속 확인 (아무것도 만들지 않음)
python -I tools/jira_sync.py tcs  --game bloodfall    # TC를 작업 이슈로 (다시 돌려도 중복 없음)
python -I tools/jira_sync.py bugs --game bloodfall    # 실패 → 버그 + 스크린샷 + TC 연결 (같은 실패는 댓글)
```

설정이 비어 있으면 **드라이런**: 보낼 내용만 `out/jira_dryrun.json`에 저장한다. 현재 등록 상태: 슬라임 TC SCRUM-5~46·탐색-1 SCRUM-47, BLOODFALL TC SCRUM-48~85·BF-04 SCRUM-86, 카드팩 TC SCRUM-143~472·CS-1116 SCRUM-142. **이번 보충 TC(SG-xxx·BF-101~)와 새 결함 5건은 아직 올리지 않음.**

## 8. 한계

- TC 작성 단계는 내 PC의 Claude Code가 있어야 한다. 나머지(점검·테스트·리포트·Jira)는 AI 없이 돈다.
- 자동 테스트는 웹(html) 게임 대상. 유니티는 Unity Test Framework(무료)로 결과를 같은 리포트·Jira 흐름에 붙이는 것이 다음 단계.
- 온라인 기능은 가짜 연결로 화면 처리만 확인한다. 실제 연결·동기화는 수동 TC.
- 간헐적 결함(탐색-1)은 여러 판을 돌려도 놓칠 수 있다.
- 기획서 대비 빠진 항목 찾기(TC점검도구)는 글자 비교라 후보일 뿐이다.

## 9. 파일

| 경로 | 내용 | git |
|---|---|---|
| `tests/*.spec.js` | 게임별 테스트 코드 | 올림 |
| `tc/*_tc.json` | TC 원본(자동/수동·검토 상태·근거 대응표·검토 의견) | 올림 |
| `tc/*_TC.xlsx` | 사람이 보는 TC 엑셀 (자동 생성) | 올림 |
| `tools/` | 자료 정리·규칙 점검·엑셀·리포트·마무리·Jira·실행 화면 서버 | 올림 |
| `report/` | 결과 리포트·검토 리포트 | 올림 |
| `TC점검도구.html`, `index.html`, `web/` | 점검 도구, 소개 페이지, 실행 화면 | 올림 |
| `input/` | 기획서 등 넣은 자료 (`README.md`만 올림) | 안 올림 |
| `out/` | 실행 결과·스크린샷·Jira 기록 | 안 올림 |
| `.env` | Jira 토큰 | **절대 안 올림** |
