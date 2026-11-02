export interface Family {
  id: string;
  name: string;
  hexColor: string;  // stored hex color string (DB data)
  sortOrder: string;  // e.g. 'A', 'B', 'C' - used for alphabetical sorting
  createdAt: number;
  updatedAt: number;
}