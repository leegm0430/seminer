@echo off
chcp 65001 > nul
cd /d "%~dp0"
title QA 자동화 실행
rem 더블클릭으로 실행: 게임 선택 → 자동 테스트 → 리포트·TC 엑셀 갱신 → (마지막) Jira 버그 등록
rem 실행 전에 TC 엑셀(tc\*.xlsx)을 닫아 두세요. 열려 있으면 엑셀 갱신이 실패합니다.

echo.
echo ===== QA 자동화 실행 =====
echo   1. 슬라임 게임   (약 3분)
echo   2. BLOODFALL     (약 1.5분)
echo   3. 둘 다         (약 5분)
echo.
set "PICK="
set /p "PICK=번호를 입력하고 Enter: "
if "%PICK%"=="1" set "GAMES=slimegame"
if "%PICK%"=="2" set "GAMES=bloodfall"
if "%PICK%"=="3" set "GAMES=slimegame bloodfall"
if not defined GAMES (
  echo 1, 2, 3 중 하나를 입력하세요.
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

:end
echo.
echo 끝. 결과: report 폴더(리포트), tc 폴더(TC 엑셀)
pause
