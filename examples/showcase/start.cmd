@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
for %%I in ("%~dp0..\..") do set "REPO=%%~fI"

rem parse arguments: [node|python] [--fresh] [--foreground] | stop
set "ENGINE="
set "MODE=start"
set "FRESH="
set "EXTRA="
if /i "%~1"=="stop" set "MODE=stop"
if /i "%~1"=="node" set "ENGINE=node"
if /i "%~1"=="python" set "ENGINE=python"
for %%A in (%*) do (
  if /i not "%%A"=="node" if /i not "%%A"=="python" if /i not "%%A"=="stop" if /i not "%%A"=="--fresh" set "EXTRA=!EXTRA! %%A"
  if /i "%%A"=="--fresh" set "FRESH=1"
)

if "%MODE%"=="start" if not defined ENGINE goto menu
goto after_menu

:menu
echo.
echo  TUX Showcase - choose the engine that runs the review server:
echo    1  Node  (npm package tux-review)
echo    2  Python (PyPI package tux-review)
set "CH="
set /p "CH=Choice [1]: "
if not defined CH set "CH=1"
if "%CH%"=="1" (set "ENGINE=node" & goto after_menu)
if "%CH%"=="2" (set "ENGINE=python" & goto after_menu)
echo  Invalid choice.
goto menu

:after_menu
if "%ENGINE%"=="node" call :resolve_node
if "%ENGINE%"=="python" call :resolve_python
if not defined TUX call :resolve_any

if "%MODE%"=="stop" (
  !TUX! design stop-review
  goto :end
)

rem seed example comments (only when the store is missing)
if exist ".tux\feedback.json" if not defined FRESH goto have_store
if exist ".tux" rmdir /s /q ".tux"
echo Seeding example comments ...
!TUX! feedback create --type change   --text "Make the primary CTA more prominent."       --route /                     --component Hero          --tux-id hero-cta        --session showcase >nul
!TUX! feedback create --type question --text "Should the prices include VAT here?"        --route /products             --component ProductCard   --instance card-2        --tux-id price-card-2   --session showcase >nul
!TUX! feedback create --type issue    --text "Price overlaps the badge on small screens." --route /product/aurora-lamp  --component ProductDetail --instance aurora-lamp   --tux-id product-price  --session showcase >nul
!TUX! feedback create --type change   --text "The submit button should read 'Pay now'."   --route /checkout             --component CheckoutForm  --tux-id checkout-submit --session showcase >nul
!TUX! feedback create --type approval --text "Specs tab layout approved as is."           --route /product/aurora-lamp  --component ProductTabs   --tux-id specs-tab       --session showcase >nul

:have_store
echo.
echo Starting the TUX design review server ...
!TUX! design start-review !EXTRA!
echo.
echo  Showcase: http://127.0.0.1:4321   (stop with: start.cmd stop)
goto :end

:resolve_node
where tux >nul 2>nul
if not errorlevel 1 (
  set "TUX=tux"
  goto :eof
)
if exist "%REPO%\js\bin\tux.js" (
  set "TUX=node "%REPO%\js\bin\tux.js""
  goto :eof
)
set "TUX=npx --yes --package=tux-review tux"
goto :eof

:resolve_python
if exist "%REPO%\.venv\Scripts\python.exe" (
  set "TUX="%REPO%\.venv\Scripts\python.exe" -m tux"
  goto :eof
)
where tux >nul 2>nul
if not errorlevel 1 (
  set "TUX=tux"
  goto :eof
)
set "TUX=pipx run tux-review tux"
goto :eof

:resolve_any
where tux >nul 2>nul
if not errorlevel 1 (
  set "TUX=tux"
  goto :eof
)
if exist "%REPO%\js\bin\tux.js" (
  set "TUX=node "%REPO%\js\bin\tux.js""
  goto :eof
)
set "TUX=pipx run tux-review tux"
goto :eof

:end
endlocal
