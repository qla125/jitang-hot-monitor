export interface Keyword {
  id: number
  keyword: string
  description: string
  active: number
  created_at: string
}

export type TopicCategory =
  | 'model-release'
  | 'tool-update'
  | 'research'
  | 'funding'
  | 'discussion'
  | 'other'

export interface HotTopic {
  id: number
  raw_item_id: number
  title: string
  url: string
  source: string
  summary: string
  score: number
  category: TopicCategory
  published_at: string
  created_at: string
  alert_count: number
  alert_keywords?: string
  raw_content?: string
  author_name?: string
  author_followers?: number
  author_verified?: number
  like_count?: number
  comment_count?: number
  share_count?: number
  view_count?: number
  relevance_reason?: string
  authenticity?: 'real' | 'suspicious' | 'unknown'
}

export interface Alert {
  id: number
  keyword_id: number
  keyword_text: string
  hot_topic_id: number
  topic_title: string
  topic_url: string
  confidence: number
  reason: string
  is_read: number
  created_at: string
}

export interface Settings {
  email_enabled: string
  email_smtp_host: string
  email_smtp_port: string
  email_smtp_user: string
  email_smtp_pass: string
  email_to: string
  check_interval: string
  openrouter_model: string
  openrouter_api_key?: string
  twitterapi_io_key?: string
  twitterapi_io_enabled: string
  serper_api_key?: string
}

export interface SSEAlert {
  keyword: string
  title: string
  url: string
  summary: string
  confidence: number
}

export interface SearchResultItem {
  title: string
  url: string
  source: string
  points: number
  matched: boolean
  confidence: number
}

export interface KeywordSearchResult {
  keyword: string
  count: number
  items: SearchResultItem[]
}

export interface SSESearchComplete {
  results: KeywordSearchResult[]
  totalFound: number
}
