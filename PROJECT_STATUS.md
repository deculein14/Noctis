# Noctis — Project Status

## Current Step
Core app redesign complete (identity model + account creation UX). Ready to resume the original roadmap: Step 17 — Testing.

## Completed Steps
1. Git & GitHub setup — local repo initialized, private GitHub repo created, connected, pushed.
2. Project structure — `src/noctis/`, `tests/`, `docs/`, `requirements.txt` created.
3. Development environment — Python 3.14.5 confirmed, `venv` created, `cryptography` installed.
4. Basic application entry point — `main.py` opens a tkinter window.
5. Configuration/environment setup — `config.py` for non-sensitive settings, `.env` / `.env.example` pattern established for secrets.
6. Database/local storage design — original single-vault SQLite schema (superseded, see below).
7. Security architecture (planning) — salt → PBKDF2 → key → AES/Fernet encryption → verification token flow (still the core approach, now applied per-user).
8-9. Master password + encryption/key management — `VaultSession`, PBKDF2, Fernet — originally single-vault, later refactored to per-user (see Multi-User step).
10. Authentication and failed-attempt protection — `LoginGuard`: escalating lockout delays (5s/15s/30s/60s), later refactored to be per-username.
11. Basic UI — Design system (`UI_DESIGN.md`: dark theme, colors, typography, spacing).
12-14. Account CRUD, search/categories, favorites — original single-vault versions (schema and UI later substantially redesigned, see below).
15. Auto-lock — `AUTO_LOCK_SECONDS` config (120s default), activity tracking in `main.py`, auto-locks and returns to login after inactivity.
16. Security hardening (core items) — persistent per-user `LoginGuard` lockout (survives restarts), "Copy Password" button with 30s clipboard auto-clear. Documented, not solved: OS-level file permissions, guaranteed in-memory key wipe timing.
17. Multi-User Login/Vaults — Major redesign from single global vault to per-account isolation:
    - Considered and declined a Supabase/cloud backend to preserve Noctis's local-only, offline design.
    - `security.py`: identity keyed by **username** (not email). `users.json` stores per-username salt + verification token + email (email is metadata only, not used for login). `register_user(username, email, password)`, `user_exists(username)`, `check_master_password(username, password)`, `email_in_use(email)` (prevents one email being reused across multiple accounts). `get_database_filename(username)` derives a safe per-user `.db` filename. `LoginGuard(username)` persists per-user lockout state in `login_guards.json`. `VaultSession.unlock(username, password)` stores `self.username`.
    - `database.py`: every function takes `username` as first argument and operates on that user's own `.db` file (physically separate storage per account, not just a filtered column).
    - Master password minimum length lowered from 8 to 5 characters (any characters allowed) per explicit request.
    - Tested end-to-end: two separate accounts, confirmed full data isolation, confirmed re-login preserves each user's own entries.
18. Login/Register UX redesign — Explicit mode switching instead of auto-detection:
    - Login mode: Username + Password only. Shows "No account found... please register first" if the username doesn't exist (does not silently auto-register).
    - Register mode: Email + Username + Password. Shows "An account already exists..." if the username is taken, and separately blocks reuse of an email already tied to another account.
    - A text link toggles between modes ("No account yet? Register" / "Already have an account? Log in").
    - Password visibility (eye icon 👁) toggle added to the login screen's password field.
    - Explicitly declined: writing master passwords (in any form, including "temporary," reversible, or simple substitution ciphers) to any plaintext or lightly-obfuscated log file. This was requested multiple times and consistently declined as a serious security regression. A safe compromise (logging username/email only, never passwords, to `account_log.txt`) was designed but ultimately not applied per final direction — current code has no account activity log.
