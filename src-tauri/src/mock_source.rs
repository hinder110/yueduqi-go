use crate::{Book, Chapter, ChapterContent, SearchResult};

/// Built-in mock source for offline testing the full pipeline
pub fn mock_search(keyword: &str) -> Vec<SearchResult> {
    let books = vec![
        Book {
            title: format!("《{}》", keyword),
            author: "测试作者".into(),
            cover: "".into(),
            intro: "这是一本由内置Mock源生成的测试书籍，用于验证搜索→目录→阅读全流程。".into(),
            kind: "玄幻".into(),
            last_chapter: "第120章 大结局".into(),
            word_count: "120万字".into(),
            book_id: "mock-book-1".into(),
            source_key: "__mock__".into(),
            source: "Mock内置源".into(),
            tab: "测试".into(),
        },
        Book {
            title: format!("{}之逆天改命", keyword),
            author: "笔名某某".into(),
            cover: "".into(),
            intro: "第二本测试书，验证去重和多结果展示。".into(),
            kind: "都市".into(),
            last_chapter: "第85章".into(),
            word_count: "60万字".into(),
            book_id: "mock-book-2".into(),
            source_key: "__mock__".into(),
            source: "Mock内置源".into(),
            tab: "测试".into(),
        },
        Book {
            title: format!("重生之{}", keyword),
            author: "网络写手".into(),
            cover: "".into(),
            intro: "第三本测试书。".into(),
            kind: "仙侠".into(),
            last_chapter: "第200章".into(),
            word_count: "200万字".into(),
            book_id: "mock-book-3".into(),
            source_key: "__mock__".into(),
            source: "Mock内置源".into(),
            tab: "测试".into(),
        },
    ];

    vec![SearchResult {
        books,
        source: "Mock内置源".into(),
        error: String::new(),
    }]
}

pub fn mock_chapters(book_id: &str) -> Vec<Chapter> {
    let total = match book_id {
        "mock-book-1" => 120,
        "mock-book-2" => 85,
        "mock-book-3" => 200,
        _ => 50,
    };

    (1..=total)
        .map(|i| Chapter {
            title: format!("第{}章 章节标题", i),
            item_id: format!("{}-ch-{}", book_id, i),
        })
        .collect()
}

pub fn mock_content(item_id: &str) -> ChapterContent {
    let parts: Vec<&str> = item_id.rsplitn(2, "-ch-").collect();
    let ch_num: u32 = parts.first().and_then(|s| s.parse().ok()).unwrap_or(1);

    let paragraphs = vec![
        "　　天色微亮，晨雾如薄纱般笼罩着山间小路。一阵清风拂过，带来远处溪流的潺潺水声。",
        "　　「这里便是青云宗的山门了。」身旁的老者指着前方若隐若现的玉石台阶，语气中带着一丝感慨。",
        "　　少年抬头望去，只见云雾缭绕之中，一座巍峨的山门耸立于半山腰，门楣上三个大字在朝阳映照下熠熠生辉——「青云宗」。",
        "　　他深吸一口气，攥紧了手中的玉佩。这块玉佩是母亲临终前交给他的唯一遗物，也是他来此拜师的依凭。",
        "　　「走吧，考核马上开始了。」老者拍了拍他的肩膀，率先踏上石阶。",
        "　　少年默默跟上，却在心中暗道：终有一日，我要站在这修真界的顶峰，让所有人都记住我的名字。",
        "",
        "　　石阶两侧，古树参天。每隔数十步便有一座石雕灵兽蹲踞于旁，栩栩如生。",
        "　　走到一半时，少年忽然停下脚步——前方石阶上坐着一个人，挡住了去路。",
        "　　那人一身白衣，面容俊朗却带着几分桀骜不驯的笑意：「新来的？叫什么名字？」",
        "　　「与你无关。」少年平静道。",
        "　　白衣青年哈哈一笑：「有意思。能走到这里的都不是庸才，就看你能否通过入门考核了。」",
        "　　说完纵身而起，化作一道流光没入山林。",
        "　　少年目光一凛。化虹飞行——至少筑基后期的修为。",
        "",
        "　　半个时辰后，他终于抵达山顶的演武场。",
        "　　场上已聚集了数百名与他年龄相仿的少年少女，各个面带紧张之色。",
        "　　「所有参加入门考核者，速来此处领取考核令牌！」一道洪亮的声音扩散开来。",
    ];

    let content = paragraphs
        .iter()
        .map(|p| format!("<p>{}</p>", p))
        .collect::<Vec<_>>()
        .join("\n");

    let title = format!("第{}章 {}", ch_num, if ch_num == 1 { "考核开始" } else { "章节标题" });

    ChapterContent { title, content }
}
