export interface Song {
  id: string;
  title: string;
  body: string;
  source: string | null;
  musicalKey: string | null;
  leaderIds: string[];
  createdAt: number;
  updatedAt: number;
}
