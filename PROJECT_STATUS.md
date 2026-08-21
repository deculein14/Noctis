# Noctis — Project Status

## Current Step
Step 6 complete. Ready to begin Step 7 — Security Architecture.

## Completed Steps
1. Git & GitHub setup — local repo initialized, private GitHub repo created, connected, pushed.
2. Project structure — `src/noctis/`, `tests/`, `docs/`, `requirements.txt` created.
3. Development environment — Python 3.14.5 confirmed, `venv` created, `cryptography` installed.
4. Basic application entry point — `main.py` opens a tkinter window.
5. Configuration/environment setup — `config.py` for non-sensitive settings, `.env` / `.env.example` pattern established for secrets.
6. Database/local storage design — SQLite schema for password entries (`database.py`), tested manually.

## Current Task
None in progress — awaiting confirmation to start Step 7.

## Next Planned Step
Step 7 — Security Architecture (planning how master password, encryption keys, and encrypted vault data will fit together, before writing the actual crypto code in Steps 8–9).

## Technology Stack
- Language: Python 3.14.5
- GUI: tkinter (built-in)
- Local storage: SQLite (built-in `sqlite3`)
- Encryption: `cryptography` library
- Packaging (planned, Step 19): PyInstaller

## Installed Dependencies (requirements.txt)
- cryptography==50.0.0
- cffi==2.1.1
- pycparser==3.0

## Important Decisions Made
- Passwords/sensitive data will always be encrypted before touching the database. Only non-sensitive metadata (title, username, category, timestamps) is stored in plain columns.
- `src` layout used with `pyproject.toml` + editable install (`pip install -e .`) so `noctis` imports correctly.
- `.env` holds real secrets (git-ignored); `.env.example` documents the shape of expected secrets and is safe to commit.
- GitHub repository is private.

## Known Issues
None currently.

## Important Unfinished Work
- No encryption logic yet (`security.py` is still empty) — do not store real passwords until Step 8–9 are complete.
- No UI beyond a placeholder window — `ui.py` is still empty.
- No authentication/master password system yet.

## Architecture Changes
None yet beyond the initial plan.