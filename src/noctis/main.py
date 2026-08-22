import tkinter as tk

from noctis import config, database, security
from noctis.ui import LoginScreen, VaultScreen, COLORS


def main():
    database.initialize_database()

    window = tk.Tk()
    window.title(config.APP_NAME)
    window.geometry(f"{config.WINDOW_WIDTH}x{config.WINDOW_HEIGHT}")
    window.configure(bg=COLORS["bg_primary"])

    session = security.VaultSession()

    def show_login():
        for widget in window.winfo_children():
            widget.destroy()
        login_screen = LoginScreen(window, on_success=on_login_success)
        login_screen.pack(fill="both", expand=True)

    def on_login_success(master_password):
        if not session.is_unlocked:
            session.unlock(master_password)
        show_vault()

    def show_vault():
        for widget in window.winfo_children():
            widget.destroy()
        vault_screen = VaultScreen(window, session=session)
        vault_screen.pack(fill="both", expand=True)

    show_login()
    window.mainloop()


if __name__ == "__main__":
    main()