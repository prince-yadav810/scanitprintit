Agent 1.1.10 is the installed Windows app that processes customer orders. The separate Support app does not process orders.

The print page now loads from an allowlisted internal app origin, removing the file-navigation step that failed on the reported Windows laptop. The sandbox, context isolation and document access checks remain enabled. New jobs wait for the renderer self-test; failed checks and rejected pairing are visible with recovery actions. Navigation and renderer crashes are recorded separately.

Validation: 59 desktop tests, real Electron PDF round-trip, and [Windows CI](https://github.com/prince-yadav810/scanitprintit/actions/runs/43871637658). Windows checks run the actual packaged executable, packaged modules and PDF.js worker, real Windows printer enumeration/status queries, and a synthetic download → render → completion flow with duplicate prevention. Physical print submission is intercepted in CI. **Paper output on the reported Canon laptop still needs confirmation; this release is a hardware-validation candidate.** The automatic-update feed is unchanged.

Install ScanItPrintIt-Agent-Setup-1.1.10.exe, open ScanItPrintIt Agent, pair if prompted, select the exact printer, and use Print test page. Once paper output succeeds, submit a fresh PDF order through the shop QR link. An expired upload cannot be restored by retrying.

The installer was built on Windows from commit aeb2e4f906739cea34cd385154ee2889fdef1bf8. Matching desktop source and SHA-256 checksums are attached.
