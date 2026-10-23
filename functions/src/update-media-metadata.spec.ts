import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/database", async () => {
  const { fakeDb } = await import("./test-support");
  return { getDatabase: () => fakeDb };
});

import { updateMediaMetadata } from "./update-media-metadata";
import { fakeDb, FakeRef, resetFakeState } from "./test-support";

type RecordValue = Record<string, unknown>;

async function seedAdmin(uid = "admin-1"): Promise<void> {
  await fakeDb.ref(`users/${uid}/roles`).set({ user: true, admin: true });
}

function videoRecord(): RecordValue {
  return {
    id: "vid-1",
    title: "Old Title",
    artist: "",
    date: "2025",
    fileName: "clip.mp4",
    folderName: "",
    urls: {
      download: "https://assets.lecoursville.com/Video/clip.mp4",
      icon: "https://assets.lecoursville.com/Video/Icons/clip.jpg",
    },
    type: "video",
    format: "video/mp4",
    duration: "1:00",
    isSticky: false,
    isHidden: false,
    listing: [],
    storage: {
      managed: true,
      key: "Video/clip.mp4",
      iconKey: "Video/Icons/clip.jpg",
      bytes: 1000,
      contentType: "video/mp4",
      batchId: "batch-1",
    },
  };
}

function albumRecord(): RecordValue {
  return {
    id: "album-1",
    title: "Album",
    artist: "",
    date: "2025",
    folderName: "Le+Cours",
    urls: {
      download: "https://assets.lecoursville.com/Music/Albums/Zips/Le+Cours.zip",
      icon: "https://assets.lecoursville.com/Music/Albums/Covers/Le+Cours.jpg",
    },
    type: "audio-album",
    format: "collection/audio",
    isSticky: false,
    isHidden: false,
    listing: ["track-1", "track-2"],
    storage: {
      managed: true,
      folder: "Music/Albums/Le+Cours",
      coverKey: "Music/Albums/Covers/Le+Cours.jpg",
      zipKey: "Music/Albums/Zips/Le+Cours.zip",
      trackKeys: [
        "Music/Albums/Le+Cours/01+First.mp3",
        "Music/Albums/Le+Cours/02+Second.mp3",
      ],
      batchId: "batch-1",
    },
  };
}

function trackRecord(id: string, title: string): RecordValue {
  return {
    id,
    title,
    type: "audio-track",
    format: "audio/mpeg",
    urls: { download: `https://assets.lecoursville.com/${id}.mp3`, icon: "icon" },
    storage: { managed: true, albumId: "album-1" },
  };
}

function invoke(data: Record<string, unknown>, uid: string | null = "admin-1") {
  return updateMediaMetadata.run({
    data,
    auth: uid ? { uid, token: {} } : null,
    rawRequest: {},
  } as never);
}

function metadata(overrides: Record<string, unknown> = {}) {
  return {
    mediaId: "vid-1",
    title: "New Title",
    date: "2026",
    isSticky: true,
    isHidden: false,
    ...overrides,
  };
}

