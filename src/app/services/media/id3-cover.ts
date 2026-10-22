export const ID3_SCAN_LIMIT_BYTES = 8388608;

export interface Id3Cover {
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png";
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let value = "";
  for (let index = start; index < end; index++) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function readUint24(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 16) + (bytes[offset + 1] << 8) + bytes[offset + 2];
}

function syncSafe(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function indexOfZero(bytes: Uint8Array, start: number, end: number): number {
  for (let index = start; index < end; index++) {
    if (bytes[index] === 0) {
      return index;
    }
  }
  return -1;
}

function skipDescription(
  bytes: Uint8Array,
  start: number,
  end: number,
  encoding: number
): number {
  if (encoding === 1 || encoding === 2) {
    for (let index = start; index + 1 < end; index += 2) {
      if (bytes[index] === 0 && bytes[index + 1] === 0) {
        return index + 2;
      }
    }
    return -1;
  }
  const zero = indexOfZero(bytes, start, end);
  return zero < 0 ? -1 : zero + 1;
}

function coverFor(mime: string, image: Uint8Array): Id3Cover | null {
  if (image.length === 0) {
    return null;
  }
  if (mime === "image/jpeg") {
    return { bytes: image.slice(), mime: "image/jpeg" };
  }
  if (mime === "image/png") {
    return { bytes: image.slice(), mime: "image/png" };
  }
  return null;
}

function parseApic(
  bytes: Uint8Array,
  start: number,
  end: number
): Id3Cover | null {
  if (start >= end) {
    return null;
  }
  const encoding = bytes[start];
  const mimeEnd = indexOfZero(bytes, start + 1, end);
  if (mimeEnd < 0 || mimeEnd + 2 > end) {
    return null;
  }
  const mime = ascii(bytes, start + 1, mimeEnd).trim().toLowerCase();
  const imageStart = skipDescription(bytes, mimeEnd + 2, end, encoding);
  if (imageStart < 0 || imageStart >= end) {
    return null;
  }
  return coverFor(mime, bytes.subarray(imageStart, end));
}

function parsePic(
  bytes: Uint8Array,
  start: number,
  end: number
): Id3Cover | null {
  if (start + 4 >= end) {
    return null;
  }
  const encoding = bytes[start];
  const format = ascii(bytes, start + 1, start + 4).toUpperCase();
  const imageStart = skipDescription(bytes, start + 5, end, encoding);
  if (imageStart < 0 || imageStart >= end) {
    return null;
  }
  const mime =
    format === "PNG" ? "image/png" : format === "JPG" || format === "JPEG" ? "image/jpeg" : "";
  return coverFor(mime, bytes.subarray(imageStart, end));
}

function findCover(bytes: Uint8Array): Id3Cover | null {
  if (bytes.length < 10 || ascii(bytes, 0, 3) !== "ID3") {
    return null;
  }
  const major = bytes[3];
  if (major < 2 || major > 4) {
    return null;
  }
  const flags = bytes[5];
  if (flags & 0x80) {
    return null;
  }

  const tagEnd = Math.min(bytes.length, 10 + syncSafe(bytes, 6));
  let offset = 10;

  if (major >= 3 && flags & 0x40) {
    if (offset + 4 > tagEnd) {
      return null;
    }
    const extendedSize = major === 4 ? syncSafe(bytes, offset) : readUint32(bytes, offset) + 4;
    offset += extendedSize;
  }

  while (offset < tagEnd) {
    if (major === 2) {
      if (offset + 6 > tagEnd) {
        break;
      }
      const id = ascii(bytes, offset, offset + 3);
      if (bytes[offset] === 0) {
        break;
      }
      const size = readUint24(bytes, offset + 3);
      if (size <= 0) {
        break;
      }
      const bodyStart = offset + 6;
      const bodyEnd = bodyStart + size;
      if (bodyEnd > tagEnd) {
        break;
      }
      if (id === "PIC") {
        const cover = parsePic(bytes, bodyStart, bodyEnd);
        if (cover) {
          return cover;
        }
      }
      offset = bodyEnd;
      continue;
    }

    if (offset + 10 > tagEnd) {
      break;
    }
    const id = ascii(bytes, offset, offset + 4);
    if (bytes[offset] === 0) {
      break;
    }
    const size = major === 4 ? syncSafe(bytes, offset + 4) : readUint32(bytes, offset + 4);
    if (size <= 0) {
      break;
    }
    const formatFlags = bytes[offset + 9];
    const bodyStart = offset + 10;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > tagEnd) {
      break;
    }
    // Compressed, encrypted, grouped, or unsynchronised frames are not decoded.
    const transformed =
      major === 4 ? (formatFlags & 0x4f) !== 0 : (formatFlags & 0xe0) !== 0;
    if (!transformed && id === "APIC") {
      const cover = parseApic(bytes, bodyStart, bodyEnd);
      if (cover) {
        return cover;
      }
    }
    offset = bodyEnd;
  }

  return null;
}

export function extractId3Cover(input: ArrayBuffer | Uint8Array): Id3Cover | null {
  try {
    const source = input instanceof Uint8Array ? input : new Uint8Array(input);
    const bytes =
      source.length > ID3_SCAN_LIMIT_BYTES ? source.subarray(0, ID3_SCAN_LIMIT_BYTES) : source;
    return findCover(bytes);
  } catch {
    return null;
  }
}

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function extractCoverFromFile(file: Blob): Promise<Id3Cover | null> {
  try {
    const buffer = await readBlob(file.slice(0, ID3_SCAN_LIMIT_BYTES));
    return extractId3Cover(buffer);
  } catch {
    return null;
  }
}
