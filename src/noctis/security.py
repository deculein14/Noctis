import base64
import json
import os
import random
import smtplib
import time
from email.mime.text import MIMEText
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from dotenv import load_dotenv

load_dotenv()

USERS_FILENAME = "users.json"
ACCOUNT_LOG_FILENAME = "account_log.txt"
LOGIN_GUARDS_FILENAME = "login_guards.json"
VERIFICATION_STRING = b"noctis-vault-check"
KDF_ITERATIONS = 480_000


def _normalize_username(username: str) -> str:
    return username.strip().lower()


def _load_json(filename: str) -> dict:
    path = Path(filename)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def _save_json(filename: str, data: dict) -> None:
    Path(filename).write_text(json.dumps(data))


def generate_salt():
    return os.urandom(16)


def derive_key(master_password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=KDF_ITERATIONS,
    )
    raw_key = kdf.derive(master_password.encode("utf-8"))
    return base64.urlsafe_b64encode(raw_key)


PENDING_VERIFICATIONS_FILENAME = "pending_verifications.json"
VERIFICATION_CODE_TTL_SECONDS = 600  # 10 minutes


def _generate_verification_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def send_verification_code(email: str) -> dict:
    gmail_address = os.environ.get("GMAIL_ADDRESS")
    gmail_app_password = os.environ.get("GMAIL_APP_PASSWORD")

    if not gmail_address or not gmail_app_password:
        return {"success": False, "message": "Email sending is not configured on this device."}

    code = _generate_verification_code()

    pending = _load_json(PENDING_VERIFICATIONS_FILENAME)
    pending[email.strip().lower()] = {
        "code": code,
        "expires_at": time.time() + VERIFICATION_CODE_TTL_SECONDS,
    }
    _save_json(PENDING_VERIFICATIONS_FILENAME, pending)

    message = MIMEText(f"Your Noctis verification code is: {code}\n\nThis code expires in 10 minutes.")
    message["Subject"] = "Your Noctis verification code"
    message["From"] = gmail_address
    message["To"] = email

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_address, gmail_app_password)
            server.sendmail(gmail_address, [email], message.as_string())
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": f"Could not send verification email: {e}"}


def check_verification_code(email: str, entered_code: str) -> dict:
    email = email.strip().lower()
    pending = _load_json(PENDING_VERIFICATIONS_FILENAME)
    entry = pending.get(email)

    if entry is None:
        return {"success": False, "message": "No verification code was requested for this email."}

    if time.time() > entry["expires_at"]:
        del pending[email]
        _save_json(PENDING_VERIFICATIONS_FILENAME, pending)
        return {"success": False, "message": "This code has expired. Please request a new one."}

    if entered_code.strip() != entry["code"]:
        return {"success": False, "message": "Incorrect verification code."}

    del pending[email]
    _save_json(PENDING_VERIFICATIONS_FILENAME, pending)
    return {"success": True}


def user_exists(username: str) -> bool:
    users = _load_json(USERS_FILENAME)
    return _normalize_username(username) in users


def register_user(username: str, email: str, master_password: str) -> None:
    username = _normalize_username(username)
    salt = generate_salt()
    key = derive_key(master_password, salt)
    fernet = Fernet(key)
    verification_token = fernet.encrypt(VERIFICATION_STRING)

    users = _load_json(USERS_FILENAME)
    users[username] = {
        "email": email.strip(),
        "salt": base64.b64encode(salt).decode("utf-8"),
        "verification_token": verification_token.decode("utf-8"),
    }
    _save_json(USERS_FILENAME, users)
    _log_account_created(username, email)


def _log_account_created(username: str, email: str) -> None:
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"{timestamp} | username: {username} | email: {email.strip()}\n"
    with open(ACCOUNT_LOG_FILENAME, "a", encoding="utf-8") as log_file:
        log_file.write(line)


