/** Industry news on Today (domain/design/industry-news.ts), as the screen asks for it. */
import type { NewsItem } from "@/lib/domain/design/industry-news";
import type { PriceMovesNote } from "@/lib/domain/design/product-watch";
import { ask } from "./crm";

export interface NewsAnswer {
  items: NewsItem[];
  readAt: string | null;
  reading: boolean;
  configured: boolean;
  missed: boolean;
  /** The business's own supplier price moves (members who see costs only). */
  priceMoves: PriceMovesNote[];
}

export const loadNews = () => ask<NewsAnswer>("/api/design/news");
