import { describe, expect, it } from "vitest";
import { bookIdOf, gutenbergTextUrl, gutendexSearchUrl, LIBRARY_SHELVES, libraryHits, libraryQuery, libraryUrlOk, pageAtPos, paginate, splitGutenberg, toParagraphs } from "../src";

/** A trimmed copy of how a Project Gutenberg plain-text file looks today. */
const FIXTURE = [
  "﻿The Project Gutenberg eBook of As a Man Thinketh",
  "",
  "This ebook is for the use of anyone anywhere in the United States and",
  "most other parts of the world at no cost and with almost no restrictions",
  "whatsoever.",
  "",
  "Title: As a Man Thinketh",
  "",
  "Author: James Allen",
  "",
  "Release date: December 1, 2003 [eBook #4507]",
  "",
  "Language: English",
  "",
  "*** START OF THE PROJECT GUTENBERG EBOOK AS A MAN THINKETH ***",
  "",
  "Produced by Kirk Pearson",
  "",
  "FOREWORD",
  "",
  "This little volume (the result of meditation and experience) is not",
  "intended as an exhaustive treatise on the much-written-upon subject of",
  "the power of thought.",
  "",
  "    Mind is the Master power that moulds and makes,",
  "    And Man is Mind, and evermore he takes",
  "",
  "*** END OF THE PROJECT GUTENBERG EBOOK AS A MAN THINKETH ***",
  "",
  "Updated editions will replace the previous one--the old editions will",
  "be renamed. START: FULL LICENSE",
].join("\r\n");

