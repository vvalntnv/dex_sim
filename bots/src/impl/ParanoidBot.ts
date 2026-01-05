import { Bot } from "../abstract/Bot";

export class ParanoidBot extends Bot {
  async onTick(): Promise<void> {
    // TODO: Implement paranoid trading strategy
    // e.g., Check volatility, if high, exit to stablecoins
    console.log("ParanoidBot: Ticking...");
  }

  async onNews(news: any): Promise<void> {
    // TODO: React to news
    // e.g., If sentiment < 0, sell immediately. Only buy if sentiment > 0.8 and delayed.
    console.log("ParanoidBot: Received news", news);
  }
}
