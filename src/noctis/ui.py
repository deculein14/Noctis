import tkinter as tk
from tkinter import font as tkfont

from noctis import security

COLORS = {
    "bg_primary": "#0F1115",
    "bg_surface": "#1A1D24",
    "bg_surface_hover": "#22262F",
    "border_subtle": "#2A2E38",
    "text_primary": "#E4E6EB",
    "text_secondary": "#9096A2",
    "accent": "#5B6EF5",
    "accent_hover": "#4A5CE0",
    "danger": "#EF4444",
    "success": "#22C55E",
}


class LoginScreen(tk.Frame):
    def __init__(self, parent, on_success):
        super().__init__(parent, bg=COLORS["bg_primary"])
        self.on_success = on_success
        self.guard = security.LoginGuard()
        self.is_first_run = not security.vault_exists()

        self.heading_font = tkfont.Font(family="Segoe UI", size=20, weight="bold")
        self.body_font = tkfont.Font(family="Segoe UI", size=12)
        self.hint_font = tkfont.Font(family="Segoe UI", size=10)

        self._build_ui()

    def _build_ui(self):
        title_text = "Create Master Password" if self.is_first_run else "Unlock Noctis"
        title = tk.Label(
            self, text=title_text, font=self.heading_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_primary"]
        )
        title.pack(pady=(48, 24))

        self.password_entry = tk.Entry(
            self, show="•", font=self.body_font,
            bg=COLORS["bg_surface"], fg=COLORS["text_primary"],
            insertbackground=COLORS["text_primary"],
            relief="flat", highlightthickness=1,
            highlightbackground=COLORS["border_subtle"],
            highlightcolor=COLORS["accent"],
        )
        self.password_entry.pack(pady=8, padx=48, ipady=8, fill="x")
        self.password_entry.bind("<Return>", lambda event: self._submit())

        self.status_label = tk.Label(
            self, text="", font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["danger"]
        )
        self.status_label.pack(pady=(4, 8))

        button_text = "Create Vault" if self.is_first_run else "Unlock"
        self.submit_button = tk.Button(
            self, text=button_text, font=self.body_font,
            bg=COLORS["accent"], fg=COLORS["text_primary"],
            activebackground=COLORS["accent_hover"], activeforeground=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=self._submit,
        )
        self.submit_button.pack(pady=8, padx=48, ipady=8, fill="x")

        self.password_entry.focus_set()

    def _submit(self):
        password = self.password_entry.get()

        if self.is_first_run:
            if len(password) < 8:
                self.status_label.config(text="Master password must be at least 8 characters.")
                return
            security.setup_master_password(password)
            self.on_success(password)
            return

        if not self.guard.can_attempt():
            wait = self.guard.seconds_until_unlocked()
            self.status_label.config(text=f"Too many attempts. Try again in {wait:.0f}s.")
            return

        if security.check_master_password(password):
            self.guard.record_success()
            self.on_success(password)
        else:
            self.guard.record_failure()
            self.status_label.config(text="Incorrect master password.")
            self.password_entry.delete(0, tk.END)