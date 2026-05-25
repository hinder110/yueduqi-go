use crate::rule_engine;
use crate::source_manager::ParsedSource;
use crate::{Book, Chapter, ChapterContent, SearchResult};
use std::collections::HashSet;
use std::time::Duration;

use std::sync::LazyLock;

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(Duration::from_secs(15))
        .build()
        .expect("Failed to create HTTP client")
});

/// Search books across all enabled sources with priority/fallback logic
pub async fn search(
    keyword: &str,
    sources: &[ParsedSource],
) -> Result<Vec<SearchResult>, String> {
    // Split into priority (first 3) and extended sources
    let enabled: Vec<&ParsedSource> = sources.iter().filter(|s| s.enabled).collect();
    let (priority, extended) = if enabled.len() > 3 {
        enabled.split_at(3)
    } else {
        (enabled.as_slice(), [].as_slice())
    };

    let mut results: Vec<SearchResult> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    // Priority sources: 5s timeout each
    for source in priority {
        match search_source(keyword, source, 5).await {
            Ok(books) => {
                let deduped: Vec<Book> = books
                    .into_iter()
                    .filter(|b| {
                        let key = format!("{}-{}", b.title, b.author);
                        seen.insert(key)
                    })
                    .collect();
                results.push(SearchResult {
                    books: deduped,
                    source: source.name.clone(),
                    error: String::new(),
                });
            }
            Err(e) => {
                results.push(SearchResult {
                    books: vec![],
                    source: source.name.clone(),
                    error: e,
                });
            }
        }
    }

    // If we have enough results, return
    let total: usize = results.iter().map(|r| r.books.len()).sum();
    if total >= 5 {
        return Ok(results);
    }

    // Extended sources: 6s timeout each
    for source in extended {
        match search_source(keyword, source, 6).await {
            Ok(books) => {
                let deduped: Vec<Book> = books
                    .into_iter()
                    .filter(|b| {
                        let key = format!("{}-{}", b.title, b.author);
                        seen.insert(key)
                    })
                    .collect();
                results.push(SearchResult {
                    books: deduped,
                    source: source.name.clone(),
                    error: String::new(),
                });
            }
            Err(e) => {
                results.push(SearchResult {
                    books: vec![],
                    source: source.name.clone(),
                    error: e,
                });
            }
        }
    }

    Ok(results)
}

async fn search_source(
    keyword: &str,
    source: &ParsedSource,
    timeout_secs: u64,
) -> Result<Vec<Book>, String> {
    if source.search_url.is_empty() {
        return Err("no search URL configured".into());
    }

    let url = source
        .search_url
        .replace("{keyword}", &urlencoding(keyword));

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("client build error: {}", e))?;

    let resp = client.get(&url).send().await.map_err(|e| {
        log::warn!("HTTP error [{}] {}: {}", source.name, url, e);
        format!("请求失败: {}", e)
    })?;

    let body = decode_response(resp).await?;

    // Extract book list using rule engine
    let book_titles = rule_engine::extract_all(&body, &source.book_list_rule)
        .unwrap_or_default();
    let book_urls = rule_engine::extract_all(&body, &source.book_url_rule)
        .unwrap_or_default();

    let count = book_titles.len().min(book_urls.len());
    let books: Vec<Book> = (0..count)
        .map(|i| {
            let href = book_urls.get(i).cloned().unwrap_or_default();
            let abs_url = rule_engine::normalize_url(&source.base_url, &href);
            Book {
                title: book_titles.get(i).cloned().unwrap_or_default(),
                author: String::new(),
                cover: String::new(),
                intro: String::new(),
                kind: source.group.clone(),
                last_chapter: String::new(),
                word_count: String::new(),
                book_id: abs_url.clone(),
                source_key: source.key.clone(),
                source: source.name.clone(),
                tab: source.group.clone(),
            }
        })
        .collect();

    Ok(books)
}

/// Get chapter list for a book
pub async fn get_chapters(
    book_id: &str,
    source_key: &str,
    sources: &[ParsedSource],
) -> Result<Vec<Chapter>, String> {
    let source = sources
        .iter()
        .find(|s| s.key == source_key)
        .ok_or_else(|| format!("书源未找到: {}", source_key))?;

    let resp = CLIENT.get(book_id).send().await.map_err(|e| {
        format!("请求章节列表失败: {}", e)
    })?;

    let body = decode_response(resp).await?;

    let titles = rule_engine::extract_all(&body, &source.chapter_list_rule)
        .unwrap_or_default();
    let urls = rule_engine::extract_all(&body, &source.chapter_url_rule)
        .unwrap_or_default();

    let count = titles.len().min(urls.len());
    let chapters: Vec<Chapter> = (0..count)
        .map(|i| {
            let href = urls.get(i).cloned().unwrap_or_default();
            let abs_url = rule_engine::normalize_url(&source.base_url, &href);
            Chapter {
                title: titles.get(i).cloned().unwrap_or_default(),
                item_id: abs_url,
            }
        })
        .collect();

    Ok(chapters)
}

/// Get chapter content
pub async fn get_content(
    _book_id: &str,
    item_id: &str,
    source_key: &str,
    sources: &[ParsedSource],
) -> Result<ChapterContent, String> {
    let source = sources
        .iter()
        .find(|s| s.key == source_key)
        .ok_or_else(|| format!("书源未找到: {}", source_key))?;

    let resp = CLIENT.get(item_id).send().await.map_err(|e| {
        format!("请求章节正文失败: {}", e)
    })?;

    let body = decode_response(resp).await?;

    let title = rule_engine::extract(&body, "h1@text").unwrap_or_else(|_| String::new());
    let content = rule_engine::extract(&body, &source.content_rule)
        .unwrap_or_else(|_| "正文加载失败".into());

    // Apply regex cleanups
    let content = rule_engine::apply_regex_replacements(&content, &source.regex_replace);

    Ok(ChapterContent { title, content })
}

/// Decode response body, handling GBK/UTF-8 encoding
async fn decode_response(resp: reqwest::Response) -> Result<String, String> {
    let bytes = resp.bytes().await.map_err(|e| format!("读取响应失败: {}", e))?;

    // Try UTF-8 first, then GBK
    if let Ok(s) = String::from_utf8(bytes.to_vec()) {
        return Ok(s);
    }

    // Try GBK/GB18030 decoding
    encoding_rs::Encoding::for_label("gbk".as_bytes())
        .or_else(|| encoding_rs::Encoding::for_label("gb18030".as_bytes()))
        .map(|enc| {
            let (cow, _, _) = enc.decode(&bytes);
            cow.into_owned()
        })
        .ok_or_else(|| "无法解码响应内容".into())
}

/// URL-encode a keyword for Chinese text
fn urlencoding(s: &str) -> String {
    let mut result = String::new();
    for byte in s.as_bytes() {
        match *byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9'
            | b'-' | b'_' | b'.' | b'~' => result.push(*byte as char),
            b' ' => result.push_str("%20"),
            _ => {
                result.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    result
}
