import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NameUtilsService {
  constructor() {}

  /**
   * Formats two names for display together, omitting the last name of the second person
   * if they share the same last name.
   */
  formatCoupleNames(name1: { firstPreferred?: string | null; firstGiven?: string | null; last?: string | null }, name2: { firstPreferred?: string | null; firstGiven?: string | null; last?: string | null } | null): { first: string; second: string } {
    const first1 = name1.firstPreferred || name1.firstGiven || '';
    const last1 = name1.last || '';

    if (!name2) {
      return { first: `${first1} ${last1}`.trim(), second: '' };
    }

    const first2 = name2.firstPreferred || name2.firstGiven || '';
    const last2 = name2.last || '';

    if (last1 && last1 === last2) {
      return { first: `${first1} & ${first2} ${last1}`.trim(), second: '' };
    }

    return { first: `${first1} ${last1}`.trim(), second: `${first2} ${last2}`.trim() };
  }
}