; Install-time shutdown protocol. Never stop an agent merely by opening setup.
; New agents carry an external marker proving they understand --quit-for-update.
; Older agents must use the standard legacy check; passing an unknown flag to
; those versions could start another polling/printing process.
!include "getProcessInfo.nsh"
Var pid

!macro customCheckAppRunning
  ${If} ${FileExists} "$INSTDIR\resources\graceful-upgrade.json"
    DetailPrint "Asking ScanItPrintIt Agent to finish its print job and exit..."
    nsExec::ExecToStack /TIMEOUT=10000 '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --quit-for-update'
    Pop $R0
    Pop $R2
    StrCpy $R1 0
    ${Do}
      !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
      ${If} $R0 != 0
        ${ExitDo}
      ${EndIf}
      Sleep 1000
      IntOp $R1 $R1 + 1
      ${If} $R1 >= 300
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "The agent is still finishing a print job, or Windows is preventing it from closing.$\r$\n$\r$\nWait for the print job and click Retry. If no job is running, use the tray menu to Quit. If Windows reports access denied, close setup and run it as administrator." /SD IDCANCEL IDRETRY +2
        Quit
        StrCpy $R1 0
      ${EndIf}
    ${Loop}
  ${Else}
    ; Retains Windows' normal permissions checks for old installed versions.
    !insertmacro _CHECK_APP_RUNNING
  ${EndIf}
!macroend
