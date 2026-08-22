# Noctis — Project Status

## Current Step
Step 12 complete. Ready to begin Step 13 — Search and Categories.

## Completed Steps
1. Git & GitHub setup — local repo initialized, private GitHub repo created, connected, pushed.
2. Project structure — `src/noctis/`, `tests/`, `docs/`, `requirements.txt` created.
3. Development environment — Python 3.14.5 confirmed, `venv` created, `cryptography` installed.
4. Basic application entry point — `main.py` opens a tkinter window.
5. Configuration/environment setup — `config.py` for non-sensitive settings, `.env` / `.env.example` pattern established for secrets.
6. Database/local storage design — SQLite schema for password entries (`database.py`), tested manually.
7. Security architecture (planning) — designed master password → salt → PBKDF2 → key → AES/Fernet encryption → verification token flow.
8. Master-password system — salt generation, key derivation, verification token, implemented and tested in `security.py`.
9. Encryption / key management — `VaultSession` class: in-memory key handling, encrypt/decrypt entries, lock/unlock. Tested end-to-end with real database writes.
10. Authentication and failed-attempt protection — `LoginGuard` class: tracks failed attempts, escalating lockout delays (5s/15s/30s/60s), resets on success.
11. Basic UI — Design system established (`UI_DESIGN.md`: dark theme, colors, typography, spacing). Built `LoginScreen` (first-run vs unlock detection, password masking, lockout integration). Wired into `main.py`. Tested full flow end-to-end.
12. Account creation/editing/deletion — Added `update_entry()`/`delete_entry()` to `database.py`. Built `VaultScreen` (list view, shared add/edit form, delete). Wired real encrypt/decrypt via `VaultSession`. Fixed missing `database.initialize_database()` call at startup. Tested full CRUD cycle end-to-end.

## Current Task
None in progress — awaiting confirmation to start Step 13.

## Next Planned Step
Step 13 — Search and Categories (filter/search the entry list, assign and filter by category).

## Technology Stack
- Language: Python 3.14.5
- GUI: tkinter (built-in)
- Local storage: SQLite (built-in `sqlite3`)
- Encryption: `cryptography` library (PBKDF2HMAC + Fernet/AES)
- Packaging (planned, Step 19): PyInstaller

## Installed Dependencies (requirements.txt)
- cryptography==50.0.0
- cffi==2.1.1
- pycparser==3.0

## Important Decisions Made
- Passwords/sensitive data always encrypted before touching the database; only metadata (title, username, category, timestamps) stored in plain columns.
- `src` layout used with `pyproject.toml` + editable install (`pip install -e .`).
- `.env` holds real secrets (git-ignored); `.env.example` documents expected secrets and is safe to commit.
- Master password is never stored anywhere, in any form. Only a random salt and an indirect verification token (an encrypted known string) are stored in `vault_meta.json`, which is git-ignored.
- Encryption key is derived via PBKDF2 (480,000 iterations) and held only in memory (`VaultSession`) for the duration of an unlocked session — never written to disk.
- GitHub repository is private.

## Known Issues
None currently.

## Important Unfinished Work
- No search or category filtering in the vault list yet (Step 13).
- No favorites yet (Step 14).
- No auto-lock timer yet (Step 15).
- Planned future enhancement (not yet scheduled to a specific step): email alert to user's Gmail after 5 failed master-password attempts. Requires Gmail API/SMTP setup — good candidate for Step 16 (Security Hardening) or a dedicated step.

## Architecture Changes
None yet beyond the initial plan.