export type TaskDifficulty = "Easy" | "Medium" | "Hard";
export type TaskSource = "general" | "partner";
export type PartnerProvider = "cpx";

export type TaskCatalogEntry = {
  id: string;
  source: TaskSource;
  provider?: PartnerProvider;
  title: string;
  category: string;
  payout: number;
  estimatedTime: string;
  difficulty: TaskDifficulty;
  summary: string;
  adminNote?: string;
};

export function getTaskById(_taskId: string): TaskCatalogEntry | null {
  return null;
}