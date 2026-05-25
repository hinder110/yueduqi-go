use crate::Book;
use rusqlite::{Connection, params};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct HistoryEntry {
    pub book_id: String,
    pub book_title: String,
    pub chapter_title: String,
    pub updated_at: String,
}

/// Initialize database and create tables
pub fn init_db() -> Result<Connection, String> {
    // Place db outside src-tauri/ to avoid Tauri file-watch rebuild loop
    let db_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .join("yueduqi.db");
    let conn = Connection::open(&db_path).map_err(|e| format!("数据库打开失败: {}", e))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("PRAGMA设置失败: {}", e))?;
    Ok(conn)
}

/// Run schema migrations
pub fn migrate(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS bookshelf (
            book_id     TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            author      TEXT DEFAULT '',
            cover       TEXT DEFAULT '',
            intro       TEXT DEFAULT '',
            kind        TEXT DEFAULT '',
            last_chapter TEXT DEFAULT '',
            word_count  TEXT DEFAULT '',
            source_key  TEXT DEFAULT '',
            source      TEXT DEFAULT '',
            tab         TEXT DEFAULT '',
            created_at  TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS history (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id       TEXT NOT NULL,
            book_title    TEXT DEFAULT '',
            chapter_title TEXT DEFAULT '',
            updated_at    TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_history_book ON history(book_id);
        CREATE INDEX IF NOT EXISTS idx_history_time ON history(updated_at DESC);",
    )
    .map_err(|e| format!("数据库迁移失败: {}", e))
}

/// Add a book to the bookshelf
pub fn add_book(conn: &Connection, book: &Book) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO bookshelf
            (book_id, title, author, cover, intro, kind, last_chapter, word_count, source_key, source, tab)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            book.book_id,
            book.title,
            book.author,
            book.cover,
            book.intro,
            book.kind,
            book.last_chapter,
            book.word_count,
            book.source_key,
            book.source,
            book.tab,
        ],
    )
    .map_err(|e| format!("加入书架失败: {}", e))?;
    Ok(())
}

/// Remove a book from the bookshelf
pub fn remove_book(conn: &Connection, book_id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM bookshelf WHERE book_id = ?1", params![book_id])
        .map_err(|e| format!("移出书架失败: {}", e))?;
    Ok(())
}

/// Get all books in the bookshelf, newest first
pub fn get_bookshelf(conn: &Connection) -> Result<Vec<Book>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT book_id, title, author, cover, intro, kind, last_chapter, word_count, source_key, source, tab
             FROM bookshelf ORDER BY created_at DESC",
        )
        .map_err(|e| format!("查询书架失败: {}", e))?;

    let books = stmt
        .query_map([], |row| {
            Ok(Book {
                book_id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                cover: row.get(3)?,
                intro: row.get(4)?,
                kind: row.get(5)?,
                last_chapter: row.get(6)?,
                word_count: row.get(7)?,
                source_key: row.get(8)?,
                source: row.get(9)?,
                tab: row.get(10)?,
            })
        })
        .map_err(|e| format!("书架查询失败: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(books)
}

/// Add a reading history entry
pub fn add_history(conn: &Connection, book_id: &str, chapter_title: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO history (book_id, chapter_title) VALUES (?1, ?2)",
        params![book_id, chapter_title],
    )
    .map_err(|e| format!("添加历史失败: {}", e))?;
    Ok(())
}

/// Get reading history, most recent first
pub fn get_history(conn: &Connection) -> Result<Vec<HistoryEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT h.book_id, COALESCE(b.title, h.book_title), h.chapter_title, h.updated_at
             FROM history h
             LEFT JOIN bookshelf b ON h.book_id = b.book_id
             ORDER BY h.updated_at DESC
             LIMIT 100",
        )
        .map_err(|e| format!("查询历史失败: {}", e))?;

    let entries = stmt
        .query_map([], |row| {
            Ok(HistoryEntry {
                book_id: row.get(0)?,
                book_title: row.get(1)?,
                chapter_title: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("历史查询失败: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entries)
}
