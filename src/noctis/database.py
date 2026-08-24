import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from noctis import security


def get_connection(username):
    db_path = Path(security.get_database_filename(username))
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database(username):
    connection = get_connection(username)
    cursor = connection.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            username TEXT,
            email TEXT,
            encrypted_password BLOB,
            encrypted_notes BLOB,
            url TEXT,
            category TEXT,
            is_favorite INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS custom_fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            encrypted_value BLOB,
            FOREIGN KEY (entry_id) REFERENCES entries (id) ON DELETE CASCADE
        )
    """)
    connection.commit()
    connection.close()


def add_entry(username, title, entry_username=None, email=None, encrypted_password=None,
              encrypted_notes=None, url=None, category=None):
    connection = get_connection(username)
    cursor = connection.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        INSERT INTO entries (title, username, email, encrypted_password, encrypted_notes, url, category, is_favorite, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    """, (title, entry_username, email, encrypted_password, encrypted_notes, url, category, now, now))
    connection.commit()
    new_id = cursor.lastrowid
    connection.close()
    return new_id


def get_all_entries(username):
    connection = get_connection(username)
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM entries ORDER BY title")
    rows = cursor.fetchall()
    connection.close()
    return rows


def update_entry(username, entry_id, title, entry_username=None, email=None, encrypted_password=None,
                  encrypted_notes=None, url=None, category=None):
    connection = get_connection(username)
    cursor = connection.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        UPDATE entries
        SET title = ?, username = ?, email = ?, encrypted_password = ?, encrypted_notes = ?, url = ?, category = ?, updated_at = ?
        WHERE id = ?
    """, (title, entry_username, email, encrypted_password, encrypted_notes, url, category, now, entry_id))
    connection.commit()
    connection.close()


def delete_entry(username, entry_id):
    connection = get_connection(username)
    cursor = connection.cursor()
    cursor.execute("DELETE FROM entries WHERE id = ?", (entry_id,))
    connection.commit()
    connection.close()


def get_all_categories(username):
    connection = get_connection(username)
    cursor = connection.cursor()
    cursor.execute("SELECT name FROM categories ORDER BY name")
    rows = cursor.fetchall()
    connection.close()
    return [row["name"] for row in rows]


def add_category(username, name):
    connection = get_connection(username)
    cursor = connection.cursor()
    try:
        cursor.execute("INSERT INTO categories (name) VALUES (?)", (name,))
        connection.commit()
    except sqlite3.IntegrityError:
        pass
    connection.close()


def rename_category(username, old_name, new_name):
    connection = get_connection(username)
    cursor = connection.cursor()
    try:
        cursor.execute("UPDATE categories SET name = ? WHERE name = ?", (new_name, old_name))
        cursor.execute("UPDATE entries SET category = ? WHERE category = ?", (new_name, old_name))
        connection.commit()
    except sqlite3.IntegrityError:
        pass
    connection.close()


def delete_category(username, name):
    connection = get_connection(username)
    cursor = connection.cursor()
    cursor.execute("DELETE FROM categories WHERE name = ?", (name,))
    cursor.execute("UPDATE entries SET category = NULL WHERE category = ?", (name,))
    connection.commit()
    connection.close()


def toggle_favorite(username, entry_id, is_favorite):
    connection = get_connection(username)
    cursor = connection.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        UPDATE entries SET is_favorite = ?, updated_at = ?
        WHERE id = ?
    """, (1 if is_favorite else 0, now, entry_id))
    connection.commit()
    connection.close()


def add_custom_field(username, entry_id, label, encrypted_value):
    connection = get_connection(username)
    cursor = connection.cursor()
    cursor.execute("""
        INSERT INTO custom_fields (entry_id, label, encrypted_value)
        VALUES (?, ?, ?)
    """, (entry_id, label, encrypted_value))
    connection.commit()
    connection.close()


def get_custom_fields(username, entry_id):
    connection = get_connection(username)
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM custom_fields WHERE entry_id = ? ORDER BY id", (entry_id,))
    rows = cursor.fetchall()
    connection.close()
    return rows


def delete_custom_fields_for_entry(username, entry_id):
    connection = get_connection(username)
    cursor = connection.cursor()
    cursor.execute("DELETE FROM custom_fields WHERE entry_id = ?", (entry_id,))
    connection.commit()
    connection.close()