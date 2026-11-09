import { buildDataRequest, validateDataRequest } from './data-request';

describe('data request contract', () => {
  const input = {
    kind: 'removal' as const,
    dataClass: 'people' as const,
    contact: ' person@example.com ',
    description: ' Please remove my listing. ',
  };

  it('builds an open request with a trimmed contact and no audit fields', () => {
    const record = buildDataRequest('req-1', input, 1234, 'uid-1');
    expect(record).toEqual({
      id: 'req-1',
      kind: 'removal',
      dataClass: 'people',
      contact: 'person@example.com',
      description: 'Please remove my listing.',
      status: 'open',
      createdAt: 1234,
      requesterUid: 'uid-1',
    });
  });

  it('omits the requester uid for a signed-out request', () => {
    const record = buildDataRequest('req-2', input, 1);
    expect(record.requesterUid).toBeUndefined();
  });

  it('rejects missing contact and unknown classes', () => {
    const errors = validateDataRequest({ ...input, contact: '  ', dataClass: 'secrets' as never });
    expect(errors['contact']).toContain('email');
    expect(errors['dataClass']).toContain('Choose');
  });

  it('caps the free-text fields', () => {
    const errors = validateDataRequest({
      ...input,
      contact: 'a'.repeat(201),
      description: 'b'.repeat(1001),
    });
    expect(errors['contact']).toBeDefined();
    expect(errors['description']).toBeDefined();
  });
});
