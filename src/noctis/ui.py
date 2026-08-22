import tkinter as tk
from tkinter import font as tkfont

from noctis import database, security

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


class VaultScreen(tk.Frame):
    def __init__(self, parent, session):
        super().__init__(parent, bg=COLORS["bg_primary"])
        self.session = session

        self.heading_font = tkfont.Font(family="Segoe UI", size=20, weight="bold")
        self.subheading_font = tkfont.Font(family="Segoe UI", size=14)
        self.body_font = tkfont.Font(family="Segoe UI", size=12)
        self.hint_font = tkfont.Font(family="Segoe UI", size=10)

        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *args: self._refresh_list())
        self.active_category = None
        self.show_favorites_only = False

        self._build_list_view()

    def _clear(self):
        for widget in self.winfo_children():
            widget.destroy()

    def _get_filtered_entries(self):
        query = self.search_var.get().strip().lower()
        entries = database.get_all_entries()

        if self.show_favorites_only:
            entries = [e for e in entries if e["is_favorite"]]

        if self.active_category:
            entries = [e for e in entries if e["category"] == self.active_category]

        if query:
            entries = [
                e for e in entries
                if query in (e["title"] or "").lower() or query in (e["username"] or "").lower()
            ]

        return entries

    def _build_list_view(self):
        self._clear()

        header = tk.Frame(self, bg=COLORS["bg_primary"])
        header.pack(fill="x", padx=24, pady=(24, 8))

        title = tk.Label(
            header, text="Your Vault", font=self.heading_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_primary"]
        )
        title.pack(side="left")

        add_button = tk.Button(
            header, text="+ Add Entry", font=self.body_font,
            bg=COLORS["accent"], fg=COLORS["text_primary"],
            activebackground=COLORS["accent_hover"], activeforeground=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=self._show_add_form,
        )
        add_button.pack(side="right", ipady=4, ipadx=8)

        search_entry = tk.Entry(
            self, textvariable=self.search_var, font=self.body_font,
            bg=COLORS["bg_surface"], fg=COLORS["text_primary"],
            insertbackground=COLORS["text_primary"],
            relief="flat", highlightthickness=1,
            highlightbackground=COLORS["border_subtle"],
            highlightcolor=COLORS["accent"],
        )
        search_entry.pack(fill="x", padx=24, pady=(0, 8), ipady=6)

        categories = database.get_all_categories()
        filter_row = tk.Frame(self, bg=COLORS["bg_primary"])
        filter_row.pack(fill="x", padx=24, pady=(0, 8))

        self._build_category_chip(filter_row, None, "All")

        star_symbol = "★" if self.show_favorites_only else "☆"
        favorites_chip = tk.Button(
            filter_row, text=f"{star_symbol} Favorites", font=self.hint_font,
            bg=COLORS["accent"] if self.show_favorites_only else COLORS["bg_surface_hover"],
            fg=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=self._toggle_favorites_filter,
        )
        favorites_chip.pack(side="left", padx=(0, 6), ipady=3, ipadx=8)

        for category in categories:
            self._build_category_chip(filter_row, category, category)

        self.entries_container = tk.Frame(self, bg=COLORS["bg_primary"])
        self.entries_container.pack(fill="both", expand=True, padx=24, pady=8)

        self._render_entries()

    def _build_category_chip(self, parent, category_value, label_text):
        is_active = self.active_category == category_value
        chip = tk.Button(
            parent, text=label_text, font=self.hint_font,
            bg=COLORS["accent"] if is_active else COLORS["bg_surface_hover"],
            fg=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=lambda: self._set_category_filter(category_value),
        )
        chip.pack(side="left", padx=(0, 6), ipady=3, ipadx=8)

    def _set_category_filter(self, category_value):
        self.active_category = category_value
        self._build_list_view()

    def _toggle_favorites_filter(self):
        self.show_favorites_only = not self.show_favorites_only
        self._build_list_view()

    def _refresh_list(self):
        if hasattr(self, "entries_container"):
            self._render_entries()

    def _render_entries(self):
        for widget in self.entries_container.winfo_children():
            widget.destroy()

        entries = self._get_filtered_entries()

        if not entries:
            empty_label = tk.Label(
                self.entries_container, text="No matching entries.",
                font=self.body_font, bg=COLORS["bg_primary"], fg=COLORS["text_secondary"]
            )
            empty_label.pack(pady=32)
            return

        for entry in entries:
            self._build_entry_row(self.entries_container, entry)

    def _build_entry_row(self, container, entry):
        row = tk.Frame(container, bg=COLORS["bg_surface"])
        row.pack(fill="x", pady=4, ipady=8, ipadx=12)

        info = tk.Frame(row, bg=COLORS["bg_surface"])
        info.pack(side="left", fill="x", expand=True)

        title_label = tk.Label(
            info, text=entry["title"], font=self.subheading_font,
            bg=COLORS["bg_surface"], fg=COLORS["text_primary"], anchor="w"
        )
        title_label.pack(fill="x")

        subtitle_text = entry["username"] or "(no username)"
        if entry["category"]:
            subtitle_text += f"  ·  {entry['category']}"

        username_label = tk.Label(
            info, text=subtitle_text, font=self.hint_font,
            bg=COLORS["bg_surface"], fg=COLORS["text_secondary"], anchor="w"
        )
        username_label.pack(fill="x")

        actions = tk.Frame(row, bg=COLORS["bg_surface"])
        actions.pack(side="right")

        star_text = "★" if entry["is_favorite"] else "☆"
        favorite_button = tk.Button(
            actions, text=star_text, font=self.hint_font,
            bg=COLORS["bg_surface_hover"],
            fg=COLORS["accent"] if entry["is_favorite"] else COLORS["text_secondary"],
            relief="flat", cursor="hand2",
            command=lambda: self._toggle_entry_favorite(entry["id"], entry["is_favorite"]),
        )
        favorite_button.pack(side="left", padx=4, ipady=2, ipadx=6)

        edit_button = tk.Button(
            actions, text="Edit", font=self.hint_font,
            bg=COLORS["bg_surface_hover"], fg=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=lambda: self._show_edit_form(entry),
        )
        edit_button.pack(side="left", padx=4, ipady=2, ipadx=6)

        delete_button = tk.Button(
            actions, text="Delete", font=self.hint_font,
            bg=COLORS["bg_surface_hover"], fg=COLORS["danger"],
            relief="flat", cursor="hand2",
            command=lambda: self._delete_entry(entry["id"]),
        )
        delete_button.pack(side="left", padx=4, ipady=2, ipadx=6)

    def _delete_entry(self, entry_id):
        database.delete_entry(entry_id)
        self._build_list_view()

    def _toggle_entry_favorite(self, entry_id, current_value):
        database.toggle_favorite(entry_id, not current_value)
        self._refresh_list()

    def _show_add_form(self):
        self._show_form(entry=None)

    def _show_edit_form(self, entry):
        self._show_form(entry=entry)

    def _show_form(self, entry):
        self._clear()

        is_edit = entry is not None
        heading_text = "Edit Entry" if is_edit else "Add Entry"

        title = tk.Label(
            self, text=heading_text, font=self.heading_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_primary"]
        )
        title.pack(pady=(24, 16))

        form = tk.Frame(self, bg=COLORS["bg_primary"])
        form.pack(padx=48, fill="x")

        def make_field(label_text, initial_value="", is_password=False):
            label = tk.Label(
                form, text=label_text, font=self.hint_font,
                bg=COLORS["bg_primary"], fg=COLORS["text_secondary"], anchor="w"
            )
            label.pack(fill="x", pady=(8, 2))
            entry_widget = tk.Entry(
                form, font=self.body_font,
                bg=COLORS["bg_surface"], fg=COLORS["text_primary"],
                insertbackground=COLORS["text_primary"],
                relief="flat", highlightthickness=1,
                highlightbackground=COLORS["border_subtle"],
                highlightcolor=COLORS["accent"],
                show="•" if is_password else "",
            )
            entry_widget.insert(0, initial_value)
            entry_widget.pack(fill="x", ipady=6)
            return entry_widget

        title_entry = make_field("Title", entry["title"] if is_edit else "")
        username_entry = make_field("Username", entry["username"] if is_edit else "")

        existing_password = ""
        if is_edit and entry["encrypted_password"]:
            existing_password = self.session.decrypt(entry["encrypted_password"])
        password_entry = make_field("Password", existing_password, is_password=True)

        url_entry = make_field("URL", entry["url"] if is_edit else "")
        category_entry = make_field("Category (optional)", entry["category"] if is_edit and entry["category"] else "")

        status_label = tk.Label(
            form, text="", font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["danger"]
        )
        status_label.pack(pady=(8, 0))

        def on_save():
            title_value = title_entry.get().strip()
            if not title_value:
                status_label.config(text="Title is required.")
                return

            encrypted_password = self.session.encrypt(password_entry.get())
            category_value = category_entry.get().strip() or None

            if is_edit:
                database.update_entry(
                    entry["id"], title_value, username_entry.get(),
                    encrypted_password, url_entry.get(), category_value
                )
            else:
                database.add_entry(
                    title_value, username_entry.get(),
                    encrypted_password, url_entry.get(), category_value
                )

            self._build_list_view()

        button_row = tk.Frame(form, bg=COLORS["bg_primary"])
        button_row.pack(fill="x", pady=(16, 0))

        cancel_button = tk.Button(
            button_row, text="Cancel", font=self.body_font,
            bg=COLORS["bg_surface_hover"], fg=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=self._build_list_view,
        )
        cancel_button.pack(side="left", fill="x", expand=True, padx=(0, 4), ipady=8)

        save_button = tk.Button(
            button_row, text="Save", font=self.body_font,
            bg=COLORS["accent"], fg=COLORS["text_primary"],
            activebackground=COLORS["accent_hover"], activeforeground=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=on_save,
        )
        save_button.pack(side="left", fill="x", expand=True, padx=(4, 0), ipady=8)