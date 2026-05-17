import { PersonDate } from './person';

export interface Anniversary {
  id: string;
  date: PersonDate;
  spouse1Id: string;
  spouse2Id: string;
  createdAt: number;
  updatedAt: number;
}