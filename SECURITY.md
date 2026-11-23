# Security and privacy

AI Texas Hold Em is a private-development, virtual-play-money simulator. It has no payment, deposit, withdrawal or real-money gambling service. Report suspected defects privately to the repository owner through the established project channel or GitHub private vulnerability reporting when enabled; do not put credentials or guest save files in public issues.

The engine owns cards, betting legality and chip settlement. Bots receive their own hole cards and permitted public observations, not other seats' hidden cards or the deck. This is application-level isolation in a single-player browser; developer tools can inspect local state. Do not describe local cards as cryptographically secret from the device owner.

Guest saves are browser-local and origin-specific. Production, R1 testing and private Version 12 are distinct origins. Do not copy a user's real guest save into source, fixtures, CI artifacts or another origin without explicit permission. IndexedDB can be erased by the user or evicted by the browser; periodic public history export does not replace a verified full-state recovery backup. Public imports are study-only and cannot credit the live wallet.

Keep credentials outside Git. Do not add `.env` files, private keys, personal bankroll exports, session secrets or connector tokens. CI uses read-only repository permission, immutable action commits, no persisted checkout credential and no deployment secret. A successful workflow is not production-release permission. Production Version 7 remains live until every mandatory R1 gate passes and the owner authorizes the release.

Before accepting an import or rollback, validate schema, sequence/hash integrity, financial reconciliation and provenance. Stop gameplay on unverified state; never reset silently or redeploy older code over an incompatible save. Follow `docs/RELEASE_AND_RESTORE.md` and the preserved V7-R procedure.
