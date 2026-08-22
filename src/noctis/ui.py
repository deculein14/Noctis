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
        self.guard = None
        self.password_visible = False
        self.mode = "login"

        self.heading_font = tkfont.Font(family="Segoe UI", size=20, weight="bold")
        self.body_font = tkfont.Font(family="Segoe UI", size=12)
        self.hint_font = tkfont.Font(family="Segoe UI", size=10)

        self._build_ui()

    def _clear(self):
        for widget in self.winfo_children():
            widget.destroy()

    def _make_field(self, parent, label_text, is_password=False):
        label = tk.Label(
            parent, text=label_text, font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_secondary"], anchor="w"
        )
        label.pack(fill="x", padx=48, pady=(8, 2))

        if not is_password:
            entry_widget = tk.Entry(
                parent, font=self.body_font,
                bg=COLORS["bg_surface"], fg=COLORS["text_primary"],
                insertbackground=COLORS["text_primary"],
                relief="flat", highlightthickness=1,
                highlightbackground=COLORS["border_subtle"],
                highlightcolor=COLORS["accent"],
            )
            entry_widget.pack(padx=48, ipady=8, fill="x")
            return entry_widget

        row = tk.Frame(parent, bg=COLORS["bg_primary"])
        row.pack(padx=48, fill="x")

        entry_widget = tk.Entry(
            row, show="\u2022", font=self.body_font,
            bg=COLORS["bg_surface"], fg=COLORS["text_primary"],
            insertbackground=COLORS["text_primary"],
            relief="flat", highlightthickness=1,
            highlightbackground=COLORS["border_subtle"],
            highlightcolor=COLORS["accent"],
        )
        entry_widget.pack(side="left", ipady=8, fill="x", expand=True)
        entry_widget.bind("<Return>", lambda event: self._submit())

        self.toggle_button = tk.Button(
            row, text="\U0001F441", font=self.body_font,
            bg=COLORS["bg_surface"], fg=COLORS["text_secondary"],
            activebackground=COLORS["bg_surface_hover"], activeforeground=COLORS["text_primary"],
            relief="flat", cursor="hand2", bd=0,
            command=self._toggle_password_visibility,
        )
        self.toggle_button.pack(side="left", padx=(6, 0), ipady=8, ipadx=8)

        return entry_widget

    def _build_ui(self):
        self._clear()
        self.password_visible = False
        self.email_entry = None

        title = tk.Label(
            self, text="Noctis", font=self.heading_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_primary"]
        )
        title.pack(pady=(32, 8))

        mode_label_text = "Log in to your vault" if self.mode == "login" else "Create a new account"
        mode_label = tk.Label(
            self, text=mode_label_text, font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_secondary"]
        )
        mode_label.pack(pady=(0, 12))

        if self.mode == "register":
            self.email_entry = self._make_field(self, "Email")

        self.username_entry = self._make_field(self, "Username")
        self.password_entry = self._make_field(self, "Password", is_password=True)

        self.status_label = tk.Label(
            self, text="", font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["danger"], wraplength=320, justify="left"
        )
        self.status_label.pack(pady=(8, 8), padx=48, fill="x")

        submit_text = "Log In" if self.mode == "login" else "Create Account"
        self.submit_button = tk.Button(
            self, text=submit_text, font=self.body_font,
            bg=COLORS["accent"], fg=COLORS["text_primary"],
            activebackground=COLORS["accent_hover"], activeforeground=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=self._submit,
        )
        self.submit_button.pack(pady=(0, 8), padx=48, ipady=8, fill="x")

        toggle_text = "No account yet? Register" if self.mode == "login" else "Already have an account? Log in"
        switch_link = tk.Button(
            self, text=toggle_text, font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["accent"],
            activebackground=COLORS["bg_primary"], activeforeground=COLORS["accent_hover"],
            relief="flat", cursor="hand2", bd=0,
            command=self._switch_mode,
        )
        switch_link.pack(pady=(4, 8))

        first_field = self.email_entry if self.email_entry is not None else self.username_entry
        first_field.focus_set()

    def _switch_mode(self):
        self.mode = "register" if self.mode == "login" else "login"
        self._build_ui()

    def _toggle_password_visibility(self):
        self.password_visible = not self.password_visible
        self.password_entry.config(show="" if self.password_visible else "\u2022")

    def _submit(self):
        username = self.username_entry.get().strip()
        password = self.password_entry.get()

        if not username:
            self.status_label.config(text="Please enter a username.")
            return

        account_exists = security.user_exists(username)

        if self.mode == "register":
            email = self.email_entry.get().strip() if self.email_entry else ""
            if not email or "@" not in email:
                self.status_label.config(text="Please enter a valid email address.")
                return
            if account_exists:
                self.status_label.config(text="An account already exists for this username. Please log in instead.")
                return
            if security.email_in_use(email):
                self.status_label.config(text="This email is already associated with another account.")
                return
            if len(password) < 5:
                self.status_label.config(text="Master password must be at least 5 characters.")
                return
            security.register_user(username, email, password)
            self.on_success(username, password)
            return

        if not account_exists:
            self.status_label.config(text="No account found for this username. Please register first.")
            return

        self.guard = security.LoginGuard(username)

        if not self.guard.can_attempt():
            wait = self.guard.seconds_until_unlocked()
            self.status_label.config(text=f"Too many attempts. Try again in {wait:.0f}s.")
            return

        if security.check_master_password(username, password):
            self.guard.record_success()
            self.on_success(username, password)
        else:
            self.guard.record_failure()
            self.status_label.config(text="Incorrect username or password.")
            self.password_entry.delete(0, tk.END)


