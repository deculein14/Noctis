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
const confirmPasswordField = document.getElementById("confirm-password-field");
const confirmPasswordInput = document.getElementById("confirm-password-input");
const toggleConfirmPassword = document.getElementById("toggle-confirm-password");
const codeField = document.getElementById("code-field");
const codeInput = document.getElementById("code-input");

let pendingRegistration = null;

function updateModeDisplay() {
  statusMessage.textContent = "";
  if (mode === "login") {
    modeSubtitle.textContent = "Log in to your vault";
    emailField.style.display = "none";
    confirmPasswordField.style.display = "none";
    confirmPasswordInput.value = "";
    codeField.style.display = "none";
    codeInput.value = "";
    usernameInput.disabled = false;
    emailInput.disabled = false;
    passwordInput.disabled = false;
    confirmPasswordInput.disabled = false;
    submitButton.textContent = "Log In";
    modeSwitch.style.display = "block";
    modeSwitch.textContent = "No account yet? Register";
  } else if (mode === "register") {
    modeSubtitle.textContent = "Create a new account";
    emailField.style.display = "block";
    confirmPasswordField.style.display = "block";
    codeField.style.display = "none";
    usernameInput.disabled = false;
    emailInput.disabled = false;
    passwordInput.disabled = false;
    confirmPasswordInput.disabled = false;
    submitButton.textContent = "Send Verification Code";
    modeSwitch.style.display = "block";
    modeSwitch.textContent = "Already have an account? Log in";
  } else if (mode === "awaiting_code") {
    modeSubtitle.textContent = `We sent a 6-digit code to ${pendingRegistration.email}`;
    codeField.style.display = "block";
    usernameInput.disabled = true;
    emailInput.disabled = true;
    passwordInput.disabled = true;
    confirmPasswordInput.disabled = true;
    submitButton.textContent = "Verify & Create Account";
    modeSwitch.style.display = "none";
  }
}

modeSwitch.addEventListener("click", () => {
  mode = mode === "login" ? "register" : "login";
  updateModeDisplay();
});

const EYE_ICON = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_ICON = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
});

togglePassword.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  togglePassword.innerHTML = isPassword ? EYE_OFF_ICON : EYE_ICON;
});

toggleConfirmPassword.addEventListener("click", () => {
  const isPassword = confirmPasswordInput.type === "password";
  confirmPasswordInput.type = isPassword ? "text" : "password";
  toggleConfirmPassword.innerHTML = isPassword ? EYE_OFF_ICON : EYE_ICON;
});

submitButton.addEventListener("click", async () => {
  if (mode === "login") {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username) {
      statusMessage.style.color = "#EF4444";
      statusMessage.textContent = "Please enter a username.";
      return;
    }

    const result = await window.pywebview.api.login_user(username, password);
    if (result.success) {
      window.location.href = "vault.html";
    } else {
      statusMessage.style.color = "#EF4444";
      statusMessage.textContent = result.message;
    }
    return;
  }

  if (mode === "register") {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const email = emailInput.value.trim();

    if (!username) {
      statusMessage.style.color = "#EF4444";
      statusMessage.textContent = "Please enter a username.";
      return;
    }
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
    if (password !== confirmPasswordInput.value) {
      statusMessage.style.color = "#EF4444";
      statusMessage.textContent = "Passwords do not match.";
      return;
    }

    statusMessage.style.color = "#8B93A7";
    statusMessage.textContent = "Sending verification code...";

    const result = await window.pywebview.api.request_registration_code(username, email, password);
    if (result.success) {
      pendingRegistration = { username, email, password };
      mode = "awaiting_code";
      updateModeDisplay();
      statusMessage.style.color = "#8B93A7";
      statusMessage.textContent = "";
    } else {
      statusMessage.style.color = "#EF4444";
      statusMessage.textContent = result.message;
    }
    return;
  }

  if (mode === "awaiting_code") {
    const code = codeInput.value.trim();
    if (!code) {
      statusMessage.style.color = "#EF4444";
      statusMessage.textContent = "Please enter the code sent to your email.";
      return;
    }

    const result = await window.pywebview.api.confirm_registration(
      pendingRegistration.username,
      pendingRegistration.email,
      pendingRegistration.password,
      code
    );

    if (result.success) {
      pendingRegistration = null;
      mode = "login";
      updateModeDisplay();
      passwordInput.value = "";
      confirmPasswordInput.value = "";
      statusMessage.style.color = "#22C55E";
      statusMessage.textContent = "Account created! Please log in.";
    } else {
      statusMessage.style.color = "#EF4444";
      statusMessage.textContent = result.message;
    }
  }
});

// ---------- Enter-to-next-field navigation ----------
//
// Field order depends on the current mode, since email/confirm-password are
// hidden in login mode and everything but the code field is disabled while
// awaiting the verification code. Pressing Enter in the last field of the
// current mode submits the form (same as clicking submitButton).

function getFieldOrder() {
  if (mode === "login") return [usernameInput, passwordInput];
  if (mode === "register") return [emailInput, usernameInput, passwordInput, confirmPasswordInput];
  if (mode === "awaiting_code") return [codeInput];
  return [];
}

function handleEnterNavigation(event) {
  if (event.key !== "Enter") return;

  const order = getFieldOrder();
  const index = order.indexOf(event.target);
  if (index === -1) return;

  event.preventDefault();

  if (index < order.length - 1) {
    order[index + 1].focus();
  } else {
    submitButton.click();
  }
}

[usernameInput, emailInput, passwordInput, confirmPasswordInput, codeInput].forEach((input) => {
  input.addEventListener("keydown", handleEnterNavigation);
});