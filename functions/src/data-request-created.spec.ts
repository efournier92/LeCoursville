import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

import { onDataRequestCreated } from "./data-request-created";
import { fakeDb, resetFakeState } from "./test-support";

function eventFor(requestId: string, value: unknown) {
  return {
    data: {
      val: () => value,
    },
    params: { requestId },
  } as never;
}

function alerts() {
  const raw = (fakeDb.store["adminAlerts"] ?? {}) as Record<string, unknown>;
  return Object.values(raw);
}

describe("onDataRequestCreated", () => {
  beforeEach(() => {
    resetFakeState();
  });

  it("writes one alert at the fixed key for the request", async () => {
    const request = {
      id: "r1",
      contact: "person@example.com",
      description: "Please delete my data",
      status: "open",
      createdAt: 1234,
      throttleKey: "t1",
    };

    await onDataRequestCreated.run(eventFor("r1", request));

    expect(fakeDb.read("adminAlerts/data-request-r1")).toMatchObject({
      type: "data_request",
      title: "Data And Privacy Request",
      body: "Please delete my data",
      data: { email: "person@example.com", requestId: "r1" },
      createdAt: 1234,
      createdBy: "system",
      emailStatus: "pending",
    });
    expect(alerts()).toHaveLength(1);
  });

  it("overwrites instead of duplicating on a retry", async () => {
    const request = {
      id: "r1",
      contact: "person@example.com",
      description: "Please delete my data",
      status: "open",
      createdAt: 1234,
      throttleKey: "t1",
    };

    await onDataRequestCreated.run(eventFor("r1", request));
    await onDataRequestCreated.run(eventFor("r1", request));

    expect(alerts()).toHaveLength(1);
  });

  it("writes nothing when the value is null", async () => {
    await onDataRequestCreated.run(eventFor("r1", null));

    expect(fakeDb.read("adminAlerts")).toBeNull();
  });

  it("flattens newlines in the description to a single line", async () => {
    await onDataRequestCreated.run(
      eventFor("r1", {
        id: "r1",
        contact: "person@example.com",
        description: "first\nsecond",
        status: "open",
        createdAt: 1234,
        throttleKey: "t1",
      })
    );

    expect(fakeDb.read("adminAlerts/data-request-r1")).toMatchObject({
      body: "first second",
    });
  });
});
