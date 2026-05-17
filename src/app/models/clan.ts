export interface Clan {
  id: string;
  name: string;
  hexColor: string;  // e.g. '#F44336'
  sortOrder: string;  // e.g. 'A', 'B', 'C' - used for alphabetical sorting
  createdAt: number;
  updatedAt: number;
}