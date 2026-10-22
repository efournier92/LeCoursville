import { extractId3Cover, ID3_SCAN_LIMIT_BYTES } from "./id3-cover";

function ascii(text: string): number[] {
  return Array.from(text).map(char => char.charCodeAt(0));
}

function syncSafe(value: number): number[] {
  return [
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f,
  ];
}

function tag(version: number, frames: number[], flags = 0): Uint8Array {
  return new Uint8Array([
    ...ascii("ID3"),
    version,
    0,
    flags,
    ...syncSafe(frames.length),
    ...frames,
  ]);
}

function frame23(id: string, body: number[], flags = 0): number[] {
  const size = body.length;
  return [
    ...ascii(id),
    (size >> 24) & 0xff,
    (size >> 16) & 0xff,
    (size >> 8) & 0xff,
    size & 0xff,
    0,
    flags,
    ...body,
  ];
}

function frame24(id: string, body: number[], flags = 0): number[] {
  return [...ascii(id), ...syncSafe(body.length), 0, flags, ...body];
}

function frame22(id: string, body: number[]): number[] {
  const size = body.length;
  return [...ascii(id), (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff, ...body];
}

function apic(mime: string, image: number[], description = ""): number[] {
  return [0, ...ascii(mime), 0, 3, ...ascii(description), 0, ...image];
}

function pic(format: string, image: number[]): number[] {
  return [0, ...ascii(format), 3, 0, ...image];
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("id3 cover extraction", () => {
  it("reads an ID3v2.3 APIC frame with JPEG art", () => {
    const bytes = tag(3, [
      ...frame23("TIT2", [0, ...ascii("Title")]),
      ...frame23("APIC", apic("image/jpeg", JPEG)),
    ]);

    const cover = extractId3Cover(bytes);

    expect(cover?.mime).toBe("image/jpeg");
    expect(Array.from(cover?.bytes ?? [])).toEqual(JPEG);
  });

  it("reads an ID3v2.3 APIC frame with PNG art", () => {
    const bytes = tag(3, frame23("APIC", apic("image/png", PNG)));

    const cover = extractId3Cover(bytes);

    expect(cover?.mime).toBe("image/png");
    expect(Array.from(cover?.bytes ?? [])).toEqual(PNG);
  });

  it("reads a syncsafe ID3v2.4 frame size", () => {
    const image = new Array(300).fill(7);
    const bytes = tag(4, frame24("APIC", apic("image/jpeg", image)));

    const cover = extractId3Cover(bytes);

    expect(cover?.mime).toBe("image/jpeg");
    expect(cover?.bytes.length).toBe(300);
  });

  it("reads an ID3v2.2 PIC frame", () => {
    const bytes = tag(2, frame22("PIC", pic("PNG", PNG)));

    const cover = extractId3Cover(bytes);

    expect(cover?.mime).toBe("image/png");
    expect(Array.from(cover?.bytes ?? [])).toEqual(PNG);
  });

  it("returns null for no tag or a truncated tag", () => {
    expect(extractId3Cover(new Uint8Array(0))).toBeNull();
    expect(extractId3Cover(new Uint8Array([1, 2, 3]))).toBeNull();

    const truncated = new Uint8Array(20);
    truncated.set(ascii("ID3"));
    truncated.set([3, 0, 0], 3);
    truncated.set(syncSafe(100), 6);
    expect(extractId3Cover(truncated)).toBeNull();
  });

  it("returns null for a zero-length image or an unsupported MIME type", () => {
    expect(extractId3Cover(tag(3, frame23("APIC", apic("image/jpeg", []))))).toBeNull();
    expect(extractId3Cover(tag(3, frame23("APIC", apic("image/gif", JPEG))))).toBeNull();
    expect(extractId3Cover(tag(2, frame22("PIC", pic("BMP", PNG))))).toBeNull();
  });

  it("ignores compressed and unsynchronised frames", () => {
    expect(extractId3Cover(tag(3, frame23("APIC", apic("image/jpeg", JPEG), 0x80)))).toBeNull();
    expect(extractId3Cover(tag(4, frame24("APIC", apic("image/jpeg", JPEG), 0x02)))).toBeNull();
    expect(extractId3Cover(tag(4, frame24("APIC", apic("image/jpeg", JPEG))))).not.toBeNull();
  });

  it("never throws for malformed input", () => {
    expect(() => extractId3Cover(new Uint8Array([0x49, 0x44, 0x33, 9, 9, 9, 9, 9, 9, 9]))).not.toThrow();
    expect(extractId3Cover(new Uint8Array([0x49, 0x44, 0x33, 9, 9, 9, 9, 9, 9, 9]))).toBeNull();
  });
});

describe("id3 scan limit", () => {
  it("does not scan past the first 8 MiB", () => {
    const bytes = new Uint8Array(ID3_SCAN_LIMIT_BYTES + 128);
    const lateTag = tag(3, frame23("APIC", apic("image/jpeg", JPEG)));
    bytes.set(lateTag, ID3_SCAN_LIMIT_BYTES);

    expect(extractId3Cover(bytes)).toBeNull();
    expect(extractId3Cover(lateTag)).not.toBeNull();
  });

  it("stops when a frame extends beyond the scanned window", () => {
    const header = new Uint8Array([
      ...ascii("ID3"),
      3,
      0,
      0,
      ...syncSafe(ID3_SCAN_LIMIT_BYTES + 100),
    ]);
    const oversizedFrame = [
      ...ascii("APIC"),
      0x00, 0x7f, 0xff, 0xff,
      0, 0,
      ...apic("image/jpeg", new Array(64).fill(1)),
    ];
    const bytes = new Uint8Array(ID3_SCAN_LIMIT_BYTES);
    bytes.set(header, 0);
    bytes.set(oversizedFrame, 10);

    expect(extractId3Cover(bytes)).toBeNull();
  });
});
