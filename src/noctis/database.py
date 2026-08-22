import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from noctis import security


def get_connection(email):
    db_path = Path(security.get_database_filename(email))
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database(email):
    connection = get_connection(email)
    cursor = connection.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            username TEXT,
            encrypted_password BLOB,
            url TEXT,
            category TEXT,
            is_favorite INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    connection.commit()
    connection.close()


def add_entry(email, title, username=None, encrypted_password=None, url=None, category=None):
    connection = get_connection(email)
    cursor = connection.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        INSERT INTO entries (title, username, encrypted_password, url, category, is_favorite, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    """, (title, username, encrypted_password, url, category, now, now))
    connection.commit()
    connection.close()


def get_all_entries(email):
    connection = get_connection(email)
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM entries ORDER BY title")
    rows = cursor.fetchall()
    connection.close()
    return rows


def update_entry(email, entry_id, title, username=None, encrypted_password=None, url=None, category=None):
    connection = get_connection(email)
    cursor = connection.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        UPDATE entries
        SET title = ?, username = ?, encrypted_password = ?, url = ?, category = ?, updated_at = ?
        WHERE id = ?
    """, (title, username, encrypted_password, url, category, now, entry_id))
    connection.commit()
    connection.close()


def delete_entry(email, entry_id):
    connection = get_connection(email)
    cursor = connection.cursor()
    cursor.execute("DELETE FROM entries WHERE id = ?", (entry_id,))
    connection.commit()
    connection.close()


def get_all_categories(email):
    connection = get_connection(email)
    cursor = connection.cursor()
    cursor.execute("SELECT DISTINCT category FROM entries WHERE category IS NOT NULL AND category != '' ORDER BY category")
    rows = cursor.fetchall()
    connection.close()
    return [row["category"] for row in rows]


def toggle_favorite(email, entry_id, is_favorite):
    connection = get_connection(email)
    cursor = connection.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        UPDATE entries SET is_favorite = ?, updated_at = ?
        WHERE id = ?
    """, (1 if is_favorite else 0, now, entry_id))
    connection.commit()
    connection.close()