class VaultScreen(tk.Frame):
    def __init__(self, parent, session):
        super().__init__(parent, bg=COLORS["bg_primary"])
        self.session = session
        self.username = session.username

        self.heading_font = tkfont.Font(family="Segoe UI", size=20, weight="bold")
        self.subheading_font = tkfont.Font(family="Segoe UI", size=14)
        self.body_font = tkfont.Font(family="Segoe UI", size=12)
        self.hint_font = tkfont.Font(family="Segoe UI", size=10)

        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *args: self._refresh_list())
        self.active_category = None
        self.show_favorites_only = False

        self._pending_account = None
        self._pending_custom_fields = []

        self._build_list_view()

    def _clear(self):
        for widget in self.winfo_children():
            widget.destroy()

    def _make_scrollable(self):
        canvas = tk.Canvas(self, bg=COLORS["bg_primary"], highlightthickness=0)
        scrollbar = tk.Scrollbar(self, orient="vertical", command=canvas.yview)
        inner = tk.Frame(canvas, bg=COLORS["bg_primary"])

        canvas_window = canvas.create_window((0, 0), window=inner, anchor="nw")

        def on_inner_configure(event):
            canvas.configure(scrollregion=canvas.bbox("all"))

        def on_canvas_configure(event):
            canvas.itemconfig(canvas_window, width=event.width)

        inner.bind("<Configure>", on_inner_configure)
        canvas.bind("<Configure>", on_canvas_configure)
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        def on_mousewheel(event):
            first, last = canvas.yview()
            delta = int(-1 * (event.delta / 120))
            if delta < 0 and first <= 0.0:
                return
            if delta > 0 and last >= 1.0:
                return
            canvas.yview_scroll(delta, "units")

        canvas.bind_all("<MouseWheel>", on_mousewheel)
        canvas.after_idle(lambda: canvas.yview_moveto(0))

        return inner

    def _get_filtered_entries(self):
        query = self.search_var.get().strip().lower()
        entries = database.get_all_entries(self.username)

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
        container = self._make_scrollable()

        header = tk.Frame(container, bg=COLORS["bg_primary"])
        header.pack(fill="x", padx=24, pady=(24, 8))

        title = tk.Label(
            header, text="Your Vault", font=self.heading_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_primary"]
        )
        title.pack(side="left")

        add_button = tk.Button(
            header, text="+", font=self.heading_font,
            bg=COLORS["accent"], fg=COLORS["text_primary"],
            activebackground=COLORS["accent_hover"], activeforeground=COLORS["text_primary"],
            relief="flat", cursor="hand2", width=3,
            command=self._show_add_choice,
        )
        add_button.pack(side="right")

        search_entry = tk.Entry(
            container, textvariable=self.search_var, font=self.body_font,
            bg=COLORS["bg_surface"], fg=COLORS["text_primary"],
            insertbackground=COLORS["text_primary"],
            relief="flat", highlightthickness=1,
            highlightbackground=COLORS["border_subtle"],
            highlightcolor=COLORS["accent"],
        )
        search_entry.pack(fill="x", padx=24, pady=(0, 8), ipady=6)

        categories = database.get_all_categories(self.username)
        filter_row = tk.Frame(container, bg=COLORS["bg_primary"])
        filter_row.pack(fill="x", padx=24, pady=(0, 8))

        self._build_category_chip(filter_row, None, "All")

        star_symbol = "\u2605" if self.show_favorites_only else "\u2606"
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

        self.entries_container = tk.Frame(container, bg=COLORS["bg_primary"])
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

        subtitle_text = entry["username"] or entry["email"] or "(no username)"
        if entry["category"]:
            subtitle_text += f"  \u00b7  {entry['category']}"

        username_label = tk.Label(
            info, text=subtitle_text, font=self.hint_font,
            bg=COLORS["bg_surface"], fg=COLORS["text_secondary"], anchor="w"
        )
        username_label.pack(fill="x")

        actions = tk.Frame(row, bg=COLORS["bg_surface"])
        actions.pack(side="right")

        star_text = "\u2605" if entry["is_favorite"] else "\u2606"
        favorite_button = tk.Button(
            actions, text=star_text, font=self.hint_font,
            bg=COLORS["bg_surface_hover"],
            fg=COLORS["accent"] if entry["is_favorite"] else COLORS["text_secondary"],
            relief="flat", cursor="hand2",
            command=lambda: self._toggle_entry_favorite(entry["id"], entry["is_favorite"]),
        )
        favorite_button.pack(side="left", padx=4, ipady=2, ipadx=6)

        copy_button = tk.Button(
            actions, text="Copy", font=self.hint_font,
            bg=COLORS["bg_surface_hover"], fg=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=lambda: self._copy_password(entry["encrypted_password"]),
        )
        copy_button.pack(side="left", padx=4, ipady=2, ipadx=6)

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
        database.delete_entry(self.username, entry_id)
        self._build_list_view()

    def _toggle_entry_favorite(self, entry_id, current_value):
        database.toggle_favorite(self.username, entry_id, not current_value)
        self._refresh_list()

    def _copy_password(self, encrypted_password):
        plaintext = self.session.decrypt(encrypted_password)
        self.clipboard_clear()
        self.clipboard_append(plaintext)

        def clear_if_unchanged():
            try:
                if self.clipboard_get() == plaintext:
                    self.clipboard_clear()
            except tk.TclError:
                pass

        self.after(30000, clear_if_unchanged)

    # ---------- "+" choice screen ----------

    def _show_add_choice(self):
        self._clear()
        container = self._make_scrollable()

        title = tk.Label(
            container, text="What would you like to add?", font=self.heading_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_primary"]
        )
        title.pack(pady=(64, 32))

        button_frame = tk.Frame(container, bg=COLORS["bg_primary"])
        button_frame.pack(padx=48, fill="x")

        category_button = tk.Button(
            button_frame, text="Category", font=self.body_font,
            bg=COLORS["bg_surface"], fg=COLORS["text_primary"],
            activebackground=COLORS["bg_surface_hover"], activeforeground=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=self._show_add_category_form,
        )
        category_button.pack(fill="x", pady=(0, 12), ipady=16)

        account_button = tk.Button(
            button_frame, text="Account", font=self.body_font,
            bg=COLORS["accent"], fg=COLORS["text_primary"],
            activebackground=COLORS["accent_hover"], activeforeground=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=self._show_add_form,
        )
        account_button.pack(fill="x", pady=(0, 12), ipady=16)

        cancel_button = tk.Button(
            button_frame, text="Cancel", font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_secondary"],
            relief="flat", cursor="hand2", bd=0,
            command=self._build_list_view,
        )
        cancel_button.pack(pady=(4, 0))

    # ---------- Category creation ----------

    def _show_add_category_form(self):
        self._clear()
        container = self._make_scrollable()

        title = tk.Label(
            container, text="New Category", font=self.heading_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_primary"]
        )
        title.pack(pady=(48, 16))

        label = tk.Label(
            container, text="Category Name", font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_secondary"], anchor="w"
        )
        label.pack(fill="x", padx=48, pady=(8, 2))

        name_entry = tk.Entry(
            container, font=self.body_font,
            bg=COLORS["bg_surface"], fg=COLORS["text_primary"],
            insertbackground=COLORS["text_primary"],
            relief="flat", highlightthickness=1,
            highlightbackground=COLORS["border_subtle"],
            highlightcolor=COLORS["accent"],
        )
        name_entry.pack(padx=48, ipady=8, fill="x")
        name_entry.focus_set()

        status_label = tk.Label(
            container, text="", font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["danger"]
        )
        status_label.pack(pady=(8, 0))

        def on_save():
            name = name_entry.get().strip()
            if not name:
                status_label.config(text="Category name is required.")
                return
            database.add_category(self.username, name)
            self._build_list_view()

        button_row = tk.Frame(container, bg=COLORS["bg_primary"])
        button_row.pack(padx=48, fill="x", pady=(16, 0))

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

    # ---------- Account creation / editing ----------

    def _show_add_form(self):
        self._pending_custom_fields = []
        self._show_form(entry=None)

    def _show_edit_form(self, entry):
        existing_custom_fields = database.get_custom_fields(self.username, entry["id"])
        self._pending_custom_fields = [
            {"label": row["label"], "value": self.session.decrypt(row["encrypted_value"])}
            for row in existing_custom_fields
        ]
        self._show_form(entry=entry)

    def _show_form(self, entry):
        self._clear()
        container = self._make_scrollable()

        is_edit = entry is not None
        heading_text = "Edit Account" if is_edit else "Add an Account"

        title = tk.Label(
            container, text=heading_text, font=self.heading_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_primary"]
        )
        title.pack(pady=(24, 16))

        form = tk.Frame(container, bg=COLORS["bg_primary"])
        form.pack(padx=48, fill="x")

        def make_field(label_text, initial_value="", is_password=False, parent=None):
            target = parent if parent is not None else form
            label = tk.Label(
                target, text=label_text, font=self.hint_font,
                bg=COLORS["bg_primary"], fg=COLORS["text_secondary"], anchor="w"
            )
            label.pack(fill="x", pady=(8, 2))

            if not is_password:
                entry_widget = tk.Entry(
                    target, font=self.body_font,
                    bg=COLORS["bg_surface"], fg=COLORS["text_primary"],
                    insertbackground=COLORS["text_primary"],
                    relief="flat", highlightthickness=1,
                    highlightbackground=COLORS["border_subtle"],
                    highlightcolor=COLORS["accent"],
                )
                entry_widget.insert(0, initial_value)
                entry_widget.pack(fill="x", ipady=6)
                return entry_widget

            row = tk.Frame(target, bg=COLORS["bg_primary"])
            row.pack(fill="x")

            entry_widget = tk.Entry(
                row, font=self.body_font,
                bg=COLORS["bg_surface"], fg=COLORS["text_primary"],
                insertbackground=COLORS["text_primary"],
                relief="flat", highlightthickness=1,
                highlightbackground=COLORS["border_subtle"],
                highlightcolor=COLORS["accent"],
                show="\u2022",
            )
            entry_widget.insert(0, initial_value)
            entry_widget.pack(side="left", ipady=6, fill="x", expand=True)

            visible = {"value": False}

            def toggle_visibility():
                visible["value"] = not visible["value"]
                entry_widget.config(show="" if visible["value"] else "\u2022")

            toggle_button = tk.Button(
                row, text="\U0001F441", font=self.body_font,
                bg=COLORS["bg_surface"], fg=COLORS["text_secondary"],
                activebackground=COLORS["bg_surface_hover"], activeforeground=COLORS["text_primary"],
                relief="flat", cursor="hand2", bd=0,
                command=toggle_visibility,
            )
            toggle_button.pack(side="left", padx=(6, 0), ipady=6, ipadx=8)

            return entry_widget

        title_entry = make_field("What account? (e.g. Instagram, Facebook)", entry["title"] if is_edit else "")
        email_entry = make_field("Email (optional)", entry["email"] if is_edit and entry["email"] else "")
        username_entry = make_field("Username (optional)", entry["username"] if is_edit and entry["username"] else "")

        existing_password = ""
        if is_edit and entry["encrypted_password"]:
            existing_password = self.session.decrypt(entry["encrypted_password"])
        password_entry = make_field("Password", existing_password, is_password=True)

        existing_notes = ""
        if is_edit and entry["encrypted_notes"]:
            existing_notes = self.session.decrypt(entry["encrypted_notes"])
        notes_entry = make_field("Notes (optional)", existing_notes)

        url_entry = make_field("URL (optional)", entry["url"] if is_edit and entry["url"] else "")

        custom_fields_container = tk.Frame(form, bg=COLORS["bg_primary"])
        custom_fields_container.pack(fill="x", pady=(8, 0))

        custom_field_widgets = []

        def render_custom_fields():
            for widget in custom_fields_container.winfo_children():
                widget.destroy()
            custom_field_widgets.clear()
            for field_data in self._pending_custom_fields:
                widget = make_field(field_data["label"], field_data.get("value", ""), parent=custom_fields_container)
                custom_field_widgets.append((field_data["label"], widget))

        render_custom_fields()

        def add_custom_field():
            label_name = _prompt_for_label(self)
            if label_name:
                self._pending_custom_fields.append({"label": label_name, "value": ""})
                render_custom_fields()

        add_field_button = tk.Button(
            form, text="+ Add Field", font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["accent"],
            relief="flat", cursor="hand2", bd=0,
            command=add_custom_field,
        )
        add_field_button.pack(anchor="w", pady=(4, 0))

        status_label = tk.Label(
            form, text="", font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["danger"]
        )
        status_label.pack(pady=(8, 0))

        def on_continue():
            title_value = title_entry.get().strip()
            if not title_value:
                status_label.config(text="Please enter what account this is (e.g. Instagram).")
                return
            if not password_entry.get():
                status_label.config(text="Password is required.")
                return

            collected_custom_values = [
                (label_name, widget.get()) for label_name, widget in custom_field_widgets
            ]

            self._pending_account = {
                "is_edit": is_edit,
                "entry_id": entry["id"] if is_edit else None,
                "title": title_value,
                "email": email_entry.get().strip() or None,
                "username": username_entry.get().strip() or None,
                "password": password_entry.get(),
                "notes": notes_entry.get().strip() or None,
                "url": url_entry.get().strip() or None,
                "category": entry["category"] if is_edit else None,
                "custom_fields": collected_custom_values,
            }
            self._show_category_picker()

        button_row = tk.Frame(form, bg=COLORS["bg_primary"])
        button_row.pack(fill="x", pady=(16, 0))

        cancel_button = tk.Button(
            button_row, text="Cancel", font=self.body_font,
            bg=COLORS["bg_surface_hover"], fg=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=self._build_list_view,
        )
        cancel_button.pack(side="left", fill="x", expand=True, padx=(0, 4), ipady=8)

        continue_button = tk.Button(
            button_row, text="Continue", font=self.body_font,
            bg=COLORS["accent"], fg=COLORS["text_primary"],
            activebackground=COLORS["accent_hover"], activeforeground=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=on_continue,
        )
        continue_button.pack(side="left", fill="x", expand=True, padx=(4, 0), ipady=8)

    # ---------- Category picker (final step) ----------

    def _show_category_picker(self):
        self._clear()
        container = self._make_scrollable()

        title = tk.Label(
            container, text="Choose a Category", font=self.heading_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_primary"]
        )
        title.pack(pady=(48, 8))

        hint = tk.Label(
            container, text="Where should this account be placed?", font=self.hint_font,
            bg=COLORS["bg_primary"], fg=COLORS["text_secondary"]
        )
        hint.pack(pady=(0, 16))

        categories = database.get_all_categories(self.username)
        selected_category = tk.StringVar(value=self._pending_account.get("category") or "")

        options_frame = tk.Frame(container, bg=COLORS["bg_primary"])
        options_frame.pack(padx=48, fill="x")

        if not categories:
            empty_label = tk.Label(
                options_frame, text="No categories yet. Click \"+\" \u2192 \"Category\" first to create one, or skip for now.",
                font=self.hint_font, bg=COLORS["bg_primary"], fg=COLORS["text_secondary"], wraplength=320, justify="left"
            )
            empty_label.pack(pady=(0, 12))
        else:
            for category_name in categories:
                row = tk.Radiobutton(
                    options_frame, text=category_name, variable=selected_category, value=category_name,
                    font=self.body_font, bg=COLORS["bg_primary"], fg=COLORS["text_primary"],
                    selectcolor=COLORS["bg_surface"], activebackground=COLORS["bg_primary"],
                    activeforeground=COLORS["text_primary"], anchor="w"
                )
                row.pack(fill="x", pady=2)

        def on_confirm():
            account = self._pending_account
            category_value = selected_category.get().strip() or None

            encrypted_password = self.session.encrypt(account["password"])
            encrypted_notes = self.session.encrypt(account["notes"]) if account["notes"] else None

            if account["is_edit"]:
                database.update_entry(
                    self.username, account["entry_id"], account["title"], account["username"],
                    account["email"], encrypted_password, encrypted_notes, account["url"], category_value
                )
                database.delete_custom_fields_for_entry(self.username, account["entry_id"])
                entry_id = account["entry_id"]
            else:
                entry_id = database.add_entry(
                    self.username, account["title"], account["username"], account["email"],
                    encrypted_password, encrypted_notes, account["url"], category_value
                )

            for label_name, value in account["custom_fields"]:
                if value:
                    encrypted_value = self.session.encrypt(value)
                    database.add_custom_field(self.username, entry_id, label_name, encrypted_value)

            self._pending_account = None
            self._build_list_view()

        button_row = tk.Frame(container, bg=COLORS["bg_primary"])
        button_row.pack(padx=48, fill="x", pady=(16, 0))

        back_button = tk.Button(
            button_row, text="Back", font=self.body_font,
            bg=COLORS["bg_surface_hover"], fg=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=self._build_list_view,
        )
        back_button.pack(side="left", fill="x", expand=True, padx=(0, 4), ipady=8)

        confirm_button = tk.Button(
            button_row, text="Save", font=self.body_font,
            bg=COLORS["accent"], fg=COLORS["text_primary"],
            activebackground=COLORS["accent_hover"], activeforeground=COLORS["text_primary"],
            relief="flat", cursor="hand2",
            command=on_confirm,
        )
        confirm_button.pack(side="left", fill="x", expand=True, padx=(4, 0), ipady=8)


