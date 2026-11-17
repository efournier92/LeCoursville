export const DATA_REQUEST_STATUSES = ['open', 'closed'] as const;
export type DataRequestStatus = typeof DATA_REQUEST_STATUSES[number];

export interface DataRequest {
  id: string;
  contact: string;
  description: string;
  status: DataRequestStatus;
  createdAt: number;
  requesterUid?: string | null;
  updatedAt?: number;
  updatedBy?: string;
  throttleKey?: string;
}

export interface DataRequestInput {
  contact: string;
  description: string;
}

const MAX_CONTACT = 200;
const MAX_DESCRIPTION = 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same shape the requester writes; id and status are server-side decisions. */
export function buildDataRequest(
  id: string,
  input: DataRequestInput,
  now: number,
  requesterUid?: string | null,
): DataRequest {
  return {
    id,
    contact: input.contact.trim().slice(0, MAX_CONTACT),
    description: input.description.trim().slice(0, MAX_DESCRIPTION),
    status: 'open',
    createdAt: now,
    ...(requesterUid ? { requesterUid } : {}),
  };
}

/** Returns an inline error per field, mirroring the form's own validation. */
export function validateDataRequest(input: DataRequestInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const contact = input.contact.trim();
  if (!contact) {
    errors['contact'] = 'Enter your email address.';
  } else if (contact.length > MAX_CONTACT) {
    errors['contact'] = `Keep the email under ${MAX_CONTACT} characters.`;
  } else if (!EMAIL_PATTERN.test(contact)) {
    errors['contact'] = 'Enter a valid email address.';
  }
  const description = input.description.trim();
  if (!description) {
    errors['description'] = 'Tell us what this is about.';
  } else if (description.length > MAX_DESCRIPTION) {
    errors['description'] = `Keep the description under ${MAX_DESCRIPTION} characters.`;
  }
  return errors;
}
