# Noctis — Project Status

## Current Step
Multi-User Login/Vaults complete. Ready to begin Step 17 — Testing.

## Completed Steps
1. Git & GitHub setup — local repo initialized, private GitHub repo created, connected, pushed.
2. Project structure — `src/noctis/`, `tests/`, `docs/`, `requirements.txt` created.
3. Development environment — Python 3.14.5 confirmed, `venv` created, `cryptography` installed.
4. Basic application entry point — `main.py` opens a tkinter window.
5. Configuration/environment setup — `config.py` for non-sensitive settings, `.env` / `.env.example` pattern established for secrets.
6. Database/local storage design — SQLite schema for password entries (`database.py`), tested manually.
7. Security architecture (planning) — designed master password → salt → PBKDF2 → key → AES/Fernet encryption → verification token flow.
8. Master-password system (superseded, see Multi-User step below) — original single-vault version implemented and tested.
9. Encryption / key management — `VaultSession` class: in-memory key handling, encrypt/decrypt entries, lock/unlock.
10. Authentication and failed-attempt protection — `LoginGuard` class: tracks failed attempts, escalating lockout delays (5s/15s/30s/60s), resets on success.
11. Basic UI — Design system established (`UI_DESIGN.md`: dark theme, colors, typography, spacing). Built `LoginScreen`, wired into `main.py`.
12. Account creation/editing/deletion — `update_entry()`/`delete_entry()` in `database.py`. Built `VaultScreen` (list, shared add/edit form, delete). Real encrypt/decrypt via `VaultSession`.
13. Search and categories — `get_all_categories()`. Live search box and category filter chips in `VaultScreen`. Category field added to add/edit form.
14. Favorites — `toggle_favorite()`. Star toggle per entry and a "Favorites" filter chip.
15. Auto-lock — `AUTO_LOCK_SECONDS` config (default 120s). `main.py` tracks activity window-wide and auto-locks after inactivity.
16. Security hardening (core items) — Persistent `LoginGuard` lockout (survived restarts, later refactored to be per-user — see below). "Copy Password" button with 30-second clipboard auto-clear. Documented, not solved: OS-level file permission hardening, guaranteed in-memory key wipe timing.
17. Multi-User Login/Vaults (new step, inserted after Step 16) — Major architecture change from single global vault to per-email accounts:
    - `security.py`: `users.json` (dict keyed by normalized email → salt + verification token) replaces single `vault_meta.json`. `register_user()`/`user_exists()`/`check_master_password()` now take an email. `LoginGuard` now takes an email in its constructor and persists per-user state in `login_guards.json` (replaces global `login_guard.json`). `VaultSession.unlock(email, password)` stores `self.email`. `get_database_filename(email)` derives a safe per-user filename.
    - `database.py`: every function (`get_connection`, `initialize_database`, `add_entry`, `get_all_entries`, `update_entry`, `delete_entry`, `get_all_categories`, `toggle_favorite`) now takes `email` as its first argument and opens that user's own `.db` file — physically separate storage per user, not just a filtered column.
    - `ui.py`: `LoginScreen` rebuilt with Email + Password fields (title "Noctis"); detects new vs. existing email on submit and registers or unlocks accordingly. `VaultScreen` reads `self.email = session.email` and threads it through every database call.
    - `main.py`: `on_login_success(email, password)` signature updated; `database.initialize_database()` moved to run per-user after login instead of once globally at startup.
    - Tested end-to-end: two separate test accounts, confirmed fully isolated data (no cross-user leakage), confirmed re-login preserves each user's own entries.
    - Decision: stayed fully local/offline (considered and declined Supabase/cloud backend — see Important Decisions Made).

## Current Task
None in progress — awaiting confirmation to start Step 17 (renumbered: Testing is now effectively "Step 17" in sequence after the inserted Multi-User step, though original numbering also called this Step 17 — no conflict).

## Next Planned Step
Step 17 — Testing (write automated tests, likely using `pytest`, covering security.py and database.py at minimum).

## Technology Stack
- Language: Python 3.14.5
- GUI: tkinter (built-in)
- Local storage: SQLite (built-in `sqlite3`), one database file per user
- Encryption: `cryptography` library (PBKDF2HMAC + Fernet/AES)
- Packaging (planned, Step 19): PyInstaller
- Explicitly local-only/offline by design — no cloud backend (Supabase was considered and declined to preserve this property)

## Installed Dependencies (requirements.txt)
- cryptography==50.0.0
- cffi==2.1.1
- pycparser==3.0

## Important Decisions Made
- Passwords/sensitive data always encrypted before touching the database; only metadata (title, username, category, timestamps) stored in plain columns.
- `src` layout used with `pyproject.toml` + editable install (`pip install -e .`).
- `.env` holds real secrets (git-ignored); `.env.example` documents expected secrets and is safe to commit.
- Master password is never stored anywhere, in any form, for any user. Only a random salt and an indirect verification token (an encrypted known string) are stored per-email in `users.json`, which is git-ignored.
- Encryption key is derived via PBKDF2 (480,000 iterations) and held only in memory (`VaultSession`) for the duration of an unlocked session — never written to disk.
- Noctis supports multiple local user accounts (by email), each with a fully isolated master password, salt, verification token, login lockout state, and database file. One account cannot see or affect another's data.
- Considered switching to Supabase (cloud backend) for multi-user auth; explicitly declined to preserve Noctis's local-only/offline design. Multi-user support was instead built natively and locally.
- GitHub repository is private.

## Known Issues
None currently.

## Important Unfinished Work
- Planned future enhancement (not yet scheduled to a specific step): email alert to user's Gmail after 5 failed master-password attempts. Requires Gmail API/SMTP setup.
- Polish item (do near the end, after core steps are done): add a Show/Hide (eye icon) toggle button next to the password field in the add/edit form, so the real password can be viewed without relying on copy-paste. Not tied to a specific numbered step.
- Known/accepted limitations (not planned to be fully solved): no OS-level file permission hardening on per-user `.db` files or `users.json`; in-memory encryption key is set to None on lock but not guaranteed to be wiped from RAM immediately (relies on Python garbage collection).
- `config.DATABASE_FILENAME` in `config.py` is now unused (superseded by per-user filenames from `security.get_database_filename()`) — harmless leftover, can be removed during a later cleanup pass.

## Architecture Changes
- Multi-User Login/Vaults (see Completed Steps) — changed from a single global vault to per-email accounts with isolated storage. This is the most significant architecture change since the original plan and supersedes the single-vault design from Steps 7-9.