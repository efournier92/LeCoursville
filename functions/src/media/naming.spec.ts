import { describe, expect, it } from "vitest";
import {
  albumDownloadUrl,
  albumFolderKey,
  albumIconUrl,
  audioFolderName,
  isValidAudioFolderName,
  isValidTrackFileName,
  isValidVideoStorageName,
  mediaUrl,
  trackDownloadUrl,
  trackFileName,
  trackTitle,
  videoDownloadUrl,
  videoIconUrl,
  videoKey,
  videoStorageName,
} from "./naming";

const BASE = "https://assets.lecoursville.com";

describe("video storage name", () => {
  it("removes punctuation and parentheses", () => {
    expect(videoStorageName("My Trip (2026).mp4")).toBe("my-trip-2026");
  });

  it("strips accents with NFKD normalization", () => {
    expect(videoStorageName("Café au Lait.mp4")).toBe("cafe-au-lait");
    expect(videoStorageName("Über Film.mov")).toBe("uber-film");
  });

  it("lowercases uppercase names", () => {
    expect(videoStorageName("MY VIDEO.MP4")).toBe("my-video");
  });

  it("collapses repeated separators into one dash", () => {
    expect(videoStorageName("a___b   c---d.mp4")).toBe("a-b-c-d");
  });

  it("trims leading and trailing separators", () => {
    expect(videoStorageName("__Hello--.mp4")).toBe("hello");
    expect(videoStorageName(" - leading.mp4")).toBe("leading");
    expect(videoStorageName("trailing - .mp4")).toBe("trailing");
  });

  it("falls back to video when nothing usable remains", () => {
    expect(videoStorageName("")).toBe("video");
    expect(videoStorageName("🎉.mp4")).toBe("video");
  });

  it("truncates to 80 characters without a trailing dash", () => {
    expect(videoStorageName(`${"a".repeat(90)}.mp4`)).toHaveLength(80);
    const truncated = videoStorageName(`${"a".repeat(79)} b.mp4`);
    expect(truncated).toHaveLength(79);
    expect(truncated.endsWith("-")).toBe(false);
  });

  it("validates the editable name pattern", () => {
    expect(isValidVideoStorageName("my-trip-2026")).toBe(true);
    expect(isValidVideoStorageName("a")).toBe(true);
    expect(isValidVideoStorageName("")).toBe(false);
    expect(isValidVideoStorageName("My-Trip")).toBe(false);
    expect(isValidVideoStorageName("my--trip")).toBe(false);
    expect(isValidVideoStorageName("-trip")).toBe(false);
    expect(isValidVideoStorageName("trip-")).toBe(false);
    expect(isValidVideoStorageName("a".repeat(81))).toBe(false);
  });
});

describe("video urls", () => {
  it("builds plain and hyphenated video and icon urls", () => {
    expect(videoDownloadUrl(BASE, "my-trip-2026")).toBe(
      "https://assets.lecoursville.com/Video/my-trip-2026.mp4"
    );
    expect(videoIconUrl(BASE, "my-trip-2026")).toBe(
      "https://assets.lecoursville.com/Video/Icons/my-trip-2026.jpg"
    );
    expect(videoKey("my-trip-2026")).toBe("Video/my-trip-2026.mp4");
  });

  it("does not duplicate the extension", () => {
    const name = videoStorageName("My Trip (2026).mp4");
    expect(videoDownloadUrl(BASE, name)).toBe(
      "https://assets.lecoursville.com/Video/my-trip-2026.mp4"
    );
  });

  it("uses the sink query shape in emulator mode", () => {
    expect(mediaUrl("http://localhost:5001/p/us-central1/emulatorMediaSink", "Video/a b.mp4", true)).toBe(
      "http://localhost:5001/p/us-central1/emulatorMediaSink?key=Video%2Fa%20b.mp4"
    );
  });
});

