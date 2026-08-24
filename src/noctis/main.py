import os
import webview

from noctis import database, security


class Api:
    def __init__(self):
        self.current_username = None
        self.session = security.VaultSession()

    # ---------- Auth ----------

    def register_user(self, username, email, password):
        if security.user_exists(username):
            return {"success": False, "message": "An account already exists for this username. Please log in instead."}
        if security.email_in_use(email):
            return {"success": False, "message": "This email is already associated with another account."}

        security.register_user(username, email, password)
        return {"success": True}

    def login_user(self, username, password):
        if not security.user_exists(username):
            return {"success": False, "message": "No account found for this username. Please register first."}

        guard = security.LoginGuard(username)
        if not guard.can_attempt():
            wait = guard.seconds_until_unlocked()
            return {"success": False, "message": f"Too many attempts. Try again in {wait:.0f}s."}

        if security.check_master_password(username, password):
            guard.record_success()
            self.session.unlock(username, password)
            self.current_username = username
            database.initialize_database(username)
            return {"success": True}
        else:
            guard.record_failure()
            return {"success": False, "message": "Incorrect username or password."}

    def logout(self):
        self.session.lock()
        self.current_username = None
        return {"success": True}

    # ---------- Vault data ----------

    def _row_to_dict(self, row):
        return {
            "id": row["id"],
            "title": row["title"],
            "username": row["username"],
            "email": row["email"],
            "url": row["url"],
            "category": row["category"],
            "is_favorite": bool(row["is_favorite"]),
        }

    def get_entries(self):
        rows = database.get_all_entries(self.current_username)
        return [self._row_to_dict(row) for row in rows]

    def get_categories(self):
        return database.get_all_categories(self.current_username)

    def add_category(self, name):
        database.add_category(self.current_username, name)
        return {"success": True}

    def rename_category(self, old_name, new_name):
        database.rename_category(self.current_username, old_name, new_name)
        return {"success": True}

    def delete_category(self, name):
        database.delete_category(self.current_username, name)
        return {"success": True}

    def toggle_favorite(self, entry_id, is_favorite):
        database.toggle_favorite(self.current_username, entry_id, is_favorite)
        return {"success": True}

    def delete_entry(self, entry_id):
        database.delete_entry(self.current_username, entry_id)
        return {"success": True}

    def save_account(self, data):
        encrypted_password = self.session.encrypt(data.get("password", ""))
        notes = data.get("notes") or None
        encrypted_notes = self.session.encrypt(notes) if notes else None

        entry_id = database.add_entry(
            self.current_username,
            data.get("title"),
            data.get("username") or None,
            data.get("email") or None,
            encrypted_password,
            encrypted_notes,
            data.get("url") or None,
            data.get("category") or None,
        )

        for field in data.get("custom_fields", []):
            label = field.get("label")
            value = field.get("value")
            if label and value:
                encrypted_value = self.session.encrypt(value)
                database.add_custom_field(self.current_username, entry_id, label, encrypted_value)

        return {"success": True, "entry_id": entry_id}

    def update_account(self, entry_id, data):
        encrypted_password = self.session.encrypt(data.get("password", ""))
        notes = data.get("notes") or None
        encrypted_notes = self.session.encrypt(notes) if notes else None

        database.update_entry(
            self.current_username,
            entry_id,
            data.get("title"),
            data.get("username") or None,
            data.get("email") or None,
            encrypted_password,
            encrypted_notes,
            data.get("url") or None,
            data.get("category") or None,
        )

        database.delete_custom_fields_for_entry(self.current_username, entry_id)
        for field in data.get("custom_fields", []):
            label = field.get("label")
            value = field.get("value")
            if label and value:
                encrypted_value = self.session.encrypt(value)
                database.add_custom_field(self.current_username, entry_id, label, encrypted_value)

        return {"success": True}

    def get_entry_details(self, entry_id):
        rows = database.get_all_entries(self.current_username)
        entry = next((row for row in rows if row["id"] == entry_id), None)
        if entry is None:
            return {"success": False, "message": "Entry not found."}

        notes = self.session.decrypt(entry["encrypted_notes"]) if entry["encrypted_notes"] else None

        custom_field_rows = database.get_custom_fields(self.current_username, entry_id)
        custom_fields = [
            {"label": row["label"], "value": self.session.decrypt(row["encrypted_value"])}
            for row in custom_field_rows
        ]

        return {
            "success": True,
            "id": entry["id"],
            "title": entry["title"],
            "email": entry["email"],
            "username": entry["username"],
            "notes": notes,
            "url": entry["url"],
            "category": entry["category"],
            "is_favorite": bool(entry["is_favorite"]),
            "custom_fields": custom_fields,
        }

    def verify_master_password(self, password):
        if security.check_master_password(self.current_username, password):
            return {"success": True}
        return {"success": False, "message": "Incorrect master password."}

    def reveal_password(self, entry_id, master_password):
        if not security.check_master_password(self.current_username, master_password):
            return {"success": False, "message": "Incorrect master password."}

        rows = database.get_all_entries(self.current_username)
        entry = next((row for row in rows if row["id"] == entry_id), None)
        if entry is None:
            return {"success": False, "message": "Entry not found."}

        plaintext = self.session.decrypt(entry["encrypted_password"])
        return {"success": True, "password": plaintext}


def get_web_path(filename):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "web", filename)


def main():
    api = Api()
    webview.create_window(
        "Noctis",
        get_web_path("login.html"),
        js_api=api,
        width=500,
        height=650,
    )
    webview.start()


if __name__ == "__main__":
    main()