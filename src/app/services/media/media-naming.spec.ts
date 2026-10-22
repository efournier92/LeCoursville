import {
  albumCoverKey,
  albumDownloadUrl,
  albumFolderKey,
  albumIconUrl,
  albumZipKey,
  audioFolderName,
  isValidAudioFolderName,
  isValidTrackFileName,
  isValidVideoStorageName,
  mediaUrl,
  trackDownloadUrl,
  trackFileName,
  trackKey,
  trackTitle,
  videoDownloadUrl,
  videoIconKey,
  videoIconUrl,
  videoKey,
  videoStorageName,
} from "./media-naming";

const BASE = "https://assets.lecoursville.com";

describe("media naming", () => {
  it("derives video storage names", () => {
    expect(videoStorageName("My Trip (2026).mp4")).toBe("my-trip-2026");
    expect(videoStorageName("Café au Lait.mp4")).toBe("cafe-au-lait");
    expect(videoStorageName("Über Film.mov")).toBe("uber-film");
    expect(videoStorageName("MY VIDEO.MP4")).toBe("my-video");
    expect(videoStorageName("a___b   c---d.mp4")).toBe("a-b-c-d");
    expect(videoStorageName("__Hello--.mp4")).toBe("hello");
    expect(videoStorageName(" - leading.mp4")).toBe("leading");
    expect(videoStorageName("trailing - .mp4")).toBe("trailing");
    expect(videoStorageName("")).toBe("video");
    expect(videoStorageName("🎉.mp4")).toBe("video");
    expect(videoStorageName(`${"a".repeat(90)}.mp4`)).toHaveLength(80);
    const truncated = videoStorageName(`${"a".repeat(79)} b.mp4`);
    expect(truncated).toHaveLength(79);
    expect(truncated.endsWith("-")).toBe(false);
  });

  it("validates editable video storage names", () => {
    expect(isValidVideoStorageName("my-trip-2026")).toBe(true);
    expect(isValidVideoStorageName("a")).toBe(true);
    expect(isValidVideoStorageName("")).toBe(false);
    expect(isValidVideoStorageName("My-Trip")).toBe(false);
    expect(isValidVideoStorageName("my--trip")).toBe(false);
    expect(isValidVideoStorageName("-trip")).toBe(false);
    expect(isValidVideoStorageName("trip-")).toBe(false);
    expect(isValidVideoStorageName("a".repeat(81))).toBe(false);
  });

  it("derives audio folder names", () => {
    expect(audioFolderName("Le Cours 2026")).toBe("Le+Cours+2026");
    expect(audioFolderName("Le   Cours")).toBe("Le+Cours");
    expect(audioFolderName("  Le Cours  ")).toBe("Le+Cours");
    expect(audioFolderName("++Le++Cours++")).toBe("Le+Cours");
    expect(audioFolderName("")).toBe("album");
    expect(audioFolderName("   ")).toBe("album");
    expect(audioFolderName("a".repeat(120))).toHaveLength(100);
    const truncated = audioFolderName(`${"a".repeat(99)} b`);
    expect(truncated).toHaveLength(99);
    expect(truncated.endsWith("+")).toBe(false);
  });

  it("leaves forbidden folder characters for validation to reject", () => {
    for (const char of ["%", "?", "#", "&", "/", "\\", ":", "*", '"', "<", ">", "|"]) {
      expect(isValidAudioFolderName(audioFolderName(`Le${char}Cours`))).toBe(false);
    }
    expect(isValidAudioFolderName("Le\u0001Cours")).toBe(false);
    expect(isValidAudioFolderName("Le+Cours")).toBe(true);
    expect(isValidAudioFolderName("+LeCours")).toBe(false);
    expect(isValidAudioFolderName("LeCours+")).toBe(false);
    expect(isValidAudioFolderName("")).toBe(false);
    expect(isValidAudioFolderName("a".repeat(101))).toBe(false);
  });

  it("derives track filenames and titles", () => {
    expect(trackFileName("01 - First Dance.mp3")).toBe("01+-+First+Dance.mp3");
    expect(trackFileName("A+B Song.MP3")).toBe("A+B+Song.mp3");
    expect(trackFileName("dir/sub\\song.mp3")).toBe("dirsubsong.mp3");
    expect(trackFileName("song\u0001.mp3")).toBe("song.mp3");
    expect(trackTitle("01 - First_Dance.mp3")).toBe("01 First Dance");
    expect(trackTitle("A+B Song.MP3")).toBe("A+B Song");
    expect(isValidTrackFileName("A+B+Song.mp3")).toBe(true);
    expect(isValidTrackFileName("Song.MP3")).toBe(true);
    for (const char of ["%", "?", "#", "&"]) {
      expect(isValidTrackFileName(`Song${char}.mp3`)).toBe(false);
    }
    expect(isValidTrackFileName(".mp3")).toBe(false);
    expect(isValidTrackFileName("Song.wav")).toBe(false);
    expect(isValidTrackFileName("dir/song.mp3")).toBe(false);
    expect(isValidTrackFileName("song\u0001.mp3")).toBe(false);
  });

  it("builds video keys and urls", () => {
    expect(videoKey("my-trip-2026")).toBe("Video/my-trip-2026.mp4");
    expect(videoIconKey("my-trip-2026")).toBe("Video/Icons/my-trip-2026.jpg");
    expect(videoDownloadUrl(BASE, "my-trip-2026")).toBe(
      "https://assets.lecoursville.com/Video/my-trip-2026.mp4"
    );
    expect(videoIconUrl(BASE, "my-trip-2026")).toBe(
      "https://assets.lecoursville.com/Video/Icons/my-trip-2026.jpg"
    );
    expect(videoDownloadUrl(BASE, videoStorageName("My Trip (2026).mp4"))).toBe(
      "https://assets.lecoursville.com/Video/my-trip-2026.mp4"
    );
  });

  it("builds album keys and urls with the plus convention", () => {
    expect(albumFolderKey("Le+Cours")).toBe("Music/Albums/Le+Cours");
    expect(albumCoverKey("Le+Cours")).toBe("Music/Albums/Covers/Le+Cours.jpg");
    expect(albumZipKey("Le+Cours")).toBe("Music/Albums/Zips/Le+Cours.zip");
    expect(albumDownloadUrl(BASE, "Le+Cours")).toBe(
      "https://assets.lecoursville.com/Music/Albums/Zips/Le+Cours.zip"
    );
    expect(albumIconUrl(BASE, "Le+Cours")).toBe(
      "https://assets.lecoursville.com/Music/Albums/Covers/Le+Cours.jpg"
    );
    expect(trackKey("Le+Cours", "01+-+First+Dance.mp3")).toBe(
      "Music/Albums/Le+Cours/01+-+First+Dance.mp3"
    );
    expect(trackDownloadUrl(BASE, "Le+Cours", "01+-+First+Dance.mp3")).toBe(
      "https://assets.lecoursville.com/Music/Albums/Le+Cours/01+-+First+Dance.mp3"
    );
  });

  it("keeps plus signs and encodes non-ASCII with encodeURI", () => {
    expect(mediaUrl(BASE, "Music/Albums/Le+Cours/Café.mp3")).toBe(
      "https://assets.lecoursville.com/Music/Albums/Le+Cours/Caf%C3%A9.mp3"
    );
    expect(encodeURI("Le+Cours")).toBe("Le+Cours");
  });
});

