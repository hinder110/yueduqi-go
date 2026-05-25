use crate::BookSourceRaw;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Parsed book source ready for use by the rule engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedSource {
    pub key: String,
    pub name: String,
    pub group: String,
    pub base_url: String,
    pub enabled: bool,
    pub search_url: String,
    pub book_list_rule: String,
    pub book_url_rule: String,
    pub book_name_rule: String,
    pub book_author_rule: String,
    pub book_cover_rule: String,
    pub book_intro_rule: String,
    pub chapter_list_rule: String,
    pub chapter_url_rule: String,
    pub content_rule: String,
    pub regex_replace: Vec<(String, String)>,
    pub headers: HashMap<String, String>,
}

/// Direct format for simple CSS-based sources (test_sources.json)
#[derive(Debug, Deserialize)]
struct DirectSource {
    name: String,
    base_url: String,
    group: String,
    enabled: bool,
    search_url: String,
    #[serde(default)]
    book_list_rule: String,
    #[serde(default)]
    book_url_rule: String,
    #[serde(default)]
    book_name_rule: String,
    #[serde(default)]
    book_author_rule: String,
    #[serde(default)]
    book_cover_rule: String,
    #[serde(default)]
    book_intro_rule: String,
    #[serde(default)]
    chapter_list_rule: String,
    #[serde(default)]
    chapter_url_rule: String,
    #[serde(default)]
    content_rule: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SourceInfo {
    pub key: String,
    pub name: String,
    pub group: String,
    pub enabled: bool,
}

/// Load book sources from legado format (shuyuan_7208.json)
pub fn load_sources() -> Result<Vec<BookSourceRaw>, String> {
    let project_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent()
        .unwrap_or(std::path::Path::new("."));

    let paths = [
        project_root.join("shuyuan_7208.json"),
        std::path::Path::new("shuyuan_7208.json").to_path_buf(),
        std::path::Path::new("../shuyuan_7208.json").to_path_buf(),
        std::path::Path::new("../../shuyuan_7208.json").to_path_buf(),
    ];

    let content = paths
        .iter()
        .find_map(|p| std::fs::read_to_string(p).ok())
        .ok_or_else(|| "无法找到 shuyuan_7208.json 书源文件".to_string())?;

    serde_json::from_str::<Vec<BookSourceRaw>>(&content)
        .map_err(|e| format!("书源JSON解析失败: {}", e))
}

/// Load direct CSS-based sources from test_sources.json
pub fn load_direct_sources() -> Result<Vec<ParsedSource>, String> {
    let project_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent()
        .unwrap_or(std::path::Path::new("."));

    let paths = [
        project_root.join("test_sources.json"),
        std::path::Path::new("test_sources.json").to_path_buf(),
        std::path::Path::new("../test_sources.json").to_path_buf(),
        std::path::Path::new("../../test_sources.json").to_path_buf(),
    ];

    let content = match paths.iter().find_map(|p| std::fs::read_to_string(p).ok()) {
        Some(c) => c,
        None => return Ok(Vec::new()),
    };

    let raw: Vec<DirectSource> = serde_json::from_str(&content)
        .map_err(|e| format!("测试书源JSON解析失败: {}", e))?;

    Ok(raw.into_iter().map(|s| ParsedSource {
        key: s.name.clone(),
        name: s.name,
        group: s.group,
        base_url: s.base_url,
        enabled: s.enabled,
        search_url: s.search_url,
        book_list_rule: s.book_list_rule,
        book_url_rule: s.book_url_rule,
        book_name_rule: s.book_name_rule,
        book_author_rule: s.book_author_rule,
        book_cover_rule: s.book_cover_rule,
        book_intro_rule: s.book_intro_rule,
        chapter_list_rule: s.chapter_list_rule,
        chapter_url_rule: s.chapter_url_rule,
        content_rule: s.content_rule,
        regex_replace: Vec::new(),
        headers: HashMap::new(),
    }).collect())
}

/// Parse a raw Legado-format source into internal representation
pub fn parse_source(raw: BookSourceRaw) -> Option<ParsedSource> {
    let rules_to_str = |v: &serde_json::Value| -> String {
        match v {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Object(o) => {
                serde_json::to_string(o).unwrap_or_default()
            }
            _ => String::new(),
        }
    };

    let search_rule = rules_to_str(&raw.rule_search);
    let book_info_rule = rules_to_str(&raw.rule_book_info);
    let toc_rule = rules_to_str(&raw.rule_toc);
    let content_rule = rules_to_str(&raw.rule_content);

    if search_rule.is_empty() && book_info_rule.is_empty()
        && toc_rule.is_empty() && content_rule.is_empty()
    {
        return None;
    }

    let key = raw.name.clone();

    Some(ParsedSource {
        key,
        name: raw.name,
        group: raw.group,
        base_url: raw.url,
        enabled: raw.enabled,
        search_url: extract_field(&search_rule, "searchUrl"),
        book_list_rule: extract_field(&search_rule, "bookList"),
        book_url_rule: extract_field(&search_rule, "bookUrl"),
        book_name_rule: extract_field(&book_info_rule, "name"),
        book_author_rule: extract_field(&book_info_rule, "author"),
        book_cover_rule: extract_field(&book_info_rule, "coverUrl"),
        book_intro_rule: extract_field(&book_info_rule, "intro"),
        chapter_list_rule: extract_field(&toc_rule, "chapterList"),
        chapter_url_rule: extract_field(&toc_rule, "chapterUrl"),
        content_rule: extract_field(&content_rule, "content"),
        regex_replace: Vec::new(),
        headers: raw.headers,
    })
}

fn extract_field(json_str: &str, field: &str) -> String {
    if let Ok(obj) = serde_json::from_str::<HashMap<String, serde_json::Value>>(json_str) {
        obj.get(field)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    } else {
        String::new()
    }
}
