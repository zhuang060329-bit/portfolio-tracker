const INTERNAL_ORIGIN = "https://stackworth.invalid";

export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
