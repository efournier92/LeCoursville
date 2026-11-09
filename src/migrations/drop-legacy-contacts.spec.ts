// @ts-ignore -- the migration runner is plain ESM with no type declarations.
import {
  contactsWriteRule,
  parseArgs,
  summarizeContacts,
} from '../../scripts/migrations/drop-legacy-contacts.mjs';

describe('drop-legacy-contacts migration', () => {
  it('requires an explicit project id', () => {
    expect(() => parseArgs([])).toThrow(/--project/);
    expect(parseArgs(['--project', 'lecoursville-dev']).project).toBe('lecoursville-dev');
  });

  it('defaults to a dry run and only deletes with --confirm', () => {
    expect(parseArgs(['--project', 'lecoursville-dev']).confirm).toBe(false);
    expect(parseArgs(['--project', 'lecoursville-dev', '--confirm']).confirm).toBe(true);
  });

  it('rejects unknown arguments', () => {
    expect(() => parseArgs(['--project', 'lecoursville-dev', '--force'])).toThrow(/unknown argument/);
  });

  it('accepts an optional rules path', () => {
    expect(
      parseArgs(['--project', 'lecoursville-dev', '--rules', 'other.rules.json']).rulesPath,
    ).toBe('other.rules.json');
    expect(() => parseArgs(['--project', 'lecoursville-dev', '--rules'])).toThrow(/--rules/);
  });

  it('detects a write rule on the contacts node', () => {
    const rules = {
      rules: {
        contacts: { '.read': 'auth != null', '.write': 'auth != null' },
      },
    };
    expect(contactsWriteRule(rules)).toBe('auth != null');
  });

  it('returns null when the contacts write rule is absent', () => {
    expect(contactsWriteRule({ rules: {} })).toBeNull();
    expect(contactsWriteRule({ rules: { contacts: { '.read': 'auth != null' } } })).toBeNull();
    expect(contactsWriteRule({ rules: { contacts: null } })).toBeNull();
  });

  it('reports zero records for an absent or empty node', () => {
    expect(summarizeContacts(null)).toEqual({ records: 0, bytes: 4 });
    expect(summarizeContacts({})).toEqual({ records: 0, bytes: 2 });
  });

  it('counts top-level records and serialized bytes', () => {
    const node = { 'contact-1': { name: 'One' }, 'contact-2': { name: 'Two' } };
    const result = summarizeContacts(node);
    expect(result.records).toBe(2);
    expect(result.bytes).toBe(Buffer.byteLength(JSON.stringify(node)));
  });
});
