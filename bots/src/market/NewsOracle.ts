export interface NewsEvent {
  headline: string;
  sentiment: number; // -1.0 (Catastrophic) to 1.0 (Euphoric)
  impact: number; // 0.0 to 1.0 (Importance)
  category: "SECURITY" | "MACRO" | "TECH" | "COMMUNITY";
}

export class NewsOracle {
  private subscribers: ((news: NewsEvent) => void)[] = [];

  /**
   * Register a callback to receive news updates
   */
  public subscribe(callback: (news: NewsEvent) => void): void {
    this.subscribers.push(callback);
  }

  /**
   * Broadcast a news event to all subscribers
   */
  public broadcast(news: NewsEvent): void {
    console.log(
      `[NEWS] ${news.category}: ${news.headline} (Sentiment: ${news.sentiment})`,
    );
    this.subscribers.forEach((sub) => sub(news));
  }

  /**
   * Generates a random news event for simulation purposes
   */
  public generateRandomNews(): NewsEvent {
    // TODO: Implement random news generation logic
    return {
      headline: "Placeholder News",
      sentiment: 0,
      impact: 0,
      category: "MACRO",
    };
  }
}
