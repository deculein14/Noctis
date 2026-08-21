import base64
import json
import os
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