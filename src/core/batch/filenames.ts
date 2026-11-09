/** Produce a portable filename stem; the exporter adds its extension. */
export function sanitizeFilename(value: string): string {
  let name = value
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
    .replace(/[. ]+$/g, '');
  if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name))
    name = `_${name}`.slice(0, 80);
  return name;
}

/** Allocate names case-insensitively so archives extract safely on all platforms. */
export function createFilenameAllocator(
  count: number,
): (value: string, index: number) => string {
  const used = new Set<string>();
  const width = Math.max(4, String(count).length);
  return (value, index) => {
    const base =
      sanitizeFilename(value) || `qr-${String(index + 1).padStart(width, '0')}`;
    let name = base;
    let suffix = 2;
    while (used.has(name.toLowerCase())) {
      const ending = `-${suffix++}`;
      name = `${base.slice(0, 80 - ending.length)}${ending}`;
    }
    used.add(name.toLowerCase());
    return name;
  };
}
