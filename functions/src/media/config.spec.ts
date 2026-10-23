import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  emulatorMediaUrl,
  isMediaEmulator,
  mediaBaseUrl,
  MEDIA_BASE_URL,
} from "./config";

const saved = {
  emulator: process.env.FUNCTIONS_EMULATOR,
  project: process.env.GCLOUD_PROJECT,
};

function restore(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("media config", () => {
  beforeEach(() => {
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.GCLOUD_PROJECT;
  });

  afterAll(() => {
    restore("FUNCTIONS_EMULATOR", saved.emulator);
    restore("GCLOUD_PROJECT", saved.project);
  });

  it("is an emulator only for the literal true flag", () => {
    expect(isMediaEmulator()).toBe(false);
    process.env.FUNCTIONS_EMULATOR = "1";
    expect(isMediaEmulator()).toBe(false);
    process.env.FUNCTIONS_EMULATOR = "false";
    expect(isMediaEmulator()).toBe(false);
    process.env.FUNCTIONS_EMULATOR = "true";
    expect(isMediaEmulator()).toBe(true);
  });

  it("uses the production base outside the emulator", () => {
    expect(MEDIA_BASE_URL).toBe("https://assets.lecoursville.com");
    expect(mediaBaseUrl()).toBe("https://assets.lecoursville.com");
  });

  it("points the base at the local sink inside the emulator", () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    process.env.GCLOUD_PROJECT = "lecoursville-test";

    const url = mediaBaseUrl();

    expect(url.startsWith("http://localhost:5001/")).toBe(true);
    expect(url).toContain("lecoursville-test");
  });

  it("falls back to the dev project for emulator media urls", () => {
    process.env.FUNCTIONS_EMULATOR = "true";

    expect(emulatorMediaUrl("Video/clip.mp4")).toContain("lecoursville-dev");
  });
});