describe("library ids and URLs", () => {
  it("takes only plain book numbers", () => {
    expect(bookIdOf("4507")).toBe(4507);
    expect(bookIdOf(11)).toBe(11);
    for (const bad of ["", "0", "01", "-1", "1.5", "1e3", "4507/../x", "https://evil.example/", "1234567", " 12", "12 ", null, undefined, {}, "١٢"])
      expect(bookIdOf(bad)).toBeNull();
  });

  it("builds Gutenberg URLs from the number only, on allowed hosts", () => {
    expect(gutenbergTextUrl(4507)).toBe("https://www.gutenberg.org/cache/epub/4507/pg4507.txt");
    expect(libraryUrlOk(gutenbergTextUrl(4507))).toBe(true);
    expect(libraryUrlOk(gutendexSearchUrl("sherlock holmes", 2))).toBe(true);
    for (const bad of [
      "http://www.gutenberg.org/x",
      "https://gutenberg.org.evil.example/x",
      "https://evil.example/?u=https://www.gutenberg.org",
      "https://user:pw@www.gutenberg.org/x",
      "https://www.gutenberg.org:8443/x",
      "https://169.254.169.254/latest",
      "file:///etc/passwd",
      "not a url",
    ])
      expect(libraryUrlOk(bad)).toBe(false);
  });

  it("cleans search queries and encodes them", () => {
    expect(libraryQuery(null)).toBe("");
    expect(libraryQuery("  sherlock\n holmes ")).toBe("sherlock holmes");
    expect(libraryQuery("x".repeat(81))).toBeNull();
    const u = new URL(gutendexSearchUrl("a&languages=fr#x"));
    expect(u.host).toBe("gutendex.com");
    expect(u.searchParams.get("search")).toBe("a&languages=fr#x");
    expect(u.searchParams.get("languages")).toBeNull();
    expect(u.searchParams.get("copyright")).toBe("false");
    expect(new URL(gutendexSearchUrl("")).searchParams.has("search")).toBe(false);
  });

  it("has unique book numbers on the shelves", () => {
    const ids = LIBRARY_SHELVES.flatMap((s) => s.books.map((x) => x.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(LIBRARY_SHELVES.length).toBeGreaterThanOrEqual(8);
  });
});

describe("splitGutenberg", () => {
  it("cuts the header and licence off and keeps them apart", () => {
    const book = splitGutenberg(FIXTURE, 4507);
    expect(book.title).toBe("As a Man Thinketh");
    expect(book.author).toBe("James Allen");
    expect(book.language).toBe("English");
    expect(book.paragraphs[0]).toBe("FOREWORD");
    expect(book.paragraphs.join("\n")).not.toMatch(/PROJECT GUTENBERG|Produced by|Updated editions/);
    expect(book.paragraphs[1]).toBe(
      "This little volume (the result of meditation and experience) is not intended as an exhaustive treatise on the much-written-upon subject of the power of thought.",
    );
    // Verse keeps its lines.
    expect(book.paragraphs[2]).toContain("\n");
    expect(book.licence).toContain("Title: As a Man Thinketh");
    expect(book.licence).toContain("FULL LICENSE");
  });

  it("handles old files and files without markers", () => {
    const old = splitGutenberg("Header\n*END*THE SMALL PRINT! FOR PUBLIC DOMAIN ETEXTS*Ver.04.29.93*END*\n\nChapter 1\n\nEnd of the Project Gutenberg EBook of X\nlicence", 9);
    expect(old.paragraphs).toEqual(["Chapter 1"]);
    expect(old.title).toBe("Buku #9");
    expect(splitGutenberg("Just text.\n\nMore.", 1).paragraphs).toEqual(["Just text.", "More."]);
  });

  it("joins wrapped prose but keeps short lines", () => {
    expect(toParagraphs("CONTENTS\nChapter I\nChapter II")).toEqual(["CONTENTS\nChapter I\nChapter II"]);
  });
});

describe("paginate", () => {
  const paras = Array.from({ length: 40 }, (_, i) => `Paragraph ${i}. ${"word ".repeat(40)}`.trim());

  it("fills pages up to the size, keeping every character", () => {
    const { pages, starts } = paginate(paras, 1000);
    expect(pages.length).toBeGreaterThan(5);
    expect(starts[0]).toBe(0);
    for (const p of pages) expect(p.join("").length).toBeLessThanOrEqual(1000);
    expect(pages.flat().join(" ").replace(/\s+/g, " ")).toBe(paras.join(" ").replace(/\s+/g, " "));
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("cuts a long paragraph at a sentence or a space", () => {
    const long = "One sentence here. ".repeat(200).trim();
    const { pages } = paginate([long], 500);
    expect(pages.length).toBeGreaterThan(5);
    for (const p of pages.slice(0, -1)) expect(p[0]).toMatch(/\.$/);
  });

  it("finds the page for a saved place, whatever the page size", () => {
    const small = paginate(paras, 600);
    const big = paginate(paras, 2000);
    const pos = small.starts[10]!;
    const at = pageAtPos(big.starts, pos);
    expect(big.starts[at]!).toBeLessThanOrEqual(pos);
    expect(big.starts[at + 1] ?? Infinity).toBeGreaterThan(pos);
    expect(pageAtPos(small.starts, 0)).toBe(0);
    expect(pageAtPos(small.starts, 1e9)).toBe(small.starts.length - 1);
  });

  it("gives one empty page for an empty book", () => {
    expect(paginate([], 1000).pages).toEqual([[""]]);
  });
});

describe("libraryHits", () => {
  it("keeps public-domain plain-text books, safe covers and capped strings", () => {
    const out = libraryHits({
      count: 3,
      next: "https://gutendex.com/books/?page=2",
      results: [
        {
          id: 1342,
          title: "Pride and Prejudice",
          authors: [{ name: "Austen, Jane" }],
          languages: ["en"],
          copyright: false,
          formats: { "text/plain; charset=us-ascii": "https://www.gutenberg.org/x.txt", "image/jpeg": "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg" },
          download_count: 5000,
        },
        { id: 2, title: "Copyrighted", copyright: true, formats: { "text/plain": "x" } },
        { id: 3, title: "No text", copyright: false, formats: { "application/epub+zip": "x" } },
        { id: "4; drop", title: "Bad id", formats: { "text/plain": "x" } },
        { id: 5, title: "x".repeat(500), copyright: null, languages: ["en", "<b>"], formats: { "text/plain": "x", "image/jpeg": "https://evil.example/c.jpg" } },
      ],
    });
    expect(out.more).toBe(true);
    expect(out.results.map((r) => r.id)).toEqual([1342, 5]);
    expect(out.results[0]!.cover).toContain("gutenberg.org");
    expect(out.results[1]!.cover).toBeUndefined();
    expect(out.results[1]!.title.length).toBe(200);
    expect(out.results[1]!.languages).toEqual(["en"]);
    expect(libraryHits("nonsense").results).toEqual([]);
  });
});
