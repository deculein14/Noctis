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

togglePassword.addEventListener("click", () => {
  passwordInput.type = passwordInput.type === "password" ? "text" : "password";
});

submitButton.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const email = emailInput.value.trim();

  if (!username) {
    statusMessage.style.color = "#EF4444";
    statusMessage.textContent = "Please enter a username.";
    return;
  }

  if (mode === "register") {
    if (!email || !email.includes("@")) {
      statusMessage.style.color = "#EF4444";
      statusMessage.textContent = "Please enter a valid email address.";
      return;
    }
    if (password.length < 5) {
      statusMessage.style.color = "#EF4444";
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
      statusMessage.style.color = "#EF4444";
      statusMessage.textContent = result.message;
    }
  }
});

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    submitButton.click();
  }
});