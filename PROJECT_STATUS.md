# Noctis — Project Status

## Current Step
MAJOR PIVOT IN PROGRESS: migrating the UI from tkinter to pywebview (HTML/CSS/JS desktop window). The tkinter UI (`ui.py`, `main.py`) has been deleted (recoverable from Git history at or before commit `d5bec15` if ever needed). `security.py`, `database.py`, and `config.py` are untouched and fully reusable as-is — they have no tkinter dependency. **The app currently does not run at all** — there is no UI layer until the pywebview version is built. This was an explicit, confirmed decision (accepted the app being non-functional during the rebuild) rather than an accident.

### Why this pivot happened
User wanted real CSS animations/hover transitions, which tkinter cannot do (no animation/transition system). Confirmed via a working pywebview proof-of-concept (a test window with a smooth CSS button hover transition) that the approach works on this machine before committing to the migration. This aligns Noctis's stack with how real commercial password managers (1Password, Bitwarden) build their desktop UIs (HTML/CSS/JS wrapped in a native window), just using a lighter Python-friendly tool (pywebview) instead of Electron/Node.js.

### Planned migration order
1. ✅ DONE — Set up project structure: `src/noctis/web/` folder created; `main.py` rebuilt with a pywebview `Api` class bridging JS calls to `security.py`.
2. ✅ DONE — Login/Register screen rebuilt (`login.html`, `style.css`, `login.js`): mode toggle, email field shown only in register mode, password show/hide toggle, real CSS focus/hover transitions. Fixed a browser quirk where Edge's native password-reveal icon doubled up with our custom eye button (hidden via `::-ms-reveal`/`::-ms-clear` CSS).
3. ✅ DONE — Vault list rebuilt (`vault.html`, `vault.css`, `vault.js`): grouping by account name, live search, category chips, Favorites chip, star toggle, delete with a native `confirm()` popup.
   - **IMPORTANT BUG FIXED:** calling `window.load_url(...)` from inside a Python API method (itself invoked from JS) caused the entire app to freeze/hang on Windows — this is a known pywebview gotcha (the API call runs on a background thread, and triggering navigation from that thread can deadlock the UI thread). Fix: Python API methods only return data/success-failure; all page navigation (`window.location.href = "..."`) happens in JavaScript instead. **Rule going forward: never call `window.load_url()` (or similar navigation) from inside a Python API method — always navigate from JS.**
4. ✅ DONE — Account/Category creation modal flow built directly into the vault page (no separate HTML file): "+" opens a Category/Account choice, Category form saves to a real `categories` table via `add_category`, Account form collects title/email/username/password/notes/url plus arbitrary custom fields (added via a `prompt()` popup), followed by a category-picker step before saving (`save_account` API method, mirroring the old tkinter flow).
   - **BUG FIXED — registration auto-login:** `register_user` originally called `session.unlock()` and navigated straight to the vault; changed so registering only creates the account and returns the user to the Login form with a "Account created! Please log in." message — matching the desired UX of not auto-logging in after signup.
   - **BUG FIXED — empty vault list on first login:** after `window.location.href` navigates to `vault.html`, pywebview needs a moment to re-inject `window.pywebview.api` into the new page; calling `get_entries()` immediately (before injection completes) silently failed, showing an empty list until any other API call succeeded later. Fix: wait for the `pywebviewready` event before the first `loadEntries()` call if `window.pywebview` isn't already present. **Rule going forward: any page that calls the API immediately on load (not from a user click) must guard with this same `pywebviewready` check.**
   - **BUG FIXED — form fields clearing on custom-field add/remove:** re-rendering the account form (to show a newly added custom field) only preserved custom field values, not the main fields (title/email/username/password/notes/url), wiping them each time. Also affected the "Back" button from the category picker. Fix: introduced `pendingAccount` as a persistent draft object populated via `saveMainFieldValues()` before every re-render, and the category picker's Back button now calls `renderAccountForm()` directly (preserving the draft) instead of resetting it.
   - "View" (both single-entry and grouped) is still a placeholder `alert()` — not built yet.
