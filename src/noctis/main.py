import tkinter as tk


def main():
    window = tk.Tk()
    window.title("Noctis")
    window.geometry("400x300")

    label = tk.Label(window, text="Noctis — Password Manager", font=("Segoe UI", 14))
    label.pack(pady=20)

    window.mainloop()


if __name__ == "__main__":
    main()