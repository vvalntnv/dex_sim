import { Bot } from "../abstract/Bot";

export class AggressiveBot extends Bot {
  
  async onTick(): Promise<void> {
    // TODO: Implement aggressive trading strategy
    // e.g., Randomly make large swaps, ignore small price movements
    console.log("AggressiveBot: Ticking...");
  }

  async onNews(news: any): Promise<void> {
    // TODO: React to news
    // e.g., If sentiment > 0.5, buy heavily. If sentiment < -0.8, sell everything.
    console.log("AggressiveBot: Received news", news);
  }
}
