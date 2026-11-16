export const DATA_REQUEST_KINDS = ['removal', 'update', 'contact'] as const;
export type DataRequestKind = typeof DATA_REQUEST_KINDS[number];

export const DATA_REQUEST_CLASSES = [
  'people',
  'photos',
  'media',
  'calendar',
  'contacts',
  'messages',
  'other',
] as const;
export type DataRequestClass = typeof DATA_REQUEST_CLASSES[number];

export const DATA_REQUEST_STATUSES = ['open', 'resolved', 'closed'] as const;
export type DataRequestStatus = typeof DATA_REQUEST_STATUSES[number];

export interface DataRequest {
  id: string;
  kind: DataRequestKind;
  dataClass: DataRequestClass;
  contact: string;
  description: string;
  status: DataRequestStatus;
  createdAt: number;
  requesterUid?: string | null;
  updatedAt?: number;
  updatedBy?: string;
  grantedAt?: number;
  grantedBy?: string;
  throttleKey?: string;
  verifiedAt?: number;
  verifiedBy?: string;
  verificationMethod?: DataRequestVerificationMethod;
  redactedAt?: number;
  redactedBy?: string;
}

export type DataRequestVerificationMethod = 'admin_review' | 'email' | 'phone' | 'in_person';

export interface DataRequestInput {
  kind: DataRequestKind;
  dataClass: DataRequestClass;
  contact: string;
  description: string;
}

export interface DataRequestAuditEntry {
  id?: string;
  requestId: string;
  action: 'removal_granted' | 'removal_reopened' | 'removal_deleted';
  actorUid: string;
  createdAt: number;
  dataClass?: DataRequestClass;
  targetPath?: string;
  exportFile?: string;
}

const MAX_CONTACT = 200;
const MAX_DESCRIPTION = 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s().-]{7,20}$/;

export function isReachableContact(contact: string): boolean {
  const value = contact.trim();
  return EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value);
}

export const REDACTED_CONTACT = '[redacted]';

/** Same shape the requester writes; id and status are server-side decisions. */
export function buildDataRequest(
  id: string,
  input: DataRequestInput,
  now: number,
  requesterUid?: string | null,
): DataRequest {
  return {
    id,
    kind: input.kind,
    dataClass: input.dataClass,
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
  if (!DATA_REQUEST_KINDS.includes(input.kind)) {
    errors['kind'] = 'Choose a request type.';
  }
  if (!DATA_REQUEST_CLASSES.includes(input.dataClass)) {
    errors['dataClass'] = 'Choose what the request is about.';
  }
  const contact = input.contact.trim();
  if (!contact) {
    errors['contact'] = 'Enter an email address or phone number.';
  } else if (contact.length > MAX_CONTACT) {
    errors['contact'] = `Keep the contact under ${MAX_CONTACT} characters.`;
  } else if (!isReachableContact(contact)) {
    errors['contact'] = 'Enter a valid email address or phone number.';
  }
  if (input.description.trim().length > MAX_DESCRIPTION) {
    errors['description'] = `Keep the description under ${MAX_DESCRIPTION} characters.`;
  }
  return errors;
}
