# Noctis — Project Status

## Current Step
Images & Videos section (Folders) is built and tested. This followed the pywebview UI migration (see Completed Steps 1-21) and the Subscriptions feature build-out. Testing the Subscriptions feature end-to-end is still pending from before the Images & Videos detour.

### Why the pywebview pivot happened (background)
User wanted real CSS animations/hover transitions, which tkinter cannot do (no animation/transition system). Confirmed via a working pywebview proof-of-concept before committing to the migration. This aligns Noctis's stack with how real commercial password managers (1Password, Bitwarden) build their desktop UIs (HTML/CSS/JS wrapped in a native window), using a lighter Python-friendly tool (pywebview) instead of Electron/Node.js.

## Completed Steps
1. Git & GitHub setup — local repo initialized, private GitHub repo created (later made public — see below), connected, pushed.
2. Project structure — `src/noctis/`, `tests/`, `docs/`, `requirements.txt` created.
3. Development environment — Python 3.14.5 confirmed, `venv` created, `cryptography` installed.
4. Basic application entry point — `main.py` opens a tkinter window (later replaced by pywebview — see below).
5. Configuration/environment setup — `config.py` for non-sensitive settings, `.env` / `.env.example` pattern established for secrets.
6. Database/local storage design — original single-vault SQLite schema (superseded by multi-user + feature-specific tables — see below).
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
    - Password visibility (eye icon) toggle added to the login screen's password field.
    - Explicitly declined: writing master passwords (in any form, including "temporary," reversible, or simple substitution ciphers) to any plaintext or lightly-obfuscated log file.
19. Account creation UX redesign — Replaced the old single "+ Add Entry" flow entirely:
    - The "+" button now opens a choice: **Category** or **Account**.
    - **Category**: simple name field, saved to a real, reusable `categories` table.
    - **Account**: multi-field form — title, Email (optional), Username (optional), Password (required), Notes (optional, encrypted), URL (optional), plus a "+ Add Field" option for arbitrary custom labeled fields (encrypted, stored in a `custom_fields` table linked to the entry).
    - Separate category-picker screen appears before final save.
    - Database schema updated: `entries` table gained `email` and `encrypted_notes` columns; new `categories` and `custom_fields` tables added.
20. View screen with re-authentication — "View" screen lists Account Name, Category, Email, Username, Notes, URL, custom fields in plain text. Password stays masked; a popup requires the master password before revealing it inline. Notes/custom fields do NOT require re-authentication. "Edit" button opens the existing edit form.
21. View screen refinements and grouped accounts —
    - Per-field copy icons inside the View screen (Email, Username, Notes, URL, custom fields). Password's copy icon requires the same master-password re-authentication as reveal.
    - Delete requires a second confirmation popup before removing an entry.
    - Edit (from the View screen) also requires re-entering the master password.
    - Grouped accounts: entries sharing the same account name collapse into a single list row ("N accounts"); a sub-list shows each individually labeled account, each with its own Favorite toggle and View button.

### pywebview UI migration (superseded tkinter — items below happened in sequence)
1. Project structure for the web UI: `src/noctis/web/` folder created; `main.py` rebuilt with a pywebview `Api` class bridging JS calls to `security.py`.
2. Login/Register screen rebuilt (`login.html`, `style.css`, `login.js`): mode toggle, email field shown only in register mode, password show/hide toggle, real CSS focus/hover transitions.
3. Vault list rebuilt (`vault.html`, `vault.css`, `vault.js`): grouping by account name, live search, category chips, Favorites chip, star toggle, delete with confirmation.
   - **Bug fixed:** calling `window.load_url(...)` from inside a Python API method caused the app to freeze on Windows (a known pywebview gotcha — API calls run on a background thread, and navigation from that thread can deadlock the UI thread). Fix: Python API methods only return data; all page navigation happens in JavaScript. **Rule: never call `window.load_url()` from inside a Python API method.**
4. Account/Category creation modal flow built into the vault page. `pendingAccount` draft object introduced to prevent form fields clearing when custom fields are added/removed or when navigating back from the category picker.
   - **Bug fixed — registration auto-login:** registering now returns to the Login form with a message instead of auto-logging in.
   - **Bug fixed — empty vault list on first login:** added a `pywebviewready` event guard before the first `loadEntries()` call, since `window.pywebview.api` isn't injected instantly after `window.location.href` navigation. **Rule: any page that calls the API immediately on load must guard with this check.**
