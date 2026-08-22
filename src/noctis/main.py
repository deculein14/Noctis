import tkinter as tk

from noctis import config
from noctis.ui import LoginScreen, COLORS


def main():
    window = tk.Tk()
    window.title(config.APP_NAME)
    window.geometry(f"{config.WINDOW_WIDTH}x{config.WINDOW_HEIGHT}")
    window.configure(bg=COLORS["bg_primary"])

    def on_login_success(master_password):
        print("Login successful. Master password captured (not printed for safety).")
        # Vault screen will be built in a later step.

    login_screen = LoginScreen(window, on_success=on_login_success)
    login_screen.pack(fill="both", expand=True)

    window.mainloop()


if __name__ == "__main__":
    main()