describe("audio folder name", () => {
  it("replaces spaces with plus signs", () => {
    expect(audioFolderName("Le Cours 2026")).toBe("Le+Cours+2026");
  });

  it("collapses repeated spaces", () => {
    expect(audioFolderName("Le   Cours")).toBe("Le+Cours");
  });

  it("trims leading and trailing spaces and plus signs", () => {
    expect(audioFolderName("  Le Cours  ")).toBe("Le+Cours");
    expect(audioFolderName("++Le++Cours++")).toBe("Le+Cours");
  });

  it("falls back to album when empty", () => {
    expect(audioFolderName("")).toBe("album");
    expect(audioFolderName("   ")).toBe("album");
  });

  it("truncates to 100 characters without a trailing plus", () => {
    expect(audioFolderName("a".repeat(120))).toHaveLength(100);
    const truncated = audioFolderName(`${"a".repeat(99)} b`);
    expect(truncated).toHaveLength(99);
    expect(truncated.endsWith("+")).toBe(false);
  });

  it("leaves forbidden characters for validation to reject", () => {
    for (const char of ["%", "?", "#", "&", "/", "\\", ":", "*", '"', "<", ">", "|"]) {
      const folder = audioFolderName(`Le${char}Cours`);
      expect(isValidAudioFolderName(folder)).toBe(false);
    }
    expect(isValidAudioFolderName("Le\u0001Cours")).toBe(false);
  });

  it("rejects leading and trailing plus signs and empty values", () => {
    expect(isValidAudioFolderName("Le+Cours")).toBe(true);
    expect(isValidAudioFolderName("+LeCours")).toBe(false);
    expect(isValidAudioFolderName("LeCours+")).toBe(false);
    expect(isValidAudioFolderName("")).toBe(false);
    expect(isValidAudioFolderName("a".repeat(101))).toBe(false);
  });
});

describe("audio track filename and title", () => {
  it("replaces spaces with plus signs and normalizes the mp3 suffix", () => {
    expect(trackFileName("01 - First Dance.mp3")).toBe("01+-+First+Dance.mp3");
    expect(trackFileName("A+B Song.MP3")).toBe("A+B+Song.mp3");
  });

  it("removes path separators and control characters", () => {
    expect(trackFileName("dir/sub\\song.mp3")).toBe("dirsubsong.mp3");
    expect(trackFileName("song\u0001.mp3")).toBe("song.mp3");
  });

  it("derives a title with runs of underscores and dashes as spaces", () => {
    expect(trackTitle("01 - First_Dance.mp3")).toBe("01 First Dance");
    expect(trackTitle("A+B Song.MP3")).toBe("A+B Song");
  });

  it("preserves plus signs in the filename and converts spaces in the title", () => {
    expect(trackFileName("A+B Song.mp3")).toBe("A+B+Song.mp3");
    expect(trackTitle("A+B Song.mp3")).toBe("A+B Song");
  });

  it("validates track filenames", () => {
    expect(isValidTrackFileName("A+B+Song.mp3")).toBe(true);
    expect(isValidTrackFileName("Song.MP3")).toBe(true);
    expect(isValidTrackFileName("Song.mp3")).toBe(true);
    for (const char of ["%", "?", "#", "&"]) {
      expect(isValidTrackFileName(`Song${char}.mp3`)).toBe(false);
    }
    expect(isValidTrackFileName(".mp3")).toBe(false);
    expect(isValidTrackFileName("Song.wav")).toBe(false);
    expect(isValidTrackFileName("dir/song.mp3")).toBe(false);
    expect(isValidTrackFileName("song\u0001.mp3")).toBe(false);
  });
});

describe("audio urls", () => {
  it("keeps plus signs and encodes non-ASCII with encodeURI", () => {
    const url = mediaUrl(BASE, "Music/Albums/Le+Cours/Café.mp3");
    expect(url).toBe(
      "https://assets.lecoursville.com/Music/Albums/Le+Cours/Caf%C3%A9.mp3"
    );
    expect(encodeURI("Le+Cours")).toBe("Le+Cours");
  });

  it("builds album, cover, zip, and track urls", () => {
    expect(albumFolderKey("Le+Cours")).toBe("Music/Albums/Le+Cours");
    expect(albumDownloadUrl(BASE, "Le+Cours")).toBe(
      "https://assets.lecoursville.com/Music/Albums/Zips/Le+Cours.zip"
    );
    expect(albumIconUrl(BASE, "Le+Cours")).toBe(
      "https://assets.lecoursville.com/Music/Albums/Covers/Le+Cours.jpg"
    );
    expect(trackDownloadUrl(BASE, "Le+Cours", "01+-+First+Dance.mp3")).toBe(
      "https://assets.lecoursville.com/Music/Albums/Le+Cours/01+-+First+Dance.mp3"
    );
  });
});
