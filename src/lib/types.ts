export interface Event {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  location?: string;
  color: string;
  created_at: string;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  project?: string;
  created_at: string;
}

export interface Memo {
  id: string;
  title?: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  notes?: string;
  created_at: string;
}

export interface ContactInteraction {
  id: string;
  contact_id: string;
  type?: string;
  note?: string;
  date?: string;
  created_at: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ContentItem {
  id: string;
  account: "menopause" | "vibe";
  stage: "idea" | "research" | "filming" | "editing" | "uploaded";
  title: string;
  notes?: string;
  due_date?: string;
  links: string[];
  created_at: string;
  updated_at: string;
}

export interface NewsItem {
  id: string;
  category: "realestate" | "menopause";
  title: string;
  description: string;
  url: string;
  naver_url: string;
  published_at: string;
  fetched_date: string;
  created_at: string;
}

export type Page =
  | "dashboard"
  | "projects"
  | "content"
  | "calendar"
  | "todos"
  | "memos"
  | "contacts"
  | "ai"
  | "news"
  | "settings";
