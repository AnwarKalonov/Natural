export interface HistoryItem {
  id: string;
  prompt: string;
  timestamp: number;
}

export interface ExamplePrompt {
  title: string;
  description: string;
  code: string;
}