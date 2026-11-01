@echo off
chcp 65001 > nul
cd /d "%~dp0"
title QA 자동화 실행
rem 더블클릭으로 실행
rem   1~4: 게임 자동 테스트 → 리포트·TC 엑셀 갱신 → (마지막) Jira 버그 등록
rem   5~7: 자료(기획서 PDF·이미지·엑셀)로 TC 만들기 — 게임이 없어도 됨 (input\README.md)
rem 실행 전에 TC 엑셀(tc\*.xlsx)을 닫아 두세요. 열려 있으면 엑셀 갱신이 실패합니다.

echo.
echo ===== QA 자동화 실행 =====
echo  [게임 자동 테스트]
echo   1. 슬라임 게임       (약 3분)
echo   2. BLOODFALL         (약 1.5분)
echo   3. 카드팩 스튜디오   (약 4분)
echo   4. 전부              (약 9분)
echo  [자료로 TC 만들기 - 게임이 없어도 됨]
echo   5. 자료 넣기·정리     (input 폴더에 기획서 PDF·이미지·엑셀을 넣고 TC 작성용으로 정리)
echo   6. 자료로 만든 TC 마무리 (규칙 점검 · TC 엑셀 · 검토 리포트, 게임 파일이 있으면 자동 테스트까지)
echo   7. TC 규칙 점검만     (모든 게임 TC를 작성 규칙 044로 점검)
echo.
set "PICK="
set /p "PICK=번호를 입력하고 Enter: "
if "%PICK%"=="1" set "GAMES=slimegame"
if "%PICK%"=="2" set "GAMES=bloodfall"
if "%PICK%"=="3" set "GAMES=cardstudio"
if "%PICK%"=="4" set "GAMES=slimegame bloodfall cardstudio"
if "%PICK%"=="5" goto prepare
if "%PICK%"=="6" goto pipeline
if "%PICK%"=="7" goto check
if not defined GAMES (
  echo 1~7 중 하나를 입력하세요.
  goto end
)

for %%G in (%GAMES%) do call :run %%G

echo.
echo ===== 마지막 단계: Jira 버그 등록 =====
echo 실패한 테스트를 Jira에 버그 이슈로 올립니다. 스크린샷 첨부, TC 연결, 같은 실패는 새 이슈 대신 댓글.
set "JIRA="
set /p "JIRA=Jira에 등록할까요? (Y/N): "
if /i not "%JIRA%"=="Y" (
  echo Jira 등록을 건너뜁니다.
  goto end
)
for %%G in (%GAMES%) do (
  echo.
  echo --- %%G Jira 등록 ---
  copy /y "out\results_%%G.json" "out\results.json" > nul
  python -I tools\jira_sync.py bugs --game %%G
)
goto end

:run
echo.
echo ===== [%1] 1/2 자동 테스트 실행 =====
call npx playwright test tests/%1.spec.js
rem 다음 게임 테스트가 결과 파일을 덮어쓰므로 게임별로 복사해 둔다 (마지막 Jira 단계에서 사용)
copy /y "out\results.json" "out\results_%1.json" > nul
echo.
echo ===== [%1] 2/2 리포트·TC 엑셀 갱신 =====
python -I tools\make_report.py --game %1
start "" "report\%1_report.html"
goto :eof

rem ---------------------------------------------------------------- 5. 자료 넣기·정리
:prepare
echo.
python -I tools\prepare_input.py --list
echo 위 목록의 이름을 쓰거나, 새 게임이면 새 이름(영문 소문자, 예: mygame)을 쓰세요.
set "PGAME="
set /p "PGAME=게임 이름: "
if not defined PGAME goto end
if not exist "input\%PGAME%\" (
  mkdir "input\%PGAME%"
  echo.
  echo input\%PGAME% 폴더를 만들고 열었습니다.
  echo 기획서 PDF·이미지·기존 TC 엑셀을 넣으세요. 게임 html이 있으면 같이 넣거나 game.txt에 경로를 한 줄 쓰세요.
  start "" "input\%PGAME%"
  echo 다 넣었으면 아무 키나 누르세요.
  pause > nul
)
python -I tools\prepare_input.py --game %PGAME%
echo.
echo ===== 다음 단계 =====
echo  1) Claude Code에 이렇게 요청하세요:  input/%PGAME% 자료로 TC 작성해줘
echo     - 정리본 input\%PGAME%\_입력정리.md 와 그림 쪽(_pages)을 읽고 tc\%PGAME%_tc.json 을 씁니다 (AI API 비용 없음)
echo  2) TC가 만들어지면 이 실행 파일의 6번으로 마무리하세요 (Claude Code가 마무리까지 하면 생략)
goto end

rem ---------------------------------------------------------------- 6. 자료로 만든 TC 마무리
:pipeline
echo.
python -I -X utf8 -c "import sys; sys.path.insert(0, 'tools'); from common import GAMES; print('TC가 있는 게임:', ', '.join(GAMES))"
set "PGAME="
set /p "PGAME=게임 이름: "
if not defined PGAME goto end
if not exist "tc\%PGAME%_tc.json" (
  echo tc\%PGAME%_tc.json 이 없습니다. 먼저 5번으로 자료를 정리하고 Claude Code에 TC 작성을 요청하세요.
  goto end
)
python -I tools\qa_pipeline.py --game %PGAME%
if exist "report\%PGAME%_review.md" start "" "report\%PGAME%_review.md"
if exist "tc\%PGAME%_TC.xlsx" start "" "tc\%PGAME%_TC.xlsx"
goto end

rem ---------------------------------------------------------------- 7. TC 규칙 점검만
:check
echo.
python -I tools\check_tc.py --all
goto end

:end
echo.
echo 끝. 결과: report 폴더(리포트·검토 리포트), tc 폴더(TC 엑셀)
pause
