/** Industry news on Today (domain/design/industry-news.ts), as the screen asks for it. */
import type { NewsItem } from "@/lib/domain/design/industry-news";
import { ask } from "./crm";

export interface NewsAnswer {
  items: NewsItem[];
  readAt: string | null;
  reading: boolean;
  configured: boolean;
  missed: boolean;
}

export const loadNews = () => ask<NewsAnswer>("/api/design/news");
