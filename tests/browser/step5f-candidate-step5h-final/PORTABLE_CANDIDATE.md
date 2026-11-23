# Separate review candidate

This package does not publish or upgrade Version 7. It includes the exact application bytes named in its successful release-check receipt, a separate observation wrapper, and blank review forms. Packaging is not proof of a passed physical-device, screen-reader, hosted-CI or new-user test.

## Desktop local review

1. Unzip into a new folder. Do not put it inside the production site's hosting directory.
2. With Python 3 installed, run `python serve_candidate.py` from that folder. It verifies the packaged file hashes first and serves this folder only, bound to `127.0.0.1` by default.
3. Open `http://localhost:8765/?measurePerformance=1`. Use **Verify and open candidate**. Save the resulting complete URL, including its generated `run` value, for reload testing. A new `run` value creates a separate test save; it does not erase an existing one.
4. Record the candidate commit printed on the page. Follow the checklist and export observations after each measurement phase. Stop the server with Ctrl+C when finished.

## Actual iPhone and other physical devices

An authorized reviewer must host this static package on a **separate HTTPS origin**, with access restricted as their review process requires. There is no candidate hosting URL created by this ZIP. The production origin is refused. Do not upload this package over the live site or point the wrapper at production storage. Do not import real production backups into the review account.

Open that approved HTTPS URL on the device itself, append `?measurePerformance=1`, and follow `PHONE_CHECKLIST.md`. Record the actual model, OS version, browser version, orientation, power mode and candidate source. The harness blocks startup if the secure context, cryptographic API or IndexedDB prerequisites are unavailable. Supported browsers may not expose heap, Event Timing or Long Tasks; unavailable readings are recorded as unavailable, never zero.

The optional `--bind 0.0.0.0` server flag is an explicit network-access choice for an already authorized review network. This small server provides **no authentication and no TLS**. Plain HTTP on a LAN IP is usually not a secure context and may disable application cryptography or Safari file sharing. It is not a substitute for an approved HTTPS candidate address and must not be claimed as ready physical-device access. Do not disable browser security to make it work.

## Data and measurement boundaries

The page runs the candidate's original JavaScript and CSS bytes unchanged. Only the default IndexedDB database name is remapped to `ai-texas-step5f-external-<run>`, on the separate review origin. The instrumentation reads allowlisted visible UI values and opt-in numeric timing events. It does not read private cards, deck data, bot parameters, controller objects or stored saves, and it never proposes or commits poker actions.

The `measurePerformance=1` bridge reports processing duration, including `bot.prepare` when supported by the packaged candidate. It excludes intentional think-time. DOM confirmation and following-frame timings are proxies: they are not durable-commit, actual screen paint or full INP measurements. The wrapper adds measurement overhead. Compare like-for-like runs and retain the candidate identity and measurement flags. The visible application, not the wrapper's successful asset check, decides when financial recovery is verified and actions can be enabled.

Record initial startup, active gameplay, history browsing, full archive audit, reload and extended play separately. Export the observation file before **Begin next measurement phase**. Keep original observation files alongside the completed forms. Review actual app History export independently from the wrapper's diagnostic export.

Use the real reader instructions in `SCREEN_READER.md`, and the neutral three-participant protocol in `NEW_USER_STUDY.md`. The invitation remains a draft until an actual approved candidate URL is supplied. No messages are sent by this package.

To verify distributed bytes independently, compare the ZIP SHA-256 against the separately supplied packaging receipt. `PACKAGE_MANIFEST.json` records each internal file's size and SHA-256, the candidate commit, packaging commit, lockfile and builder. The copy of the release receipt preserves its original source and execution date; later packaging does not retag earlier results.
