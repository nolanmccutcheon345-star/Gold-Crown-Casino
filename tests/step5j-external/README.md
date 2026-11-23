# External evidence packet

Read `../../STEP5J_EXTERNAL_PROTOCOL.md` first. Exact original criteria are copied in `original-criteria.json`; their IDs and wording are unchanged.

- `candidate-identity.json`: application source/assets and the packaging source at preparation. Record the actual hosted package in the blank field before execution.
- `device-reader-results.json`: duplicate once per actual device/reader session; all task outcomes start NOT_EXECUTED.
- `physical-performance.csv`: six declared-device/seat combinations; duplicate rows for repeated windows and separate phases. Empty measurements are not zero.
- `participant-results.csv`: three anonymous first-time participant slots, all NOT_EXECUTED.
- `hand-observations.csv`: 25 blank NOT_EXECUTED rows for each of P1/P2/P3. These are placeholders, not participants or played hands.
- `issues.csv`: empty issue register. Its emptiness means no study has executed, not that usability has passed.
- `INVITATION.md`: unsent invitation for the organizer to share.

Capture actual screenshots, diagnostic files and redacted completed-hand exports separately. Do not place personal identifiers, credentials, production saves or undisclosed cards in feedback. A reviewer assigns acceptance outcomes; filling template fields cannot automatically qualify a requirement.
