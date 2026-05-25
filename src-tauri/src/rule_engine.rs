use scraper::{Html, Selector};

/// Parse a CSS chain rule and extract text/attribute from HTML.
///
/// Rule format: `selector1@element@nth@field`
/// - `selector`: CSS class/id/tag chain like `.list li a`
/// - `element`: which child element to descend into (index or `!N` to skip)
/// - `nth`: which result to pick (0-indexed)
/// - `field`: `text`, `html`, `href`, `src`, `alt`, `attr:xxx`
///
/// Can also be just a plain CSS selector with `@text` suffix.
pub fn extract(html: &str, rule: &str) -> Result<String, String> {
    if rule.is_empty() {
        return Err("empty rule".into());
    }

    let document = Html::parse_document(html);

    // Split rule by @ for chain parsing
    let parts: Vec<&str> = rule.split('@').collect();
    if parts.is_empty() {
        return Err("invalid rule format".into());
    }

    // Last part is the field type
    let field = parts.last().unwrap_or(&"text");
    let chain = &parts[..parts.len() - 1];

    // Build CSS selector from chain parts
    let selector_str = build_selector(chain);

    let selector = Selector::parse(&selector_str)
        .map_err(|e| format!("CSS selector parse error: {:?}", e))?;

    // Get the nth matching element
    let elements: Vec<_> = document.select(&selector).collect();

    if elements.is_empty() {
        return Err(format!("no elements match selector: {}", selector_str));
    }

    // Use the first match by default (nth handling could be added)
    let el = elements[0];

    let result = match *field {
        "text" => el.text().collect::<Vec<_>>().join("").trim().to_string(),
        "html" => el.inner_html(),
        "href" => el.value().attr("href").unwrap_or("").to_string(),
        "src" => el.value().attr("src").unwrap_or("").to_string(),
        "alt" => el.value().attr("alt").unwrap_or("").to_string(),
        attr if attr.starts_with("attr:") => {
            let attr_name = attr.strip_prefix("attr:").unwrap_or("");
            el.value().attr(attr_name).unwrap_or("").to_string()
        }
        _ => el.text().collect::<Vec<_>>().join("").trim().to_string(),
    };

    Ok(result)
}

/// Extract multiple matches from a rule (for lists)
pub fn extract_all(html: &str, rule: &str) -> Result<Vec<String>, String> {
    if rule.is_empty() {
        return Ok(Vec::new());
    }

    let document = Html::parse_document(html);
    let parts: Vec<&str> = rule.split('@').collect();
    if parts.is_empty() {
        return Err("invalid rule format".into());
    }

    let field = parts.last().unwrap_or(&"text");
    let chain = &parts[..parts.len() - 1];
    let selector_str = build_selector(chain);

    let selector = Selector::parse(&selector_str)
        .map_err(|e| format!("CSS selector parse error: {:?}", e))?;

    let results: Vec<String> = document
        .select(&selector)
        .map(|el| match *field {
            "text" => el.text().collect::<Vec<_>>().join("").trim().to_string(),
            "html" => el.inner_html(),
            "href" => el.value().attr("href").unwrap_or("").to_string(),
            "src" => el.value().attr("src").unwrap_or("").to_string(),
            "alt" => el.value().attr("alt").unwrap_or("").to_string(),
            attr if attr.starts_with("attr:") => {
                let attr_name = attr.strip_prefix("attr:").unwrap_or("");
                el.value().attr(attr_name).unwrap_or("").to_string()
            }
            _ => el.text().collect::<Vec<_>>().join("").trim().to_string(),
        })
        .filter(|s| !s.is_empty())
        .collect();

    Ok(results)
}

/// Build CSS selector from chain parts, joining with space
fn build_selector(chain: &[&str]) -> String {
    chain.join(" ")
}

/// Apply regex replacements to extracted text
pub fn apply_regex_replacements(
    text: &str,
    replacements: &[(String, String)],
) -> String {
    let mut result = text.to_string();
    for (pattern, replacement) in replacements {
        if let Ok(re) = regex::Regex::new(pattern) {
            result = re.replace_all(&result, replacement.as_str()).to_string();
        }
    }
    result
}

/// Normalize a relative URL to absolute using base URL
pub fn normalize_url(base: &str, href: &str) -> String {
    if href.starts_with("http://") || href.starts_with("https://") {
        return href.to_string();
    }

    if href.starts_with("//") {
        let proto = if base.starts_with("https://") { "https:" } else { "http:" };
        return format!("{}{}", proto, href);
    }

    // Extract origin (scheme + host) and path from base
    let after_scheme = base.find("://").map(|i| i + 3).unwrap_or(0);
    let path_start = base[after_scheme..].find('/').map(|i| after_scheme + i);
    let origin = match path_start {
        Some(pos) => &base[..pos],
        None => base,
    };
    let base_path = match path_start {
        Some(pos) => &base[pos..],
        None => "/",
    };

    if href.starts_with('/') {
        // Absolute path: replace base path entirely
        return format!("{}{}", origin, href);
    }

    // Relative path: resolve against base path's directory
    let base_ends_with_slash = base.ends_with('/');
    let dir = if base_ends_with_slash {
        base_path // e.g. /books/ → keep as-is
    } else {
        // Strip last segment: /books → /
        match base_path.rfind('/') {
            Some(i) if i == 0 => "/",     // root path
            Some(i) => &base_path[..=i],   // /dir/file → /dir/
            None => "/",
        }
    };
    let resolved = if dir.ends_with('/') {
        format!("{}{}", dir, href)
    } else {
        format!("{}/{}", dir, href)
    };
    format!("{}{}", origin, resolved)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_text() {
        let html = r#"<html><body><div class="title">Hello World</div></body></html>"#;
        let result = extract(html, ".title@text").unwrap();
        assert_eq!(result, "Hello World");
    }

    #[test]
    fn test_extract_href() {
        let html = r#"<a class="link" href="/book/123">Link</a>"#;
        let result = extract(html, ".link@href").unwrap();
        assert_eq!(result, "/book/123");
    }

    #[test]
    fn test_normalize_url() {
        assert_eq!(
            normalize_url("https://example.com/books", "/detail/123"),
            "https://example.com/detail/123"
        );
        assert_eq!(
            normalize_url("https://example.com/books/", "detail/123"),
            "https://example.com/books/detail/123"
        );
    }
}
