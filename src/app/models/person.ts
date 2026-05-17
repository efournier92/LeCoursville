import { Address } from './address';

export interface PersonDate {
  year: number;
  month: number;
  day: number;
}

export interface Name {
  firstGiven: string | null;
  firstPreferred: string | null;
  maiden: string | null;
  last: string | null;
  suffix: string | null;
}

export interface Email {
  address: string;
  label: string | null;
}

export interface Phone {
  label: string;
  number: string;
}

export interface Person {
  id: string;
  name: Name;
  clanId: string | null;
  birthday: PersonDate;
  spouseId: string | null;
  anniversaryId: string | null;
  emails: Email[];
  phones: Phone[];
  addressId: string | null;
  directDescendent: boolean;
  generationNumber: number;
  parentIds: string[];
  lineage: string | null;
  isLiving: boolean;
  createdAt: number;
  updatedAt: number;
}