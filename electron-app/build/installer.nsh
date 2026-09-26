; Custom NSIS installer script for ScanItPrintIt Agent
; Force-kill the running agent before installation so the installer never gets stuck

!macro customInit
  ; Kill any running instance of the agent BEFORE the installer checks for mutex
  nsExec::ExecToLog 'taskkill /F /IM "ScanItPrintIt Agent.exe" /T'
  ; Small delay to let Windows release file handles
  Sleep 2000
!macroend