5. ✅ DONE — View screen rebuilt: shows Email, Username, Notes, URL, and custom fields in plain text (each with its own 📋 copy icon using `navigator.clipboard`). Password stays masked with 👁 (reveal) and 📋 (copy) icons, both gated behind a custom master-password confirmation modal (`promptForMasterPassword`) — masked input, not the browser's native `prompt()`. Favorite toggle and Delete (native `confirm()`) moved into the View screen. Edit also requires master-password re-authentication, then opens the account form pre-filled with the real (decrypted) password and existing custom fields; saving correctly calls `update_account` (not `save_account`) to avoid creating a duplicate. Grouped accounts get a sub-list screen (labeled by username/email, falling back to "Account N") with just a View button per row — no star, to avoid redundancy with the View screen's own favorite toggle. Single-account list rows were also simplified to show only View (star/delete removed from the row, same reasoning).
6. ✅ DONE — Category management: right-click a category chip (not "All"/"Favorites") to open a small context menu with Rename and Delete. Rename updates both the `categories` table and every account currently using that name. Delete removes the category and sets affected accounts back to uncategorized (does not delete the accounts). New `database.py` functions: `rename_category`, `delete_category`. New `main.py` API methods of the same names.
7. Final wiring and cleanup — remaining: decide whether the `web_test` proof-of-concept pattern needs anything else, review for consistency, confirm no leftover placeholder `alert()`s remain, then resume the original numbered roadmap (Testing, Error Handling, Packaging, Final Security Review, v0.1.0 Release).
8. ✅ DONE — Professional design system overhaul (CSS-only, no backend/JS logic changes): introduced CSS custom properties (design tokens) in `style.css` covering color (deep night-blue background with a layered elevation scale: bg → surface-1 → surface-2 → surface-3), spacing (strict 4px-based scale), radius, and shadow values, applied consistently across `style.css` and `vault.css`. Typography hierarchy established: uppercase letter-spaced micro-labels (11px) for field labels vs. readable body text (14px) for values. Button hierarchy: primary actions stay solid-filled, secondary actions (Cancel/Back) became outlined/ghost to reduce visual competition. Entry-row subtitles ("1 account"/"N accounts") became small pill badges. Modals gained real depth via layered shadows and a subtle backdrop blur. Added an app tagline ("Local. Encrypted. Yours.") under the Noctis title for identity.
9. ✅ DONE — Replaced all emoji icons (👁 📋 ★ ☆ × +) with a monochrome inline SVG icon set using `stroke="currentColor"` / `fill="currentColor"`, so icons properly inherit the theme's colors and respond to hover/active states like real icons, instead of rendering as colorful OS emoji that clashed with the design system. Covers: password show/hide (login + account form, swaps between open/crossed-eye SVGs on toggle), per-field copy buttons in the View screen, password reveal/copy buttons, remove-custom-field button, favorite star (filled/outline variants), and the main "+" add button. Added `.icon-svg` sizing/centering CSS rules to `style.css` and `vault.css`.
10. ✅ DONE — Repo housekeeping: added `LICENSE` (MIT, with a plain-English "In short" summary explaining the credit requirement) and `.gitattributes` (normalizes all text files to LF line endings, eliminating the recurring "LF will be replaced by CRLF" Git warning seen throughout the project). Repository visibility decision: made public on GitHub (user's decision, after verifying via `git log --all --full-history` that no sensitive files — `.env`, `users.json`, `*.db` — were ever committed at any point in history).
11. ✅ DONE — Accessibility and interaction polish pass on the Add Account/Category modal (applying `/ui-ux-pro-max` principles manually, since its live search tool/database is not available in this sandboxed environment — only its instructions file is present): added `aria-label`s to icon-only buttons, visible focus rings (`:focus-visible`) on every interactive element, increased icon-button touch targets to 40px minimum, added a subtle fade+scale modal entrance animation (respects `prefers-reduced-motion`), auto-focus on the first field when any modal opens, and `Escape` key closes the active modal.
12. ✅ DONE — Bundled the Inter variable font (`web/fonts/Inter-Variable.ttf`, fetched from the official Google Fonts GitHub mirror so the app has zero runtime internet dependency, consistent with Noctis's offline-first design) via `@font-face` in `style.css`, replacing the plain Segoe UI system font across the entire app for a more modern, refined typeface. Single variable-font file covers all weights (100–900) already in use.
13. ✅ DONE — View screen redesign for visual richness (again applying `/ui-ux-pro-max` principles manually): added a colored avatar circle per account (deterministic color generated from a hash of the account name, so the same account always gets the same color), field-type icons (mail/person/lock/note/link/tag) beside each label, grouped fields into "Login Details" and "Additional Information" sections with subtle dividers, wrapped the whole view in an elevated card instead of floating on the bare background, and rendered the revealed password in a monospace font for easier character verification. Extended the same fade-in transition, copy-confirmation flash (checkmark replaces the copy icon briefly), and `Escape`-to-go-back behavior established in item 11 to the View and group-list screens.
14. ✅ DONE — Confirm Password field on registration (`login.html`/`login.js`): validates the two password fields match before allowing account creation; hidden in Login mode, shown in Register mode.
15. ✅ DONE — Email verification during registration (Noctis's first feature requiring internet access, and only at this one moment — daily use remains fully offline):
    - User's own Gmail account is used to send a 6-digit code, authenticated via a Gmail "App Password" (not the real account password) stored in `.env` as `GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD` — never committed, loaded via the new `python-dotenv` dependency.
    - **Security incident during setup:** the user accidentally pasted a real, freshly-generated Gmail App Password directly into this chat. Flagged immediately as compromised; user was instructed to revoke it on Google's end and generate a fresh one, which they did before it was ever used in code. No credential from that incident was used or stored.
    - `security.py`: `send_verification_code(email)` generates a random 6-digit code, stores it with a 10-minute expiry in `pending_verifications.json` (git-ignored), and emails it via `smtplib`/Gmail SMTP. `check_verification_code(email, code)` validates and consumes the code (deleted after one successful or expired check, single-use).
    - Registration is now a three-step flow: (1) fill in Username/Email/Password/Confirm Password and click "Send Verification Code" → (2) a 6-digit code field appears, other fields disable, user checks their email and enters the code → (3) clicking "Verify & Create Account" calls `confirm_registration`, which only then actually creates the account via the existing `security.register_user()`. If the code is wrong or expired, the account is never created.
    - New `main.py` API methods: `request_registration_code` (validates username/email/password rules first, then sends the code) and `confirm_registration` (checks the code, then registers). The old single-step `register_user` API method was removed/replaced by these two.
    - Fixed a minor input bug: the verification code field originally let spaces/non-digit characters consume slots up to its 6-character limit (e.g. one space + 5 digits); added a live `input` filter (`replace(/\\D/g, "")`) so only digits are ever accepted.
    - `pending_verifications.json` added to `.gitignore`. `account_log.txt` (from earlier work, holds username/email pairs for the user's own reference — no passwords) was found to be missing from `.gitignore` during this session and has now been added.
16. ✅ DONE — Fixed window size and sidebar navigation:
    - Window is now fixed at **1200×800**, non-resizable (`resizable=False` in `webview.create_window()` in `main.py`) — same size for every user, no maximize/minimize-to-different-size drift.
    - Added a persistent left sidebar to `vault.html`, replacing the old single-page layout. Final agreed order: **Accounts** (top) → **Subscriptions** → **Images & Videos** (combined into one item/page, since related) → **Settings** (bottom).
    - "Accounts" reuses all pre-existing vault functionality (list, search, categories, favorites, View screen) unchanged — just now reached via the sidebar instead of being the only page.
    - "Images & Videos" and "Settings" are still empty placeholder pages (title + "This section is coming soon") — no spec discussed yet for either.
    - Sidebar click handling in `vault.js` swaps which `.content-section` is visible and highlights the active item; each section's specific `show...MainView()` function (e.g. `showMainView()`, `showSubscriptionsMainView()`) is called on activation to (re)load that section's data fresh.
17. ✅ DONE (built, not yet tested/committed as of end of this conversation) — Subscriptions feature, first real content in the new sidebar:
    - New database tables (`database.py`): `subscriptions` (name, plan, date_started, date_ended, timestamps) and `subscription_fields` (arbitrary label/value pairs per subscription, e.g. benefits — stored as **plain text, not encrypted**, since subscription info isn't a secret like a password; explicit decision, differs from the Accounts encryption model).
    - New CRUD functions: `add_subscription`, `get_all_subscriptions`, `update_subscription`, `delete_subscription`, `add_subscription_field`, `get_subscription_fields`, `delete_subscription_fields`.
    - New `main.py` API methods: `get_subscriptions`, `get_subscription_details`, `save_subscription`, `update_subscription`, `delete_subscription` — no master-password re-authentication gating (unlike Accounts' password reveal/edit), consistent with the "not a secret" decision above.
    - New UI in `vault.js`/`vault.html`: list view (name + plan shown per row, matching the Accounts row style), an add/edit modal with Subscription Name, Plan, Date Availed, Date Ended (native `<input type="date">` fields), plus a "+ Add Field" mechanism identical in pattern to Accounts' custom fields (for listing benefits or other arbitrary info). A detail/View screen (avatar circle, grouped fields, Edit/Delete/Back) mirrors the Accounts View screen's visual style for consistency, minus the password-specific parts.
    - **Not yet done:** user testing of the full add/view/edit/delete cycle, cleanup of test data, git commit/push. This is the very next thing to do when work resumes.

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
Sidebar navigation and Subscriptions feature just built (see items 16-17 below) — awaiting user testing/confirmation before commit. **This conversation is ending here; a new conversation will continue the work.** See "Handoff Notes for New Conversation" at the very bottom of this file for exactly what to do first.

## Next Planned Step
Immediate: test and commit the Subscriptions feature (see item 17). After that: build out the two remaining empty sidebar sections (Images & Videos, Settings — no spec discussed yet for either). Longer-term: resume the original roadmap — Testing, Error Handling, Packaging, Final Security Review, v0.1.0 Release.

## Technology Stack
- Language: Python 3.14.5
- GUI: **transitioning from tkinter to pywebview** (HTML/CSS/JS rendered in a native desktop window via the system's web engine — Edge WebView2 on Windows). `pywebview` is installed. Old tkinter UI removed.
- Local storage: SQLite (built-in `sqlite3`), one database file per user account
- Encryption: `cryptography` library (PBKDF2HMAC + Fernet/AES)
- Packaging (planned, Step 19 of original numbering): PyInstaller
- Explicitly local-only/offline by design — no cloud backend

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
- python-dotenv (installed; verify exact pinned version is in `requirements.txt` next session — added via `pip install python-dotenv` but not yet reconfirmed via a fresh `pip freeze`)
(all confirmed correctly added to `requirements.txt`; an earlier accidental self-referential `-e git+https://github.com/deculein14/Noctis.git...` line from `pip freeze` was manually removed)

## Bundled Assets
- `src/noctis/web/fonts/Inter-Variable.ttf` — Inter variable font (all weights 100–900 in one file), fetched once from the Google Fonts GitHub mirror and committed to the repo so the app never needs internet access to render its own typeface.

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
- Email addresses are now verified at registration via a one-time 6-digit code sent through the user's own Gmail account — this is Noctis's first and only feature requiring internet access; all other functionality (login, vault CRUD) remains fully offline.
- GitHub repository is public (changed from private after verifying, via full Git history search, that no secrets were ever committed).

## Known Issues
None currently.

## Important Unfinished Work
- Planned future enhancement (not yet scheduled to a specific step): email alert to a Gmail address after 5 failed master-password attempts. Now technically easier since Gmail-sending infrastructure (`smtplib` + App Password) already exists from the email verification feature — could reuse `security.py`'s email-sending pattern.
- Planned future enhancement (proposed, not yet built): one-time Recovery Key system generated at registration, as the safe answer to "forgot master password," and groundwork for a future recovery flow. Now more feasible than before since email delivery infrastructure exists — a recovery key or reset link could be emailed the same way verification codes are.
- Known/accepted limitations (not planned to be fully solved): no OS-level file permission hardening on per-user `.db` files or `users.json`; in-memory encryption key is set to None on lock but not guaranteed to be wiped from RAM immediately (relies on Python garbage collection).
- `config.DATABASE_FILENAME` in `config.py` is unused (superseded by per-user filenames) — harmless leftover.
- Edit mode for existing accounts uses a single combined screen (fields + category together) rather than the two-step wizard used for creation — an intentional simplification, not a bug.
- If a user abandons registration after requesting a code but before entering it, that pending verification sits in `pending_verifications.json` until its 10-minute expiry — harmless (never becomes an account, file is git-ignored) but not actively cleaned up early.

## Architecture Changes
- Multi-User Login/Vaults — changed from a single global vault to per-username accounts with isolated storage (salt, verification token, lockout state, database file per user).
- Account creation UX — replaced the single flat "Add Entry" form with a "+" → Category/Account choice, a richer account form (email, notes, custom fields), and a separate category-selection step before saving.
- Database schema — `entries` table extended (email, encrypted_notes); new `categories` and `custom_fields` tables added to support the above.
- UI framework — migrated from tkinter to pywebview + HTML/CSS/JS (see item 1-13 above under Completed Steps for the full migration history and the critical `window.load_url()` freeze-bug lesson).
- Layout — moved from a single-page vault view to a persistent sidebar with multiple sections (Accounts, Subscriptions, Images & Videos, Settings), each independently loadable.
- Database schema (second wave) — added `subscriptions` and `subscription_fields` tables alongside the original `entries`/`categories`/`custom_fields`, for a second, differently-modeled feature (plain text, no encryption, no re-auth) within the same per-user `.db` file.

---

## Handoff Notes for a New Conversation

This project has grown a long conversation history. To keep future sessions fast and cheap (token cost scales with total conversation length, not just the size of what you type), work is continuing in a **fresh conversation** starting now.

**What to do when starting that new conversation:**
1. Paste this entire `PROJECT_STATUS.md` file as your first message.
2. Optionally, also paste the current `style.css` and `vault.css` content if the first task involves visual/theme work — these are foundational and small enough to include upfront.
3. For anything else (`vault.js`, `main.py`, `security.py`, `database.py`, `login.js`, `login.html`, `vault.html`), **do not paste them preemptively** — per this project's own "Current Code Only" rule (established early in the original conversation), Claude should ask for a file's current content before editing it, and you should just paste whatever's asked for. This avoids the new conversation growing bloated with files that aren't relevant to the immediate task.
4. The very first real task in the new conversation should be: **test the Subscriptions feature** (add/view/edit/delete cycle), clean up test data, then `git add`/`commit`/`push`. Everything needed to do this is already built — see item 17 above.
5. `resizable=False` and the 1200×800 fixed window size are already set in `main.py` — no need to redo this.
6. The design system (dark theme, Inter font, SVG icon set, spacing/color tokens) is fully established in `style.css`/`vault.css` — a new session should ask to see these before making any visual changes, rather than guessing colors/spacing.