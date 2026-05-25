mod source_manager;
mod rule_engine;
mod generic_parser;
mod mock_source;
mod db;

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Book source as stored in shuyuan_7208.json (simplified Legado format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookSourceRaw {
    #[serde(rename = "bookSourceName")]
    pub name: String,
    #[serde(rename = "bookSourceGroup", default)]
    pub group: String,
    #[serde(rename = "bookSourceUrl", default)]
    pub url: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(rename = "ruleSearch", default)]
    pub rule_search: serde_json::Value,
    #[serde(rename = "ruleBookInfo", default)]
    pub rule_book_info: serde_json::Value,
    #[serde(rename = "ruleToc", default)]
    pub rule_toc: serde_json::Value,
    #[serde(rename = "ruleContent", default)]
    pub rule_content: serde_json::Value,
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
}

/// Unified book type returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Book {
    pub title: String,
    pub author: String,
    pub cover: String,
    pub intro: String,
    pub kind: String,
    pub last_chapter: String,
    pub word_count: String,
    pub book_id: String,
    pub source_key: String,
    pub source: String,
    pub tab: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub title: String,
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterContent {
    pub title: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub books: Vec<Book>,
    pub source: String,
    pub error: String,
}

/// App state
pub struct AppState {
    pub sources: Mutex<Vec<source_manager::ParsedSource>>,
    pub db: Mutex<rusqlite::Connection>,
}

impl AppState {
    pub fn new() -> Self {
        let conn = db::init_db().expect("Failed to initialize database");
        db::migrate(&conn).expect("Failed to run migrations");

        // Load direct CSS-based sources
        let mut parsed: Vec<source_manager::ParsedSource> =
            source_manager::load_direct_sources().unwrap_or_default();

        // Also try loading Legado-format sources
        if let Ok(raw_sources) = source_manager::load_sources() {
            let legado_parsed: Vec<_> = raw_sources
                .into_iter()
                .filter(|s| s.enabled)
                .filter_map(source_manager::parse_source)
                .collect();
            parsed.extend(legado_parsed);
        }

        log::info!("Loaded {} book sources", parsed.len());

        Self {
            sources: Mutex::new(parsed),
            db: Mutex::new(conn),
        }
    }
}

// ─── IPC Commands ───

#[tauri::command]
async fn search_books(
    keyword: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    let sources = {
        let guard = state.sources.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    // Always include mock source for offline testing
    let mut results = mock_source::mock_search(&keyword);
    // Also try network sources
    match generic_parser::search(&keyword, &sources).await {
        Ok(net_results) => results.extend(net_results),
        Err(e) => log::warn!("Network search failed: {}", e),
    }
    Ok(results)
}

#[tauri::command]
async fn get_chapters(
    book_id: String,
    source_key: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Chapter>, String> {
    if source_key == "__mock__" {
        return Ok(mock_source::mock_chapters(&book_id));
    }
    let sources = {
        let guard = state.sources.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    generic_parser::get_chapters(&book_id, &source_key, &sources).await
}

#[tauri::command]
async fn get_content(
    book_id: String,
    item_id: String,
    source_key: String,
    state: tauri::State<'_, AppState>,
) -> Result<ChapterContent, String> {
    if source_key == "__mock__" {
        return Ok(mock_source::mock_content(&item_id));
    }
    let sources = {
        let guard = state.sources.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    generic_parser::get_content(&book_id, &item_id, &source_key, &sources).await
}

#[tauri::command]
fn get_sources(state: tauri::State<'_, AppState>) -> Result<Vec<source_manager::SourceInfo>, String> {
    let sources = state.sources.lock().map_err(|e| e.to_string())?;
    Ok(sources.iter().map(|s| source_manager::SourceInfo {
        key: s.key.clone(),
        name: s.name.clone(),
        group: s.group.clone(),
        enabled: true,
    }).collect())
}

#[tauri::command]
fn toggle_source(
    key: String,
    enabled: bool,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut sources = state.sources.lock().map_err(|e| e.to_string())?;
    if let Some(s) = sources.iter_mut().find(|s| s.key == key) {
        s.enabled = enabled;
    }
    Ok(())
}

// ─── Bookshelf commands ───

#[tauri::command]
fn add_to_bookshelf(
    book: Book,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::add_book(&conn, &book)
}

#[tauri::command]
fn remove_from_bookshelf(
    book_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::remove_book(&conn, &book_id)
}

#[tauri::command]
fn get_bookshelf(state: tauri::State<'_, AppState>) -> Result<Vec<Book>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_bookshelf(&conn)
}

// ─── History commands ───

#[tauri::command]
fn add_history(
    book_id: String,
    chapter_title: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::add_history(&conn, &book_id, &chapter_title)
}

#[tauri::command]
fn get_history(state: tauri::State<'_, AppState>) -> Result<Vec<db::HistoryEntry>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_history(&conn)
}

// ─── App entry ───

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            search_books,
            get_chapters,
            get_content,
            get_sources,
            toggle_source,
            add_to_bookshelf,
            remove_from_bookshelf,
            get_bookshelf,
            add_history,
            get_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
