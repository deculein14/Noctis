import base64
import json
import os
import time
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

USERS_FILENAME = "users.json"
LOGIN_GUARDS_FILENAME = "login_guards.json"
VERIFICATION_STRING = b"noctis-vault-check"
KDF_ITERATIONS = 480_000


def _normalize_email(email: str) -> str:
    return email.strip().lower()


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


def user_exists(email: str) -> bool:
    users = _load_json(USERS_FILENAME)
    return _normalize_email(email) in users


def register_user(email: str, master_password: str) -> None:
    email = _normalize_email(email)
    salt = generate_salt()
    key = derive_key(master_password, salt)
    fernet = Fernet(key)
    verification_token = fernet.encrypt(VERIFICATION_STRING)

    users = _load_json(USERS_FILENAME)
    users[email] = {
        "salt": base64.b64encode(salt).decode("utf-8"),
        "verification_token": verification_token.decode("utf-8"),
    }
    _save_json(USERS_FILENAME, users)


def check_master_password(email: str, master_password: str) -> bool:
    email = _normalize_email(email)
    users = _load_json(USERS_FILENAME)
    if email not in users:
        return False

    user_data = users[email]
    salt = base64.b64decode(user_data["salt"])
    key = derive_key(master_password, salt)
    fernet = Fernet(key)

    try:
        decrypted = fernet.decrypt(user_data["verification_token"].encode("utf-8"))
        return decrypted == VERIFICATION_STRING
    except InvalidToken:
        return False


def get_user_salt(email: str) -> bytes:
    email = _normalize_email(email)
    users = _load_json(USERS_FILENAME)
    return base64.b64decode(users[email]["salt"])


def get_database_filename(email: str) -> str:
    email = _normalize_email(email)
    safe_name = email.replace("@", "_at_").replace(".", "_")
    return f"vault_{safe_name}.db"


class VaultSession:
    def __init__(self):
        self._key = None
        self.email = None

    @property
    def is_unlocked(self) -> bool:
        return self._key is not None

    def unlock(self, email: str, master_password: str) -> bool:
        if not check_master_password(email, master_password):
            return False

        salt = get_user_salt(email)
        self._key = derive_key(master_password, salt)
        self.email = _normalize_email(email)
        return True

    def lock(self) -> None:
        self._key = None
        self.email = None

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

    def __init__(self, email: str):
        self.email = _normalize_email(email)
        self.failed_attempts = 0
        self._locked_until_epoch = 0.0
        self._load()

    def _load(self):
        all_guards = _load_json(LOGIN_GUARDS_FILENAME)
        data = all_guards.get(self.email, {})
        self.failed_attempts = data.get("failed_attempts", 0)
        self._locked_until_epoch = data.get("locked_until_epoch", 0.0)

    def _save(self):
        all_guards = _load_json(LOGIN_GUARDS_FILENAME)
        all_guards[self.email] = {
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