import { describe, expect, it } from "vitest";
import { commonsThumbBuilder } from "./wiki-thumb";

function mustBuild(input: string) {
  const b = commonsThumbBuilder(input);
  if (!b) throw new Error(`expected a builder for ${input}`);
  return b;
}

describe("commonsThumbBuilder", () => {
  it("returns null for non-Commons URLs", () => {
    expect(commonsThumbBuilder("https://example.com/foo.jpg")).toBeNull();
    expect(commonsThumbBuilder("/local/photo.jpg")).toBeNull();
    expect(commonsThumbBuilder("not a url")).toBeNull();
  });

  it("transforms Special:FilePath URLs via ?width=N", () => {
    const b = mustBuild("https://commons.wikimedia.org/wiki/Special:FilePath/Adobo.jpg");
    expect(b(480)).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/Adobo.jpg?width=480");
    expect(b(1280)).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Adobo.jpg?width=1280",
    );
  });

  it("overwrites any preexisting width on Special:FilePath URLs", () => {
    const b = mustBuild("https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width=200");
    expect(b(480)).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width=480");
  });

  it("rewrites the <N>px- prefix on upload.wikimedia.org thumb URLs", () => {
    const url =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Adobo_DSCF4391.jpg/3840px-Adobo_DSCF4391.jpg";
    const b = mustBuild(url);
    expect(b(480)).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Adobo_DSCF4391.jpg/480px-Adobo_DSCF4391.jpg",
    );
    expect(b(1280)).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Adobo_DSCF4391.jpg/1280px-Adobo_DSCF4391.jpg",
    );
  });

  it("preserves filenames with dots and non-ASCII characters", () => {
    const url =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Café_au_lait.jpg/3840px-Café_au_lait.jpg";
    const b = mustBuild(url);
    expect(b(768)).toContain("/768px-Caf");
    expect(b(768)).toContain(".jpg");
  });

  it("returns null for upload URLs without a thumb segment", () => {
    expect(
      commonsThumbBuilder("https://upload.wikimedia.org/wikipedia/commons/c/c9/Adobo.jpg"),
    ).toBeNull();
  });
});
