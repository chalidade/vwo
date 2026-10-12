// Gutenberg's HTML edition cut down to the reader's few tags: nothing that can run, load or link
// survives; the book's chapters, emphasis, verse, tables and own pictures do; the header and footer
// become the licence.
import { readFileSync } from "node:fs";
import { BOOK_TAGS, type BookNode, bookSections, isBookTree, nodeText } from "@vwo/shared";
import { describe, expect, it } from "vitest";
import { BookHtmlError, htmlBook } from "../lib/library-html";

const HTML = readFileSync(new URL("./fixtures/gutenberg-book.html", import.meta.url), "utf8");

/** Every tag and attribute name in a tree, and all its text. */
function walk(nodes: BookNode[], tags = new Set<string>(), keys = new Set<string>()) {
  for (const n of nodes) {
    if (typeof n === "string") continue;
    tags.add(n.t);
    Object.keys(n).forEach((k) => keys.add(k));
    walk(n.c ?? [], tags, keys);
  }
  return { tags, keys };
}

describe("htmlBook", () => {
  const book = htmlBook(HTML, 4507);
  const text = book.blocks.map(nodeText).join("\n");

  it("takes title, author and language from Gutenberg's header", () => {
    expect(book).toMatchObject({ title: "The Test Book", author: "Jane Tester", language: "English" });
  });

  it("keeps only allowlisted tags, and no attribute of the book's but an image's own", () => {
    const { tags, keys } = walk(book.blocks);
    for (const t of tags) expect(BOOK_TAGS as readonly string[]).toContain(t);
    for (const t of ["script", "style", "iframe", "form", "input", "button", "svg", "a", "span", "div", "link", "meta"]) expect(tags.has(t)).toBe(false);
    expect([...keys].sort()).toEqual(["alt", "c", "h", "k", "src", "t", "w"]);
    expect(isBookTree(book.blocks)).toBe(true);
  });

  it("drops scripts, frames, forms, svg and page numbers with everything in them", () => {
    for (const bad of ["alert", "document.cookie", "framed text", "Send", "svg text", "[Pg 2]", "background", "javascript", "evil.example"]) expect(text).not.toContain(bad);
    expect(JSON.stringify(book)).not.toMatch(/javascript:|onclick|onerror|evil\.example|style=/i);
  });

  it("keeps a link's words but not the link", () => {
    expect(text).toContain("A link to nowhere and to elsewhere keeps only its words.");
  });

  it("keeps only pictures in the book's own images folder, as bare jpg, png or gif file names", () => {
    const imgs = book.blocks.filter((b) => typeof b !== "string" && b.t === "img");
    expect(imgs).toEqual([
      { t: "img", src: "cover.jpg", alt: "Cover of the book", w: 400, h: 600 },
      { t: "img", src: "i_002.png", alt: "The storm" },
    ]);
  });

  it("keeps chapters, emphasis, verse lines, quotes, tables, lists and decoded entities", () => {
    expect(book.blocks).toContainEqual({ t: "h2", c: ["CHAPTER I.", { t: "br" }, "The Beginning"] });
    expect(book.blocks).toContainEqual({ t: "p", k: "v", c: ["Roses are red,", { t: "br" }, "Violets are blue."] });
    expect(book.blocks).toContainEqual({ t: "blockquote", c: [{ t: "p", c: ["A quoted letter."] }] });
    expect(book.blocks).toContainEqual({ t: "h4", c: ["A small heading"] });
    expect(book.blocks).toContainEqual({
      t: "ul",
      c: [
        { t: "li", c: ["One"] },
        { t: "li", c: ["Two"] },
      ],
    });
    expect(text).toContain("Fish & chips, café and “quotes”.");
    expect(text).toContain("rain fell in torrents — except");
    const p = book.blocks.find((b) => typeof b !== "string" && nodeText(b).startsWith("It was a"));
    expect(p).toMatchObject({ t: "p", c: ["It was a ", { t: "i", c: ["dark"] }, " and ", { t: "b", c: ["stormy"] }, expect.any(String)] });
    expect(walk(book.blocks).tags).toContain("table");
  });

  it("keeps the header and footer out of the book, as its licence", () => {
    expect(text).not.toContain("START OF THE PROJECT GUTENBERG");
    expect(text).not.toContain("Full licence here");
    expect(book.licence).toContain("Title: The Test Book");
    expect(book.licence).toContain("Full licence here.");
    expect(book.licence).toContain("*** END OF THE PROJECT GUTENBERG EBOOK THE TEST BOOK ***");
  });

  it("starts the cover and every chapter on a section of its own", () => {
    expect(bookSections(book.blocks).map((s) => s.title)).toEqual(["", "THE TEST BOOK", "CHAPTER I. The Beginning", "CHAPTER II."]);
  });

  it("refuses a page with almost nothing in it, so the plain text is used instead", () => {
    expect(() => htmlBook("<html><body><p>Not found</p></body></html>", 1)).toThrow(BookHtmlError);
    expect(() => htmlBook(HTML.replace(/<body>[\s\S]*<\/body>/, "<body><script>x</script></body>"), 1)).toThrow(BookHtmlError);
  });

  it("survives broken and hostile markup", () => {
    const deep = "<div>".repeat(500) + "<p>" + "deep words ".repeat(40) + "</p>";
    expect(nodeText(htmlBook(deep, 1).blocks[0]!)).toContain("deep words");
    const odd = `<p>${"word ".repeat(60)}<img src="images/a.jpg" onload="x()"><script>alert(1)<p>still script</p></script><style><p>css</p></style>`;
    const b = htmlBook(odd, 1);
    expect(JSON.stringify(b.blocks)).not.toMatch(/alert|still script|css|onload/);
    expect(isBookTree(b.blocks)).toBe(true);
  });
});