19. Account creation UX redesign — Replaced the old single "+ Add Entry" flow entirely:
    - The "+" button now opens a choice: **Category** or **Account**.
    - **Category**: simple name field, saved to a real, reusable `categories` table (no longer just inferred from existing entries).
    - **Account**: multi-field form — "What account?" (the entry's title, e.g. "Instagram"), Email (optional), Username (optional), Password (required, with eye-icon visibility toggle), Notes (optional, encrypted), URL (optional), plus a "+ Add Field" option to create arbitrary custom labeled fields (e.g. "Phone Number") via a popup dialog — custom field values are encrypted and stored in a new `custom_fields` table linked to the entry.
    - After filling the account form, a **separate category-picker screen** appears to choose where the account should be filed, before final save.
    - Database schema updated: `entries` table gained `email` and `encrypted_notes` columns; new `categories` and `custom_fields` tables added.
    - All vault screens (list, add-choice, category form, account form, category picker) wrapped in a scrollable canvas with mouse-wheel support and clamped scroll boundaries (fixed an early bug where scrolling up past the top caused visual glitching), so content is reachable without needing to maximize the window.
    - Fixed a bug where newly added custom fields were packed into the wrong parent frame and appeared below the Cancel/Continue buttons instead of above them.
20. View screen with re-authentication — Clicking an entry now shows a "View" screen (not a direct edit) listing Account Name, Category, Email, Username, Notes, URL, and any custom fields in plain readable text. The Password field stays masked with a 👁 icon; clicking it opens a popup requiring the master password to be re-entered before the real password is revealed inline (wrong password shows an error and keeps it hidden). Notes and custom fields do NOT require re-authentication (explicit scope decision — only the password itself is gated). An "Edit" button inside the View screen opens the existing edit form.
21. View screen refinements and grouped accounts —
    - Removed the "Copy" button from the entry row entirely. Added a 📋 copy icon next to every field inside the View screen (Email, Username, Notes, URL, custom fields) so a specific field's value can be copied directly. The Password field's copy icon requires the same master-password re-authentication as reveal; once entered correctly once per view, both reveal and copy work without asking again.
    - Delete now requires a second confirmation ("Are you sure you want to delete '[name]'? This cannot be undone.") via a popup before actually removing an entry — applies both on the list row and inside the View screen.
    - Edit (from the View screen) now also requires re-entering the master password before the edit form opens — wrong password cancels the edit attempt with an error message.
    - Grouped accounts: entries sharing the same account name (case-insensitive, e.g. two "Facebook" entries) now collapse into a single list row showing the name and an account count (e.g. "2 accounts"), with only a View button (no star/delete directly on the grouped row). Clicking it opens a sub-list where each account is labeled by its Notes (falling back to username/email, then "Account 1/2/3..."), each with its own Favorite toggle and a View button leading to the full View screen for that specific account. Star (Favorite) and Delete (with confirmation) were moved into the View screen itself for both grouped and single accounts, for consistency.
    - Single-account list rows now show "1 account" as the subtitle (replacing the old username/category subtitle), matching the grouped-row style; actions (star/view/delete) on single rows are unchanged.
    - Confirmed filter-chip order (All → Favorites → categories alphabetically) already matched the requested ordering — no change needed there.

## Current Task
None in progress — awaiting confirmation to resume Step 17 (Testing).

## Next Planned Step
Step 17 — Testing (automated tests, likely via `pytest`, covering `security.py` and `database.py` at minimum, given how much has changed in both).

## Technology Stack
- Language: Python 3.14.5
- GUI: tkinter (built-in)
- Local storage: SQLite (built-in `sqlite3`), one database file per user account
- Encryption: `cryptography` library (PBKDF2HMAC + Fernet/AES)
- Packaging (planned, Step 19 of original numbering): PyInstaller
- Explicitly local-only/offline by design — no cloud backend

## Installed Dependencies (requirements.txt)
- cryptography==50.0.0
- cffi==2.1.1
- pycparser==3.0

## Important Decisions Made
- Passwords and notes are always encrypted before touching the database; only metadata (title/account name, entry-username, category, timestamps, email) is stored in plain columns.
- Master password is never stored anywhere, in any form, for any account — only a random salt and an indirect verification token are stored per-username in `users.json`.
- Login identity is the **username**; email is collected at registration but used only as metadata for a possible future "forgot password" recovery feature — not for login. One email cannot be reused across multiple accounts.
- Master password minimum length: 5 characters, any characters allowed.
- Explicitly and repeatedly declined: any form of recoverable/plaintext master password storage (including substitution ciphers and "temporary" logs). If a password-recovery convenience is wanted later, the correct approach is a one-time Recovery Key (like Bitwarden/1Password), not stored password text — this was proposed but not yet built.
- Noctis supports multiple local accounts, each fully isolated: own salt, verification token, lockout state, and database file.
- Considered and declined a Supabase/cloud backend to preserve the local-only, offline design.
- Account entries now support arbitrary custom fields (encrypted), not just the fixed original field set.
- Viewing an entry's real password requires re-entering the master password at that moment (re-authentication), even though the vault is already unlocked — an extra safeguard against casually exposing passwords on screen. This check applies only to the password field itself, not notes or custom fields.
- Editing an entry (from the View screen) also requires master-password re-authentication before the edit form opens.
- Deleting an entry requires an explicit confirmation popup ("This cannot be undone") — no longer deletes on a single click.
- Multiple accounts can share the same account name (e.g. two "Facebook" logins) and are grouped together in the list, distinguished by their Notes field (e.g. "Main acc" / "Alt acc").
- GitHub repository is private.

## Known Issues
None currently.

## Important Unfinished Work
- Planned future enhancement (not yet scheduled to a specific step): email alert to a Gmail address after 5 failed master-password attempts. Requires Gmail API/SMTP setup.
- Planned future enhancement (proposed, not yet built): one-time Recovery Key system generated at registration, as the safe answer to "forgot master password," and groundwork for a future recovery flow.
- Known/accepted limitations (not planned to be fully solved): no OS-level file permission hardening on per-user `.db` files or `users.json`; in-memory encryption key is set to None on lock but not guaranteed to be wiped from RAM immediately (relies on Python garbage collection).
- `config.DATABASE_FILENAME` in `config.py` is unused (superseded by per-user filenames) — harmless leftover.
- Edit mode for existing accounts uses a single combined screen (fields + category together) rather than the two-step wizard used for creation — an intentional simplification, not a bug.

## Architecture Changes
- Multi-User Login/Vaults — changed from a single global vault to per-username accounts with isolated storage (salt, verification token, lockout state, database file per user).
- Account creation UX — replaced the single flat "Add Entry" form with a "+" → Category/Account choice, a richer account form (email, notes, custom fields), and a separate category-selection step before saving.
- Database schema — `entries` table extended (email, encrypted_notes); new `categories` and `custom_fields` tables added to support the above.