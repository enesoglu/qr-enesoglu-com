export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isWebsite(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname
    );
  } catch {
    return false;
  }
}
