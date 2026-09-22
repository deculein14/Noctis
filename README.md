# Noctis

A private, local-first personal information manager designed to securely organize and protect the information that matters to you.

Noctis is a desktop application focused on giving users a private and organized place to manage their personal information.

It started as a password manager, but its goal has expanded beyond passwords. Noctis is being developed as a broader personal information management application where different types of sensitive and important information can be stored, organized, and managed in one place — accounts, subscriptions, and personal media, with more planned.

## Why Noctis?

Most password managers push you toward a cloud account. Noctis takes the opposite approach: everything lives on your own machine, in your own SQLite database, encrypted with your own master password. Nothing is ever sent to a server — the only exception is a one-time email verification code during account registration, which uses your own Gmail account and touches nothing else in the app.

## Features

- **Multi-user accounts** — Noctis supports multiple separate local accounts on the same machine, each fully isolated with its own database, encryption salt, and lockout state.
- **Encrypted account vault** — Store login credentials (email, username, password, notes, URL, and custom fields) with AES/Fernet encryption. Passwords stay masked until you re-enter your master password to reveal or copy them.
- **Categories & favorites** — Organize accounts into custom categories, star favorites, and search/filter instantly.
- **Subscriptions tracker** — Track recurring subscriptions with plan details, cost (₱), renewal dates, and custom privileges/fields. "Mark as Done" logs each payment and automatically advances the next due date.
- **Renewal notifications** — A window-level notification bell flags subscriptions due soon (30/7/3/1 days) or overdue.
- **Images & Videos folders** — Store personal media in password-gated folders. Files are moved into Noctis's own storage on your disk, viewable directly in-app.
- **Failed-login protection** — Escalating lockout delays after repeated incorrect master-password attempts, persisted per account.
- **Auto-lock** — The vault automatically locks after a period of inactivity.
- **Professionally designed UI** — Dark theme, a bundled Inter typeface, a consistent monochrome icon set, and animated transitions — built to feel like a real commercial product, not a class project.

## Tech Stack

- **Language:** Python
- **UI:** [pywebview](https://pywebview.flowrl.com/) — an HTML/CSS/JS interface rendered in a native desktop window (via Edge WebView2 on Windows), instead of a heavier Electron/Node.js stack
- **Storage:** SQLite, one local database file per user account
- **Encryption:** [`cryptography`](https://cryptography.io/) (PBKDF2HMAC key derivation + Fernet/AES) for account passwords, notes, and custom fields
- **Packaging (planned):** PyInstaller, for a standalone Windows executable

## Security Notes

- Your master password is never stored anywhere, in any form — only a random salt and an indirect verification token are kept per account.
- Because of this, **your master password cannot be recovered if you forget it.** (A one-time Recovery Key system, similar to Bitwarden/1Password, is planned but not yet built.)
- Subscription details and stored media files are intentionally **not** encrypted at rest — folders containing media still require your master password to open, but this is a deliberate simplicity trade-off, not an oversight.
- Noctis is a personal/learning project and has not undergone a professional security audit. Treat it accordingly.

## Status

**Early-to-mid development.** Core features (encrypted accounts, subscriptions, media folders, multi-user support) are built and largely working; some recent features are still being tested before their first commit. Not yet ready for a public release.

## Roadmap

- Complete testing and hardening of recently built features
- Settings section
- Packaging as a standalone Windows app
- Final security review ahead of a v0.1.0 release

## License

MIT — see [LICENSE](LICENSE).

---

> Vibe coded.