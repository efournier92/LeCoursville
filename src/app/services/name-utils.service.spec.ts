import { TestBed } from '@angular/core/testing';
import { NameUtilsService } from './name-utils.service';

describe('NameUtilsService', () => {
  let service: NameUtilsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NameUtilsService] });
    service = TestBed.inject(NameUtilsService);
  });

  it('returns one name when there is no spouse', () => {
    const result = service.formatCoupleNames(
      { firstPreferred: 'Ada', last: 'Lovelace' },
      null,
    );

    expect(result).toEqual({ first: 'Ada Lovelace', second: '' });
  });

  it('returns A & B Last when both share a last name', () => {
    const result = service.formatCoupleNames(
      { firstPreferred: 'John', last: 'Smith' },
      { firstPreferred: 'Mary', last: 'Smith' },
    );

    expect(result).toEqual({ first: 'John & Mary Smith', second: '' });
  });

  it('returns both full names when last names differ', () => {
    const result = service.formatCoupleNames(
      { firstGiven: 'John', last: 'Smith' },
      { firstGiven: 'Mary', last: 'Jones' },
    );

    expect(result).toEqual({ first: 'John Smith', second: 'Mary Jones' });
  });

  it('getCoupleNames returns null when the person has no name', () => {
    expect(service.getCoupleNames({} as any, null)).toBeNull();
  });

  it('getCoupleNames splits a shared last name into sharedLastName', () => {
    const result = service.getCoupleNames(
      { name: { firstPreferred: 'John', last: 'Smith' } },
      { name: { firstPreferred: 'Mary', last: 'Smith' } },
    );

    expect(result).toEqual({ first: 'John', second: 'Mary', sharedLastName: 'Smith' });
  });
});