def check_master_password(username: str, master_password: str) -> bool:
    username = _normalize_username(username)
    users = _load_json(USERS_FILENAME)
    if username not in users:
        return False

    user_data = users[username]
    salt = base64.b64decode(user_data["salt"])
    key = derive_key(master_password, salt)
    fernet = Fernet(key)

    try:
        decrypted = fernet.decrypt(user_data["verification_token"].encode("utf-8"))
        return decrypted == VERIFICATION_STRING
    except InvalidToken:
        return False


def get_user_salt(username: str) -> bytes:
    username = _normalize_username(username)
    users = _load_json(USERS_FILENAME)
    return base64.b64decode(users[username]["salt"])


def get_user_email(username: str) -> str:
    username = _normalize_username(username)
    users = _load_json(USERS_FILENAME)
    return users.get(username, {}).get("email", "")


def email_in_use(email: str) -> bool:
    normalized_email = email.strip().lower()
    users = _load_json(USERS_FILENAME)
    for user_data in users.values():
        if user_data.get("email", "").strip().lower() == normalized_email:
            return True
    return False


def get_database_filename(username: str) -> str:
    username = _normalize_username(username)
    safe_name = "".join(c if c.isalnum() else "_" for c in username)
    return f"vault_{safe_name}.db"


def get_media_directory(username: str) -> str:
    """Per-user root folder where inserted images/videos are permanently
    stored (files are moved here, not copied - see main.py's insert_media_file)."""
    username = _normalize_username(username)
    safe_name = "".join(c if c.isalnum() else "_" for c in username)
    return f"media_{safe_name}"


class VaultSession:
    def __init__(self):
        self._key = None
        self.username = None

    @property
    def is_unlocked(self) -> bool:
        return self._key is not None

    def unlock(self, username: str, master_password: str) -> bool:
        if not check_master_password(username, master_password):
            return False

        salt = get_user_salt(username)
        self._key = derive_key(master_password, salt)
        self.username = _normalize_username(username)
        return True

    def lock(self) -> None:
        self._key = None
        self.username = None

    def encrypt(self, plaintext: str) -> bytes:
        if not self.is_unlocked:
            raise RuntimeError("Vault is locked. Call unlock() first.")
        fernet = Fernet(self._key)
        return fernet.encrypt(plaintext.encode("utf-8"))

    def decrypt(self, ciphertext: bytes) -> str:
        if not self.is_unlocked:
            raise RuntimeError("Vault is locked. Call unlock() first.")
        fernet = Fernet(self._key)
        return fernet.decrypt(ciphertext).decode("utf-8")


class LoginGuard:
    WAIT_TIMES = {3: 5, 4: 15, 5: 30}
    DEFAULT_WAIT = 60

    def __init__(self, username: str):
        self.username = _normalize_username(username)
        self.failed_attempts = 0
        self._locked_until_epoch = 0.0
        self._load()

    def _load(self):
        all_guards = _load_json(LOGIN_GUARDS_FILENAME)
        data = all_guards.get(self.username, {})
        self.failed_attempts = data.get("failed_attempts", 0)
        self._locked_until_epoch = data.get("locked_until_epoch", 0.0)

    def _save(self):
        all_guards = _load_json(LOGIN_GUARDS_FILENAME)
        all_guards[self.username] = {
            "failed_attempts": self.failed_attempts,
            "locked_until_epoch": self._locked_until_epoch,
        }
        _save_json(LOGIN_GUARDS_FILENAME, all_guards)

    def seconds_until_unlocked(self) -> float:
        remaining = self._locked_until_epoch - time.time()
        return max(0.0, remaining)

    def can_attempt(self) -> bool:
        return self.seconds_until_unlocked() == 0.0

    def record_failure(self) -> None:
        self.failed_attempts += 1
        wait = self.WAIT_TIMES.get(self.failed_attempts, self.DEFAULT_WAIT if self.failed_attempts >= 6 else 0)
        if wait > 0:
            self._locked_until_epoch = time.time() + wait
        self._save()

    def record_success(self) -> None:
        self.failed_attempts = 0
        self._locked_until_epoch = 0.0
        self._save()