5. View screen rebuilt with copy icons, masked/revealed password gated behind a custom master-password modal (`promptForMasterPassword`), Favorite/Delete moved into the View screen, grouped sub-list screen.
6. Category management: right-click a category chip for Rename/Delete (updates both the `categories` table and any accounts using that name).
7. Final wiring and cleanup pass — confirmed no leftover placeholder `alert()`s remained for Accounts.
8. Professional design system overhaul (CSS-only): design tokens (color, spacing, radius, shadow) in `style.css`, layered dark palette, typography hierarchy, button hierarchy, pill badges, layered modal shadows/blur, app tagline ("Local. Encrypted. Yours.").
9. Replaced all emoji icons with a monochrome inline SVG icon set (`stroke="currentColor"`/`fill="currentColor"`) across password show/hide, copy buttons, remove-field button, favorite star, "+" button.
10. Repo housekeeping: added `LICENSE` (MIT) and `.gitattributes` (LF line endings). Repository made public after verifying via full Git history search that no secrets (`.env`, `users.json`, `*.db`) were ever committed.
11. Accessibility/interaction polish on the Add Account/Category modal: `aria-label`s, visible focus rings, 40px minimum touch targets, fade+scale modal entrance animation (respects `prefers-reduced-motion`), auto-focus on first field, Escape closes modals.
12. Bundled Inter variable font (`web/fonts/Inter-Variable.ttf`) via `@font-face`, replacing system font, keeping the app's zero-runtime-internet-dependency design.
13. View screen redesign: colored avatar circle per account (deterministic hash-based color), field-type icons, grouped "Login Details"/"Additional Information" sections, elevated card wrapper, monospace revealed password, copy-confirmation flash, Escape-to-go-back.
14. Confirm Password field on registration, shown only in Register mode.
15. Email verification during registration (Noctis's only feature requiring internet access, and only at this one moment):
    - Uses the user's own Gmail account via an App Password (`.env`: `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`), via `python-dotenv`.
    - **Security incident during setup:** a real App Password was accidentally pasted into chat. Flagged immediately; user revoked and regenerated it before it was ever used in code.
    - `security.py`: `send_verification_code(email)` / `check_verification_code(email, code)`, 10-minute expiry, single-use, stored in git-ignored `pending_verifications.json`.
    - Three-step registration flow: fill fields → send code → enter code → `confirm_registration` creates the account only after a correct code.
    - Input filter restricts the code field to digits only.
    - `pending_verifications.json` and `account_log.txt` added to `.gitignore`.
16. Fixed window size and sidebar navigation:
    - Window fixed at 1200×800, non-resizable.
    - Persistent left sidebar in `vault.html`: **Accounts** → **Subscriptions** → **Images & Videos** → **Settings**.
    - Sidebar click handling in `vault.js` swaps visible `.content-section` and calls that section's load function.
17. Subscriptions feature: `subscriptions` and `subscription_fields` tables (plain text, not encrypted — explicit decision, differs from the Accounts encryption model). CRUD API methods, no master-password re-authentication gating. List view, add/edit modal, detail/View screen mirroring the Accounts visual style.
18. Subscriptions UX overhaul:
    - **Privileges list**: dedicated always-visible bullet list (separate table `subscription_privileges`), additive to the existing "+ Add Field" custom fields.
    - **Hover-to-expand row**: entire row clickable/keyboard-accessible, hover/focus expands to preview privileges via CSS `max-height` transition.
    - **End date pill** shown on the row when `date_ended` is set.
19. Notification bell for upcoming renewals: fixed top-right of the whole window (visible from every section), red dot when a subscription is due in 30/7/3/1 days or overdue, dropdown listing due subscriptions with countdown labels, clicking navigates to that subscription's detail view. Refreshes after any subscription save/update/delete and on initial load.
    - **Bug fixed — content cut off when jumping via notification:** added global `overflow-x: hidden` and a `resetScroll()` helper called on every view transition.
    - Bell placement iterated twice before settling on `position: fixed` anchored to the window, independent of sidebar width.
20. Subscription amount in PHP (peso):
    - Live currency conversion (Frankfurter API) was tried and reverted due to connectivity issues — reaffirms the offline-first design principle.
    - `subscriptions.amount` (REAL) entered/stored directly in PHP, no currency selection. Leftover unused `currency`/`php_amount` columns from the abandoned attempt remain in the schema (harmless).
    - Amount field uses `type="text" inputmode="decimal"` with a live input filter (not `type="number"`, to avoid spinner arrows).
    - Displayed in three places: list row pill, View screen field, notification dropdown (`formatPHP()` helper used consistently).
21. Images & Videos — Folders feature:
    - New `folders` table (name, description, timestamps) and `folder_files` table (original filename, stored filename, file type, per folder) added to `database.py`.
    - New `security.get_media_directory(username)` returns a per-user root folder (`media_<username>`) for storing inserted files, following the same naming convention as `get_database_filename`.
    - Folder CRUD via `main.py` API methods (`get_folders`, `save_folder`, `update_folder`, `delete_folder`) — plain metadata, no encryption, no re-auth needed for these, consistent with the Subscriptions "not a secret" precedent.
    - **Opening** a folder requires master-password re-authentication (`open_folder` API method, same pattern as `reveal_password`) before its contents are shown — explicit design choice, unlike Subscriptions.
    - **Inserting media**: `insert_media_file` opens the native Windows file picker (`create_file_dialog`), restricted to image/video extensions. The selected file is **moved** (not copied) into `media_<username>/<folder_id>/`, renamed to a random UUID on disk to avoid collisions, with the original filename preserved in the database for display. Files are stored **unencrypted** (explicit decision — the folder itself still requires master-password re-auth to open, but the files at rest are plain).
    - **Displaying media**: `get_folder_files` reads each file from disk and returns it as a base64 `data:` URL rather than a `file:///` path — `file:///` URLs are blocked by the WebView2 engine pywebview uses on Windows, causing images/videos to silently fail (broken-image icon). Base64 embedding bypasses this reliably. (Trade-off: large video files will feel slower to open since the whole file is base64-encoded into the page; acceptable for now — revisit later, e.g. pywebview's HTTP server mode, if large-video performance becomes an issue.)
    - UI: folder rows match the Accounts/Subscriptions row style; opening a folder shows a detail view with a thumbnail grid (`aspect-ratio: 1/1` cells) — images render as `<img>` thumbnails, videos show a film-strip icon placeholder. Clicking a thumbnail opens a modal showing the full image or an autoplaying `<video>` with controls.
    - Right-click a folder row → Edit (name/description) or Delete (also cleans up all files inside from disk, not just the DB rows). Right-click a file thumbnail → Remove (deletes that one file from disk and its DB row).
    - **Bug fixed:** pywebview's `create_file_dialog` file-type filter rejects `&` characters in the filter label (`"Images & Videos (...)"` threw `ValueError`) — renamed to `"Media Files (...)"`.
    - **Bug fixed:** an in-conversation instruction to "replace this section of vault.js" was interpreted as replacing the *entire file* with just that section, silently deleting all Accounts/Subscriptions/notification code. Everything broke at once (no entries, can't switch tabs, notifications dead) with zero console errors, since the file was syntactically valid — just incomplete. Diagnosed via the Network tab showing `vault.js` still loading successfully while functionality was missing, pointing to file *content* rather than caching/path. **Rule going forward: always request/provide the complete `vault.js` file, never a "replace this section" instruction** — this file is large enough that a partial swap easily loses unrelated code silently.
    - Also fixed along the way: a browser-cache issue where WebView2 served a stale cached `vault.js` (HTTP 304) after edits — fixed with a cache-busting query string (`vault.js?v=2`) on the `<script>` tag in `vault.html`; bump the version number after future `vault.js` edits if this recurs.

## Current Task
Testing the Subscriptions feature end-to-end (add/edit/view/delete cycle including Privileges, custom fields, PHP amount, and the notification bell's 30/7/3/1-day triggers) — this was pending before the Images & Videos detour and is still outstanding. Images & Videos (Folders) has been built and tested; no known open issues there.

## Next Planned Step
1. Test the complete Subscriptions feature end-to-end, clean up any test data, then `git add`/`commit`/`push`.
2. `git add`/`commit`/`push` the Images & Videos (Folders) feature, which has also not yet been committed.
3. Build out the remaining empty sidebar section (Settings — no spec discussed yet).
4. Longer-term: resume the original roadmap — Testing, Error Handling, Packaging, Final Security Review, v0.1.0 Release.

## Technology Stack
- Language: Python 3.14.5
- GUI: pywebview (HTML/CSS/JS rendered in a native desktop window via Edge WebView2 on Windows). Old tkinter UI fully removed.
- Local storage: SQLite (built-in `sqlite3`), one database file per user account
- Encryption: `cryptography` library (PBKDF2HMAC + Fernet/AES) — used for account passwords/notes/custom fields; Subscriptions data and Folder media files are intentionally NOT encrypted (explicit per-feature decisions)
- Packaging (planned): PyInstaller
- Explicitly local-only/offline by design — no cloud backend. (Live currency conversion via an external API was tried and reverted for Subscriptions amounts, reinforcing this design principle.)

## Installed Dependencies (requirements.txt)
- cryptography==50.0.0
- cffi==2.1.1
- pycparser==3.0
- bottle==0.13.4
- clr_loader==0.3.1
- proxy_tools==0.1.0
- pythonnet==3.1.0
- pywebview==6.2.1
- typing_extensions==4.16.0
- python-dotenv (installed; verify exact pinned version is in `requirements.txt`)
(an earlier accidental self-referential `-e git+https://...` line from `pip freeze` was manually removed)

## Bundled Assets
- `src/noctis/web/fonts/Inter-Variable.ttf` — Inter variable font (all weights 100–900 in one file), fetched from the Google Fonts GitHub mirror and committed to the repo so the app never needs internet access to render its own typeface.

## Important Decisions Made
- Passwords and notes are always encrypted before touching the database; only metadata (title/account name, entry-username, category, timestamps, email) is stored in plain columns.
- Master password is never stored anywhere, in any form — only a random salt and an indirect verification token are stored per-username in `users.json`.
- Login identity is the **username**; email is metadata only, used for a possible future recovery feature. One email cannot be reused across multiple accounts.
- Master password minimum length: 5 characters, any characters allowed.
- Explicitly and repeatedly declined: any form of recoverable/plaintext master password storage. A future one-time Recovery Key (like Bitwarden/1Password) was proposed but not yet built.
- Noctis supports multiple local accounts, each fully isolated: own salt, verification token, lockout state, and database file.
- Considered and declined a Supabase/cloud backend to preserve the local-only, offline design.
- Viewing an entry's real password requires re-entering the master password at that moment, even though the vault is already unlocked. Applies only to the password field, not notes or custom fields.
- Editing/Deleting an entry (from the View screen) also requires master-password re-authentication / confirmation popup respectively.
- Multiple accounts can share the same account name and are grouped together in the list.
- Email addresses are verified at registration via a one-time 6-digit code sent through the user's own Gmail account — Noctis's only feature requiring internet access.
- GitHub repository is public (changed from private after verifying, via full Git history search, that no secrets were ever committed).
- Subscriptions support two parallel "extra info" mechanisms: user-labeled custom fields and a fixed, label-less Privileges bullet list — both coexist.
- Subscription list rows have no dedicated "View" button; the entire row is clickable and opens the detail screen directly, with a hover/focus-triggered inline preview of privileges.
- Subscription amounts are entered/stored directly in PHP — no currency selection, no live conversion, reaffirming the offline-first principle.
- The renewal notification bell is a fixed, window-level UI element, visible from anywhere in the app.
- Images & Videos folders require master-password re-authentication to *open* (view contents), but folder metadata (name/description) itself is plain, unencrypted, and freely listable/editable — mirroring the Subscriptions precedent that not everything needs encryption, but sensitive *access* can still be gated.
- Inserted media files are **moved** (not copied) from their original location into Noctis's own per-user storage folder, so Noctis becomes the only copy and the original location no longer has the file. Files are stored unencrypted on disk — an explicit trade-off for simplicity and instant view/playback, accepted after discussing that encryption would require decrypt-to-temp-file complexity, especially for video playback.

## Known Issues
None currently outstanding for built features. (Previously flagged horizontal-scroll/content-cutoff bug from notification navigation has been fixed; previously flagged base64/`file:///` media display bug has been fixed; previously flagged stale-cache and partial-file-replacement incidents during the Folders build have been fixed and their lessons documented above.)

## Important Unfinished Work
- Subscriptions feature has not yet been tested end-to-end or committed to Git — this is the immediate next task.
- Images & Videos (Folders) feature has been built and tested but not yet committed to Git.
- Planned future enhancement (not yet scheduled): email alert to a Gmail address after 5 failed master-password attempts — technically easier now since Gmail-sending infrastructure already exists.
- Planned future enhancement (proposed, not yet built): one-time Recovery Key system generated at registration, as the safe answer to "forgot master password."
- Known/accepted limitations (not planned to be fully solved): no OS-level file permission hardening on per-user `.db` files, `users.json`, or the `media_<username>` folders; in-memory encryption key is set to None on lock but not guaranteed to be wiped from RAM immediately.
- `config.DATABASE_FILENAME` in `config.py` is unused (superseded by per-user filenames) — harmless leftover.
- Edit mode for existing accounts uses a single combined screen rather than the two-step wizard used for creation — intentional simplification, not a bug.
- If a user abandons registration after requesting a code but before entering it, that pending verification sits in `pending_verifications.json` until its 10-minute expiry — harmless but not actively cleaned up early.
- Leftover unused `currency`/`php_amount` columns in the `subscriptions` table from the abandoned live-currency-conversion attempt — harmless, not actively cleaned up.
- Large video files inserted into Folders may feel slow to open due to base64 encoding overhead — acceptable for now; revisit if it becomes a real problem (e.g. switch to pywebview's HTTP server mode for serving local files directly instead of base64).
- Settings sidebar section is still an empty placeholder — no spec discussed yet.

## Architecture Changes
- Multi-User Login/Vaults — changed from a single global vault to per-username accounts with isolated storage.
- Account creation UX — replaced the single flat "Add Entry" form with a "+" → Category/Account choice, richer account form, separate category-selection step.
- Database schema — `entries` table extended (email, encrypted_notes); new `categories` and `custom_fields` tables.
- UI framework — migrated from tkinter to pywebview + HTML/CSS/JS.
- Layout — moved from a single-page vault view to a persistent sidebar with multiple sections (Accounts, Subscriptions, Images & Videos, Settings).
- Database schema (second wave) — added `subscriptions` and `subscription_fields` tables.
- Database schema (third wave) — added `subscription_privileges` table.
- Subscriptions list UX — removed the row-level "View" button in favor of a fully clickable/keyboard-accessible row with hover/focus-triggered privilege preview.
- Global notification system — window-level (not section-scoped) renewal-reminder bell, computed client-side; shared `activateSection()` helper for sidebar clicks and notification clicks.
- Layout robustness — global `overflow-x: hidden` and a `resetScroll()` helper on every view transition.
- Database schema (fourth wave) — added an `amount` column (REAL) to `subscriptions` for direct PHP entry; unused `currency`/`php_amount` columns left in place from an abandoned live-conversion attempt.
- Images & Videos (Folders) — new `folders` and `folder_files` tables; new `security.get_media_directory()` helper; new per-user on-disk media storage (`media_<username>/<folder_id>/`) separate from the SQLite `.db` file; media served to the frontend as base64 data URLs rather than file paths, to work around a WebView2 restriction on loading local `file:///` resources.

---

## Handoff Notes for a New Conversation

This project has grown a long conversation history. To keep future sessions fast and cheap, work continues in fresh conversations as needed.

**What to do when starting a new conversation:**
1. Paste this entire `PROJECT_STATUS.md` file as your first message.
2. Optionally, also paste the current `style.css` and `vault.css` content if the first task involves visual/theme work.
3. For anything else (`vault.js`, `main.py`, `security.py`, `database.py`, `login.js`, `login.html`, `vault.html`), do NOT paste them preemptively — per this project's "Current Code Only" rule, Claude should ask for a file's current content before editing it.
4. **`vault.js` is now large enough that partial "replace this section" instructions are risky** — always request/provide the complete file for this one specifically, per the incident documented under Images & Videos above.
5. The immediate next real tasks are: (a) test the Subscriptions feature end-to-end and commit it, (b) commit the Images & Videos (Folders) feature, both currently uncommitted.
6. `resizable=False` and the 1200×800 fixed window size are already set in `main.py` — no need to redo this.
7. The design system (dark theme, Inter font, SVG icon set, spacing/color tokens) is fully established in `style.css`/`vault.css` — ask to see these before making visual changes, rather than guessing.
8. The notification bell is `position: fixed` at the top-right of the whole window (not inside the sidebar) — keep this in mind for any future sidebar/header layout changes.
9. If `vault.js` seems to be missing functionality that should exist (e.g. entries not loading, tabs not switching), check whether the file is actually complete before debugging further — this exact failure mode has happened before (see Images & Videos bug notes above) and looks like "everything is broken" with no console errors.
10. `vault.html`'s `<script src="vault.js?v=2">` cache-busting tag should have its version number bumped any time `vault.js` is updated, to avoid WebView2 serving a stale cached copy (HTTP 304).