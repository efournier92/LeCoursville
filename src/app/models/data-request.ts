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
}

export interface DataRequestInput {
  kind: DataRequestKind;
  dataClass: DataRequestClass;
  contact: string;
  description: string;
}

export interface DataRequestAuditEntry {
  id?: string;
  requestId: string;
  action: 'removal_granted';
  actorUid: string;
  createdAt: number;
}

const MAX_CONTACT = 200;
const MAX_DESCRIPTION = 1000;

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
  }
  if (input.description.trim().length > MAX_DESCRIPTION) {
    errors['description'] = `Keep the description under ${MAX_DESCRIPTION} characters.`;
  }
  return errors;
}
