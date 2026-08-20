import tkinter as tk

from noctis import config


def main():
    window = tk.Tk()
    window.title(config.APP_NAME)
    window.geometry(f"{config.WINDOW_WIDTH}x{config.WINDOW_HEIGHT}")

    label = tk.Label(window, text="Noctis — Password Manager", font=("Segoe UI", 14))
    label.pack(pady=20)

    window.mainloop()


if __name__ == "__main__":
    main()