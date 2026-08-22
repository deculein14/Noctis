# Noctis — UI Design System

## Direction
Dark, sleek, security-focused. Mirrors conventions from established password managers
(1Password, Bitwarden) where dark UI signals "security tool," not just aesthetic choice.

## Color Palette

| Token | Hex | Use |
|---|---|---|
| bg-primary | #0F1115 | Main window background |
| bg-surface | #1A1D24 | Cards, panels, input fields |
| bg-surface-hover | #22262F | Hover state for interactive surfaces |
| border-subtle | #2A2E38 | Dividers, input borders |
| text-primary | #E4E6EB | Main text |
| text-secondary | #9096A2 | Labels, hints, secondary info |
| accent | #5B6EF5 | Primary buttons, focus states, links |
| accent-hover | #4A5CE0 | Accent hover state |
| danger | #EF4444 | Errors, delete actions, lockout warnings |
| success | #22C55E | Confirmations, saved states |

## Typography
- Font family: Segoe UI (Windows native, no install needed)
- Heading: 20px, semi-bold
- Subheading: 14px, medium
- Body: 12px, regular
- Small/hint text: 10px, regular

## Spacing
8px base unit. Use multiples: 8, 16, 24, 32px for padding/margins.

## Component Rules
- Buttons: flat fill, bg-accent, no gradients/shadows, consistent padding (8px vertical, 16px horizontal minimum)
- Inputs: bg-surface background, 1px border-subtle border, border becomes accent color on focus
- No default tkinter gray/system colors anywhere — every widget must have explicit colors set
- Sharp corners (plain tkinter cannot do rounded corners cleanly) — consistency compensates for this
- Consistent font sizes per role (heading/subheading/body/hint) across every screen

## Consistency Rule
Do not introduce a new font, color, spacing value, or component style for an individual
screen without updating this document first and having a clear reason.