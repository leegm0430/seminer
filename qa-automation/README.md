# 슬라임 게임 QA 자동화 (Playwright + Jira 무료 플랜)

- 작성일: 2026-11-01
- 작성자: Claude Code (자동화 대상 선정·코드 초안) / 원본 TC·게임: LKM
- 비용: 0원 — Playwright(오픈소스), Python 표준 라이브러리, Jira Cloud 무료 플랜 REST API만 사용. 유료 앱(Zephyr)·Rovo(크레딧)·AI API 호출 없음.

## 무엇을 하나

```
TC/슬라임게임_TC.xlsx (58건, LKM 작성)
   └─ 자동화할 22건 + 탐색 중 추가 1건 선정 → tc/slimegame_tc.json (검토: 초안 → LKM이 확인함/버림)
        └─ tests/slimegame.spec.js : Playwright가 크롬에서 게임을 직접 조작
             └─ out/results.json → tools/make_report.py → report/slimegame_report.html
             └─ 실패 → tools/jira_sync.py bugs → Jira 버그 이슈 + 스크린샷 (같은 실패는 댓글만)
```

## 결과 (2026-11-01)

| 항목 | 값 |
|---|---|
| 자동화한 기존 TC | 22 / 58 (나머지 36건은 자동화하지 않은 이유를 리포트에 기록) |
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
python -I tools/jira_sync.py tcs     # TC 42건을 작업 이슈로 등록 (한 번만, 다시 돌려도 중복 없음)
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
| `tc/slimegame_tc.json` | 자동화 TC·검토 상태·수동 TC 이유 | 올림 |
| `tools/` | 리포트·Jira 연동·버그 데모 (Python 표준 라이브러리) | 올림 |
| `report/` | 포트폴리오용 결과 리포트 | 올림 |
| `out/` | 실행 결과·스크린샷·Jira 기록 | 안 올림 |
| `.env` | Jira 토큰 | **절대 안 올림** |