describe("updateMediaMetadata", () => {
  beforeEach(() => {
    resetFakeState();
    vi.clearAllMocks();
    process.env.EMAIL_DRY_RUN = "1";
  });

  it("rejects a non-admin caller and a missing record", async () => {
    await fakeDb.ref("users/user-1/roles").set({ user: true });
    await fakeDb.ref("media/vid-1").set(videoRecord());

    await expect(invoke(metadata(), "user-1")).rejects.toMatchObject({
      code: "permission-denied",
    });

    await seedAdmin();
    await expect(
      invoke(metadata({ mediaId: "missing" }))
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("updates a video duration and metadata without touching storage fields", async () => {
    await seedAdmin();
    const original = videoRecord();
    await fakeDb.ref("media/vid-1").set(original);

    const result = (await invoke(metadata({ duration: "3:45" }))) as {
      record: RecordValue;
    };

    expect(result.record).toMatchObject({
      title: "New Title",
      date: "2026",
      isSticky: true,
      isHidden: false,
      duration: "3:45",
    });
    expect(typeof result.record.dateUpdated).toBe("number");
    expect(result.record.urls).toEqual(original.urls);
    expect(result.record.storage).toEqual(original.storage);
    expect(result.record.type).toBe("video");
    expect(result.record.format).toBe("video/mp4");
    expect(result.record.fileName).toBe("clip.mp4");
  });

  it("leaves an omitted duration untouched", async () => {
    await seedAdmin();
    await fakeDb.ref("media/vid-1").set(videoRecord());

    const result = (await invoke(metadata())) as { record: RecordValue };
    expect(result.record.duration).toBe("1:00");
  });

  it("validates the duration and title", async () => {
    await seedAdmin();
    await fakeDb.ref("media/vid-1").set(videoRecord());

    await expect(
      invoke(metadata({ duration: "130" }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      invoke(metadata({ title: "  " }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(fakeDb.read("media/vid-1/title")).toBe("Old Title");
  });

  it("updates album track titles and a permuted listing atomically", async () => {
    await seedAdmin();
    const original = albumRecord();
    await fakeDb.ref("media/album-1").set(original);
    await fakeDb.ref("media/track-1").set(trackRecord("track-1", "First"));
    await fakeDb.ref("media/track-2").set(trackRecord("track-2", "Second"));

    const result = (await invoke({
      mediaId: "album-1",
      title: "New Album",
      date: "2026",
      isSticky: false,
      isHidden: true,
      listing: ["track-2", "track-1"],
      trackTitles: ["Second Song", "First Song"],
    })) as { record: RecordValue; tracks: RecordValue[] };

    expect(result.record.listing).toEqual(["track-2", "track-1"]);
    expect(result.tracks.map((track) => track.id)).toEqual([
      "track-2",
      "track-1",
    ]);
    expect(result.tracks.map((track) => track.title)).toEqual([
      "Second Song",
      "First Song",
    ]);
    expect(result.record.storage).toEqual(original.storage);
    expect(result.record.urls).toEqual(original.urls);
    expect(result.record.type).toBe("audio-album");
    expect(result.record.format).toBe("collection/audio");
    expect(fakeDb.read("media/track-1/title")).toBe("First Song");
    expect(fakeDb.read("media/track-2/title")).toBe("Second Song");
  });

  it("rejects a non-permutation listing, a duplicate listing, and a title count mismatch", async () => {
    await seedAdmin();
    await fakeDb.ref("media/album-1").set(albumRecord());
    await fakeDb.ref("media/track-1").set(trackRecord("track-1", "First"));
    await fakeDb.ref("media/track-2").set(trackRecord("track-2", "Second"));

    const albumData = (overrides: Record<string, unknown>) => ({
      mediaId: "album-1",
      title: "Album",
      date: "2026",
      isSticky: false,
      isHidden: false,
      listing: ["track-1", "track-2"],
      trackTitles: ["First", "Second"],
      ...overrides,
    });

    await expect(
      invoke(albumData({ listing: ["track-1", "other"] }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      invoke(albumData({ listing: ["track-1", "track-1"] }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      invoke(albumData({ trackTitles: ["Only One"] }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      invoke(albumData({ listing: undefined }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      invoke(albumData({ trackTitles: undefined }))
    ).rejects.toMatchObject({ code: "invalid-argument" });

    expect(fakeDb.read("media/album-1/listing")).toEqual([
      "track-1",
      "track-2",
    ]);
  });

  it("rejects a listing that references a missing track", async () => {
    await seedAdmin();
    await fakeDb.ref("media/album-1").set(albumRecord());
    await fakeDb.ref("media/track-1").set(trackRecord("track-1", "First"));

    await expect(
      invoke({
        mediaId: "album-1",
        title: "New Album",
        date: "2026",
        isSticky: false,
        isHidden: false,
        listing: ["track-2", "track-1"],
        trackTitles: ["Second Song", "First Song"],
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(fakeDb.read("media/album-1/title")).toBe("Album");
    expect(fakeDb.read("media/track-1/title")).toBe("First");
  });

  it("aborts when the listing changes inside the compare-and-set", async () => {
    await seedAdmin();
    await fakeDb.ref("media/album-1").set(albumRecord());
    await fakeDb.ref("media/track-1").set(trackRecord("track-1", "First"));
    await fakeDb.ref("media/track-2").set(trackRecord("track-2", "Second"));
    const original = FakeRef.prototype.transaction;
    let raced = false;
    const spy = vi
      .spyOn(FakeRef.prototype, "transaction")
      .mockImplementation(async function (this: FakeRef, mutate) {
        const path = (this as unknown as { path: string }).path;
        if (path === "media/album-1" && !raced) {
          raced = true;
          await fakeDb.ref("media/album-1/listing").set(["track-2"]);
          await fakeDb.ref("media/track-1").set(null);
        }
        return original.call(this, mutate);
      });

    await expect(
      invoke({
        mediaId: "album-1",
        title: "New Album",
        date: "2026",
        isSticky: false,
        isHidden: false,
        listing: ["track-2", "track-1"],
        trackTitles: ["Second Song", "First Song"],
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });

    expect(fakeDb.read("media/album-1/listing")).toEqual(["track-2"]);
    expect(fakeDb.read("media/album-1/title")).toBe("Album");
    expect(fakeDb.read("media/track-1")).toBeNull();
    spy.mockRestore();
  });
});
