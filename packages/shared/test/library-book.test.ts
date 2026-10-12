import { describe, expect, it } from "vitest";
import { bookImageOf, bookImageType, bookSections, type BookNode, gutenbergHtmlUrl, gutenbergImageUrl, isBookTree, libraryUrlOk, nodeText, sectionAt, textBlocks } from "../src";

const p = (s: string): BookNode => ({ t: "p", c: [s] });
const h = (t: "h1" | "h2" | "h3", s: string): BookNode => ({ t, c: [s] });

describe("the plain text as a book", () => {
  it("turns chapter lines into headings, verse into lines, and leaves prose alone", () => {
    expect(
      textBlocks([
        "CHAPTER I",
        "It was a dark night.",
        "Roses are red,\n  Violets are blue.",
        "XIV.",
        "Chapter the longest of all, a heading that goes on and on and on and on far beyond eighty characters",
      ]),
    ).toEqual([
      { t: "h2", c: ["CHAPTER I"] },
      { t: "p", c: ["It was a dark night."] },
      { t: "p", k: "v", c: ["Roses are red,", { t: "br" }, "  Violets are blue."] },
      { t: "h2", c: ["XIV."] },
      { t: "p", c: ["Chapter the longest of all, a heading that goes on and on and on and on far beyond eighty characters"] },
    ]);
  });

  it("turns _underscores_ into italics, centres set-in lines and drops bare illustration markers", () => {
    expect(
      textBlocks([
        "You _may_ go, but not_this_one or snake_case.",
        "[Illustration]",
        "[Illustration: GEORGE ALLEN\n   PUBLISHER]",
        "                  BY\n             JANE AUSTEN",
        "            THE END",
      ]),
    ).toEqual([
      { t: "p", c: ["You ", { t: "i", c: ["may"] }, " go, but not_this_one or snake_case."] },
      { t: "p", k: "c", c: [{ t: "i", c: ["[Illustration: GEORGE ALLEN PUBLISHER]"] }] },
      { t: "p", k: "c", c: ["BY", { t: "br" }, "JANE AUSTEN"] },
      { t: "p", k: "c", c: ["THE END"] },
    ]);
  });
});

describe("sections", () => {
  it("start at every h1 and h2, keep a part title with its first chapter, and count characters", () => {
    const blocks = [p("Front matter."), h("h1", "PART ONE"), h("h2", "Chapter 1"), p("Words."), h("h3", "A scene"), p("More."), h("h2", "Chapter 2"), p("End.")];
    const s = bookSections(blocks);
    expect(s.map((x) => x.title)).toEqual(["", "PART ONE", "Chapter 2"]);
    expect(s.map((x) => x.start)).toEqual([0, 13, 13 + 8 + 9 + 6 + 7 + 5]);
    expect(s[1]!.blocks).toHaveLength(5);
  });

  it("cut a long stretch without headings so no section is too big to lay out", () => {
    const blocks = Array.from({ length: 50 }, () => p("x".repeat(1000)));
    const s = bookSections(blocks, 10_000);
    expect(s).toHaveLength(5);
    expect(s.every((x) => x.size <= 10_000)).toBe(true);
  });

  it("find where a saved place falls", () => {
    const s = bookSections([h("h2", "One"), p("a".repeat(97)), h("h2", "Two"), p("b".repeat(97))]);
    expect(sectionAt(s, 0)).toEqual({ sec: 0, frac: 0 });
    expect(sectionAt(s, 150)).toEqual({ sec: 1, frac: 0.5 });
    expect(sectionAt(s, 10_000)).toEqual({ sec: 1, frac: 1 });
    expect(sectionAt([], 5)).toEqual({ sec: 0, frac: 0 });
  });
});

describe("book trees from the network", () => {
  it("are only the allowlisted tags with a bare image file name", () => {
    expect(isBookTree([p("x"), { t: "img", src: "a.jpg" }, { t: "ul", c: [{ t: "li", c: ["y"] }] }])).toBe(true);
    expect(isBookTree([{ t: "script", c: ["x"] }])).toBe(false);
    expect(isBookTree([{ t: "img", src: "https://evil.example/x.jpg" }])).toBe(false);
    expect(isBookTree([{ t: "p", src: "a.jpg" }])).toBe(false);
    expect(isBookTree([{ t: "p", c: [{ t: "iframe" }] }])).toBe(false);
    expect(isBookTree("nope")).toBe(false);
    expect(nodeText({ t: "p", c: ["a", { t: "br" }, { t: "em", c: ["b"] }] })).toBe("a\nb");
  });
});

describe("the HTML edition and its pictures", () => {
  it("are fetched from allowlisted addresses built from a number and a checked file name", () => {
    expect(gutenbergHtmlUrl(1342)).toBe("https://www.gutenberg.org/cache/epub/1342/pg1342-images.html");
    expect(libraryUrlOk(gutenbergHtmlUrl(1342))).toBe(true);
    expect(gutenbergImageUrl(1342, "cover.jpg")).toBe("https://www.gutenberg.org/cache/epub/1342/images/cover.jpg");
    for (const ok of ["cover.jpg", "i_002.png", "fig-3.GIF".toLowerCase(), "a.jpeg"]) expect(bookImageOf(ok)).toBe(ok);
    for (const bad of ["../a.jpg", "a/b.jpg", "a.svg", "a.jpg.html", "", null, 5]) expect(bookImageOf(bad)).toBeNull();
    expect([bookImageType("a.png"), bookImageType("a.gif"), bookImageType("a.jpeg")]).toEqual(["image/png", "image/gif", "image/jpeg"]);
  });
});
