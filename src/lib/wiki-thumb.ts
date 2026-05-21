/**
 * Wikimedia Commons thumbnail URL transforms.
 *
 * Two URL shapes appear in our content. Both expose a public width-keyed
 * thumbnailing contract; we use it to build a `srcset` instead of shipping
 * the raw 3840px source to every card.
 *
 *   1. Special:FilePath form
 *      https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg
 *      → controlled by `?width=N`
 *
 *   2. Direct thumb form
 *      https://upload.wikimedia.org/wikipedia/commons/thumb/a/bc/X.jpg/3840px-X.jpg
 *      → controlled by the `<N>px-X.jpg` suffix
 */

export type ThumbBuilder = (width: number) => string;

export function commonsThumbBuilder(input: string): ThumbBuilder | null {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }

  if (
    parsed.hostname === "commons.wikimedia.org" &&
    parsed.pathname.startsWith("/wiki/Special:FilePath/")
  ) {
    parsed.searchParams.delete("width");
    const base = parsed.toString();
    const sep = base.includes("?") ? "&" : "?";
    return (w) => `${base}${sep}width=${w}`;
  }

  if (parsed.hostname === "upload.wikimedia.org" && parsed.pathname.includes("/thumb/")) {
    const segments = parsed.pathname.split("/");
    const last = segments[segments.length - 1];
    const m = last && /^\d+px-(.+)$/.exec(last);
    if (m) {
      const filename = m[1];
      return (w) => {
        const next = [...segments];
        next[next.length - 1] = `${w}px-${filename}`;
        const out = new URL(parsed.toString());
        out.pathname = next.join("/");
        return out.toString();
      };
    }
  }

  return null;
}
