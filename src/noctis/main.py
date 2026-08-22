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
    idle_timer_id = {"value": None}

    def show_login():
        cancel_idle_timer()
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
        reset_idle_timer()

    def cancel_idle_timer():
        if idle_timer_id["value"] is not None:
            window.after_cancel(idle_timer_id["value"])
            idle_timer_id["value"] = None

    def reset_idle_timer(event=None):
        if not session.is_unlocked:
            return
        cancel_idle_timer()
        idle_timer_id["value"] = window.after(config.AUTO_LOCK_SECONDS * 1000, auto_lock)

    def auto_lock():
        session.lock()
        show_login()

    window.bind_all("<Motion>", reset_idle_timer)
    window.bind_all("<Key>", reset_idle_timer)
    window.bind_all("<Button>", reset_idle_timer)

    show_login()
    window.mainloop()


if __name__ == "__main__":
    main()