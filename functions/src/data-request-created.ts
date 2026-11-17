import { getDatabase } from "firebase-admin/database";
import { onValueCreated } from "firebase-functions/v2/database";
import { REGION } from "./config";

// Collapse control characters and newlines so attacker-supplied values cannot
// forge extra lines in the plain-text alert mail.
function oneLine(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim();
}

interface DataRequest {
  id?: string;
  contact?: string;
  description?: string;
  status?: string;
  createdAt?: number;
  requesterUid?: string;
  throttleKey?: string;
}

export const onDataRequestCreated = onValueCreated(
  {
    region: REGION,
    ref: "/dataRequests/{requestId}",
  },
  async (event) => {
    const request = event.data.val() as DataRequest | null;
    if (!request) {
      return;
    }
    const requestId = event.params.requestId;

    await getDatabase()
      .ref(`adminAlerts/data-request-${requestId}`)
      .set({
        type: "data_request",
        title: "Data And Privacy Request",
        body: oneLine(request.description),
        data: {
          email: oneLine(request.contact),
          requestId,
        },
        createdAt: request.createdAt ?? Date.now(),
        createdBy: "system",
        emailStatus: "pending",
        emailError: null,
        recipientCount: 0,
      });
  }
);
