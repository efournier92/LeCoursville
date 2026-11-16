type Rgb = [number, number, number];

function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((index) => Number.parseInt(full.slice(index, index + 2), 16)) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((part) => Math.round(part).toString(16).padStart(2, '0')).join('');
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function blend(from: Rgb, to: Rgb, amount: number): Rgb {
  return from.map((part, index) => part + (to[index] - part) * amount) as Rgb;
}

/** Nudges a family hex toward ink or paper until it clears minimum contrast on the given surface. */
export function ensureContrast(hex: string, background: string, minimum = 3): string {
  const foreground = parseHex(hex);
  const surface = parseHex(background);
  if (!foreground || !surface) return hex;
  if (ratio(foreground, surface) >= minimum) return toHex(foreground);

  const target: Rgb = luminance(surface) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  let low = 0;
  let high = 1;
  for (let step = 0; step < 20; step++) {
    const middle = (low + high) / 2;
    if (ratio(blend(foreground, target, middle), surface) >= minimum) high = middle;
    else low = middle;
  }
  return toHex(blend(foreground, target, high));
}
