let mode = "login";

const modeSubtitle = document.getElementById("mode-subtitle");
const emailField = document.getElementById("email-field");
const emailInput = document.getElementById("email-input");
const usernameInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const statusMessage = document.getElementById("status-message");
const submitButton = document.getElementById("submit-button");
const modeSwitch = document.getElementById("mode-switch");
const togglePassword = document.getElementById("toggle-password");

function updateModeDisplay() {
  statusMessage.textContent = "";
  if (mode === "login") {
    modeSubtitle.textContent = "Log in to your vault";
    emailField.style.display = "none";
    submitButton.textContent = "Log In";
    modeSwitch.textContent = "No account yet? Register";
  } else {
    modeSubtitle.textContent = "Create a new account";
    emailField.style.display = "block";
    submitButton.textContent = "Create Account";
    modeSwitch.textContent = "Already have an account? Log in";
  }
}

modeSwitch.addEventListener("click", () => {
  mode = mode === "login" ? "register" : "login";
  updateModeDisplay();
});

const EYE_ICON = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_ICON = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

togglePassword.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  togglePassword.innerHTML = isPassword ? EYE_OFF_ICON : EYE_ICON;
});

submitButton.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const email = emailInput.value.trim();

  if (!username) {
    statusMessage.textContent = "Please enter a username.";
    return;
  }

  if (mode === "register") {
    if (!email || !email.includes("@")) {
      statusMessage.textContent = "Please enter a valid email address.";
      return;
    }
    if (password.length < 5) {
      statusMessage.textContent = "Master password must be at least 5 characters.";
      return;
    }
    const result = await window.pywebview.api.register_user(username, email, password);
    if (result.success) {
      mode = "login";
      updateModeDisplay();
      passwordInput.value = "";
      statusMessage.style.color = "#22C55E";
      statusMessage.textContent = "Account created! Please log in.";
    } else {
      statusMessage.style.color = "#EF4444";
      statusMessage.textContent = result.message;
    }
  } else {
    const result = await window.pywebview.api.login_user(username, password);
    if (result.success) {
      window.location.href = "vault.html";
    } else {
      statusMessage.textContent = result.message;
    }
  }
});

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    submitButton.click();
  }
});