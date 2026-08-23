import os
import webview

from noctis import database, security


class Api:
    def __init__(self):
        self.current_username = None

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
            return {"success": True}
        else:
            guard.record_failure()
            return {"success": False, "message": "Incorrect username or password."}

    def open_vault(self, username):
        self.current_username = username
        print(f"Login successful for: {username}. Vault screen not built yet.")


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