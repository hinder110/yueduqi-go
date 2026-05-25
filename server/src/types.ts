export interface Book {
  title: string;
  author?: string;
  cover?: string;
  intro?: string;
  kind?: string;
  lastChapter?: string;
  wordCount?: string;
  /** 书籍ID，用于请求章节目录 */
  bookId: string;
  /** 书源标识: guangyu | biquge900 */
  sourceKey: string;
  /** 光遇内部书源：番茄/七猫等；笔趣阁同 sourceKey */
  source: string;
  /** 类型：小说/听书/漫画 */
  tab: string;
}

export interface Chapter {
  title: string;
  /** 章节ID，用于请求正文 */
  itemId: string;
}

export interface ChapterContent {
  title: string;
  content: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