def _prompt_for_label(parent):
    dialog = tk.Toplevel(parent)
    dialog.title("New Field")
    dialog.configure(bg=COLORS["bg_primary"])
    dialog.geometry("300x150")
    dialog.transient(parent)
    dialog.grab_set()

    result = {"value": None}

    label = tk.Label(
        dialog, text="Field Name (e.g. Phone Number)", font=("Segoe UI", 10),
        bg=COLORS["bg_primary"], fg=COLORS["text_secondary"]
    )
    label.pack(pady=(16, 8), padx=16)

    entry = tk.Entry(
        dialog, font=("Segoe UI", 12),
        bg=COLORS["bg_surface"], fg=COLORS["text_primary"],
        insertbackground=COLORS["text_primary"],
        relief="flat", highlightthickness=1,
        highlightbackground=COLORS["border_subtle"],
        highlightcolor=COLORS["accent"],
    )
    entry.pack(padx=16, fill="x", ipady=6)
    entry.focus_set()

    def confirm():
        value = entry.get().strip()
        if value:
            result["value"] = value
        dialog.destroy()

    entry.bind("<Return>", lambda event: confirm())

    button = tk.Button(
        dialog, text="Add", font=("Segoe UI", 10),
        bg=COLORS["accent"], fg=COLORS["text_primary"],
        relief="flat", cursor="hand2",
        command=confirm,
    )
    button.pack(pady=12, padx=16, fill="x", ipady=6)

    parent.wait_window(dialog)
    return result["value"]