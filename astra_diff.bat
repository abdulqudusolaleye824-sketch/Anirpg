@echo off
setlocal enableextensions enabledelayedexpansion
REM ===========================================================================
REM  ASTRA - live bot vs trusted workspace DIFF
REM  Place THIS .bat and astra_source_manifest.txt into your anirpg bot folder
REM  (the same folder that holds index.js). Then double-click this .bat.
REM  Outputs: astra_diff_report.txt  (list of files that differ / are missing)
REM  ===========================================================================
chcp 65001 >nul
set "MANIFEST=%~dp0astra_source_manifest.txt"
set "REPORT=%~dp0astra_diff_report.txt"
set "ROOT=%~dp0"
set "SCRIPT=%~dp0astra_hash.ps1"

echo Scanning %ROOT% ... >"%REPORT%"

if not exist "%MANIFEST%" (
  echo ERROR: astra_source_manifest.txt not found next to this script. >>"%REPORT%"
  echo Place both files in the same folder, then rerun. >>"%REPORT%"
  type "%REPORT%"
  pause
  exit /b 1
)

echo ============================================================ >>"%REPORT%"
echo   ASTRA DIFF REPORT (files that differ from the good baseline) >>"%REPORT%"
echo ============================================================ >>"%REPORT%"
echo.

for /f "usebackq eol=# tokens=1,2" %%F in ("%MANIFEST%") do (
  call :process "%%F" "%%G"
)

echo ============================================================ >>"%REPORT%"
echo   DONE. Any lines above that say DIFFERENT or MISSING are files to restore. >>"%REPORT%"
echo ============================================================ >>"%REPORT%"
echo.
echo Finished. Results saved to:
echo   %REPORT%
type "%REPORT%"
endlocal
pause
goto :eof

:process
set "REL=%~1"
set "EXP=%~2"
REM RUNTIME DATA — never restored (they hold live player progress and always differ).
REM Skip them so they don't clutter the DIFFERENT list or get overwritten.
echo %REL% | findstr /i /c:"rpg\data\achievements.json" /c:"rpg\data\playerPets.json" /c:"rpg\data\playerQuests.json" /c:"rpg\data\petData.json" /c:"rpg\data\database.json" >nul && exit /b
if not exist "%ROOT%%REL%" (
  echo MISSING   %REL%  ^(your copy does not have this file^) >>"%REPORT%"
  echo MISSING   %REL%  ^(your copy does not have this file^)
  exit /b
)
REM Hash the file, line-endings normalised, via PowerShell helper.
set "GOT="
for /f "tokens=* delims=" %%H in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" "%ROOT%%REL%" 2^>nul') do set "GOT=%%H"
set "GOT=%GOT: =%"
if /i "%EXP%"=="%GOT%" exit /b
echo DIFFERENT %REL%  ^(your copy differs from the good baseline^) >>"%REPORT%"
echo DIFFERENT %REL%  ^(your copy differs from the good baseline^)
exit /b
