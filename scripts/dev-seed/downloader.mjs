/**
 * Asset downloader for the dev seed (UI-008). Resolves public-domain assets
 * from Internet Archive and the Library of Congress into a gitignored cache,
 * verifying the provider checksum when one is published.
 *
 * This module runs only on an explicit dev seed. The e2e gate never imports
 * it and never downloads anything.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const IA_SEARCH = 'https://archive.org/advancedsearch.php';
const IA_METADATA = 'https://archive.org/metadata/';
const IA_DOWNLOAD = 'https://archive.org/download/';
const LOC_SEARCH = 'https://www.loc.gov/';

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const md5 = (buffer) => createHash('md5').update(buffer).digest('hex');
const sha1 = (buffer) => createHash('sha1').update(buffer).digest('hex');

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`GET ${url} -> HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchBytes(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`GET ${url} -> HTTP ${response.status}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? '',
  };
}

function extOf(name) {
  return extname(String(name ?? '')).toLowerCase();
}

function cacheFile(cacheRoot, className, index, extension) {
  const dir = join(cacheRoot, className);
  mkdirSync(dir, { recursive: true });
  return join(dir, `${String(index + 1).padStart(2, '0')}${extension}`);
}

function verifyArchiveChecksum(file, buffer) {
  if (file.md5 && md5(buffer) !== String(file.md5).toLowerCase()) {
    throw new Error(`checksum mismatch for ${file.name}: md5`);
  }
  if (file.sha1 && sha1(buffer) !== String(file.sha1).toLowerCase()) {
    throw new Error(`checksum mismatch for ${file.name}: sha1`);
  }
  if (!file.md5 && !file.sha1) {
    throw new Error(`no published checksum for ${file.name}; refusing an unverified download`);
  }
}

async function resolveInternetArchive(source, className, cacheRoot) {
  const extensions = source.extensions ?? [];
  const search = `${IA_SEARCH}?q=${encodeURIComponent(source.query)}`
    + `&fl%5B%5D=identifier&fl%5B%5D=title`
    + `&rows=${Math.max(source.want * 4, 40)}&output=json`;
  const data = await fetchJson(search);
  const docs = data?.response?.docs ?? [];
  const assets = [];
  for (const doc of docs) {
    if (assets.length >= source.want) {
      break;
    }
    const metadata = await fetchJson(`${IA_METADATA}${encodeURIComponent(doc.identifier)}`);
    const files = metadata?.files ?? [];
    const file = files
      .filter((entry) => extensions.includes(extOf(entry.name)))
      .filter((entry) => Number(entry.size) > 0)
      .sort((a, b) => Number(b.size) - Number(a.size))[0];
    if (!file) {
      continue;
    }
    const encodedPath = String(file.name).split('/').map(encodeURIComponent).join('/');
    const { buffer, contentType } = await fetchBytes(
      `${IA_DOWNLOAD}${encodeURIComponent(doc.identifier)}/${encodedPath}`,
    );
    verifyArchiveChecksum(file, buffer);
    const path = cacheFile(cacheRoot, className, assets.length, extOf(file.name));
    writeFileSync(path, buffer);
    assets.push({
      title: doc.title ?? file.name,
      sourceUrl: `${IA_DOWNLOAD}${encodeURIComponent(doc.identifier)}/${encodedPath}`,
      license: source.license,
      attribution: source.attribution,
      contentType,
      bytes: buffer.length,
      sha256: sha256(buffer),
      path,
    });
  }
  if (assets.length < source.want) {
    throw new Error(
      `source "${source.query}" yielded ${assets.length}/${source.want} verified assets`,
    );
  }
  return assets;
}

async function resolveLibraryOfCongress(source, className, cacheRoot) {
  const search = `${LOC_SEARCH}${source.searchPath}/?q=${encodeURIComponent(source.query)}`
    + `&fo=json&c=${Math.max(source.want * 3, 30)}`;
  const data = await fetchJson(search);
  const results = data?.content?.results ?? [];
  const assets = [];
  for (const result of results) {
    if (assets.length >= source.want) {
      break;
    }
    if (result.access_restricted === true) {
      continue;
    }
    const imageUrl = String(result.image_url?.[0] ?? '').split('#')[0];
    if (!imageUrl) {
      continue;
    }
    const { buffer, contentType } = await fetchBytes(imageUrl);
    if (!contentType.startsWith('image/')) {
      continue;
    }
    // Library of Congress does not publish one canonical checksum per
    // derivative, so pin the bytes we resolve and keep the digest in the cache
    // sidecar for rerun verification. Internet Archive checksums stay strict.
    const path = cacheFile(cacheRoot, className, assets.length, extOf(imageUrl) || '.jpg');
    writeFileSync(path, buffer);
    writeFileSync(`${path}.sha256`, sha256(buffer));
    assets.push({
      title: result.title ?? 'Library of Congress image',
      sourceUrl: imageUrl,
      license: source.license,
      attribution: source.attribution,
      contentType,
      bytes: buffer.length,
      sha256: sha256(buffer),
      path,
    });
  }
  if (assets.length < source.want) {
    throw new Error(
      `source "${source.query}" yielded ${assets.length}/${source.want} usable assets`,
    );
  }
  return assets;
}

/**
 * Resolves every asset class into the cache. Returns the downloaded buffers
 * grouped by class so the caller uploads them and then clears the cache.
 */
export async function downloadAll(sources, cacheRoot) {
  const result = {};
  for (const [className, source] of Object.entries(sources)) {
    result[className] = source.provider === 'library-of-congress'
      ? await resolveLibraryOfCongress(source, className, cacheRoot)
      : await resolveInternetArchive(source, className, cacheRoot);
  }
  return result;
}
