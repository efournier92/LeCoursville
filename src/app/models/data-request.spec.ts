import { buildDataRequest, validateDataRequest } from './data-request';

describe('data request contract', () => {
  const input = {
    contact: ' person@example.com ',
    description: ' Please fix my listing. ',
  };

  it('builds an open request with trimmed fields', () => {
    const record = buildDataRequest('req-1', input, 1234, 'uid-1');
    expect(record).toEqual({
      id: 'req-1',
      contact: 'person@example.com',
      description: 'Please fix my listing.',
      status: 'open',
      createdAt: 1234,
      requesterUid: 'uid-1',
    });
  });

  it('omits the requester uid for a signed-out request', () => {
    const record = buildDataRequest('req-2', input, 1);
    expect(record.requesterUid).toBeUndefined();
  });

  it('rejects a missing contact', () => {
    const errors = validateDataRequest({ ...input, contact: '  ' });
    expect(errors['contact']).toBe('Enter your email address.');
  });

  it('rejects an invalid email', () => {
    const errors = validateDataRequest({ ...input, contact: 'not an email' });
    expect(errors['contact']).toBe('Enter a valid email address.');
  });

  it('rejects an empty description', () => {
    const errors = validateDataRequest({ ...input, description: '   ' });
    expect(errors['description']).toBe('Tell us what this is about.');
  });

  it('caps both fields', () => {
    const errors = validateDataRequest({
      ...input,
      contact: 'a'.repeat(201),
      description: 'b'.repeat(1001),
    });
    expect(errors['contact']).toBeDefined();
    expect(errors['description']).toBeDefined();
  });
});
