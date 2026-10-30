/** Keep post-login navigation on this origin, including browser URL normalization. */
export function safeNextPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") ||
      /[\\\u0000-\u0020\u007f]/.test(value)) return "/dashboard";
  const url = new URL(value, "https://labloop.invalid");
  if (url.origin !== "https://labloop.invalid" || url.pathname.startsWith("/login")) {
    return "/dashboard";
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