// Fixed inputs and outputs copied from functions/src/media/naming.spec.ts.
const PARITY: Array<{ input: string; video?: string; folder?: string; trackFile?: string; trackTitle?: string }> = [
  { input: "My Trip (2026).mp4", video: "my-trip-2026" },
  { input: "Café au Lait.mp4", video: "cafe-au-lait" },
  { input: "a___b   c---d.mp4", video: "a-b-c-d" },
  { input: "__Hello--.mp4", video: "hello" },
  { input: "🎉.mp4", video: "video" },
  { input: "Le Cours 2026", folder: "Le+Cours+2026" },
  { input: "  Le Cours  ", folder: "Le+Cours" },
  { input: "01 - First Dance.mp3", trackFile: "01+-+First+Dance.mp3", trackTitle: "01 First Dance" },
  { input: "A+B Song.MP3", trackFile: "A+B+Song.mp3", trackTitle: "A+B Song" },
  { input: "dir/sub\\song.mp3", trackFile: "dirsubsong.mp3" },
];

describe("server parity", () => {
  for (const row of PARITY) {
    it(`matches the server for "${row.input}"`, () => {
      if (row.video !== undefined) {
        expect(videoStorageName(row.input)).toBe(row.video);
      }
      if (row.folder !== undefined) {
        expect(audioFolderName(row.input)).toBe(row.folder);
      }
      if (row.trackFile !== undefined) {
        expect(trackFileName(row.input)).toBe(row.trackFile);
      }
      if (row.trackTitle !== undefined) {
        expect(trackTitle(row.input)).toBe(row.trackTitle);
      }
    });
  }

  it("matches the server key and url table", () => {
    expect(videoKey("my-trip-2026")).toBe("Video/my-trip-2026.mp4");
    expect(videoIconKey("my-trip-2026")).toBe("Video/Icons/my-trip-2026.jpg");
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
