@echo off
chcp 65001 > nul
cd /d "%~dp0"
title QA 자동화 화면 (이 창을 닫으면 화면도 멈춤)
rem 더블클릭: 내 PC 전용 작은 서버를 켜고 브라우저로 실행 화면(web/index.html)을 연다. 파이썬 표준 라이브러리만 사용.
rem 예전 메뉴 방식은 QA자동화_실행.bat 그대로 쓸 수 있다.
python -I tools\web_ui.py
pause
