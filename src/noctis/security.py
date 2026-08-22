import base64
import json
import os
import time
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

VAULT_META_FILENAME = "vault_meta.json"
VERIFICATION_STRING = b"noctis-vault-check"
KDF_ITERATIONS = 480_000


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


def vault_exists() -> bool:
    return Path(VAULT_META_FILENAME).exists()


def setup_master_password(master_password: str) -> None:
    salt = generate_salt()
    key = derive_key(master_password, salt)
    fernet = Fernet(key)
    verification_token = fernet.encrypt(VERIFICATION_STRING)

    meta = {
        "salt": base64.b64encode(salt).decode("utf-8"),
        "verification_token": verification_token.decode("utf-8"),
    }
    Path(VAULT_META_FILENAME).write_text(json.dumps(meta))


def check_master_password(master_password: str) -> bool:
    meta = json.loads(Path(VAULT_META_FILENAME).read_text())
    salt = base64.b64decode(meta["salt"])
    key = derive_key(master_password, salt)
    fernet = Fernet(key)

    try:
        decrypted = fernet.decrypt(meta["verification_token"].encode("utf-8"))
        return decrypted == VERIFICATION_STRING
    except InvalidToken:
        return False

class VaultSession:
    def __init__(self):
        self._key = None

    @property
    def is_unlocked(self) -> bool:
        return self._key is not None

    def unlock(self, master_password: str) -> bool:
        if not check_master_password(master_password):
            return False

        meta = json.loads(Path(VAULT_META_FILENAME).read_text())
        salt = base64.b64decode(meta["salt"])
        self._key = derive_key(master_password, salt)
        return True

    def lock(self) -> None:
        self._key = None

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
LOGIN_GUARD_FILENAME = "login_guard.json"


class LoginGuard:
    WAIT_TIMES = {3: 5, 4: 15, 5: 30}
    DEFAULT_WAIT = 60

    def __init__(self):
        self.failed_attempts = 0
        self._locked_until_epoch = 0.0
        self._load()

    def _load(self):
        path = Path(LOGIN_GUARD_FILENAME)
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text())
            self.failed_attempts = data.get("failed_attempts", 0)
            self._locked_until_epoch = data.get("locked_until_epoch", 0.0)
        except (json.JSONDecodeError, OSError):
            self.failed_attempts = 0
            self._locked_until_epoch = 0.0

    def _save(self):
        data = {
            "failed_attempts": self.failed_attempts,
            "locked_until_epoch": self._locked_until_epoch,
        }
        Path(LOGIN_GUARD_FILENAME).write_text(json.dumps(data))

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