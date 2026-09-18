import { describe, expect, it } from "vitest";
import { domainFallback, isSafeExternalUrl, parseLinkPreviewHtml } from "./linkPreview";

describe("link preview helpers", () => {
  it("only permits public http and https URLs", () => {
    expect(isSafeExternalUrl(new URL("https://example.com/page"))).toBe(true);
    expect(isSafeExternalUrl(new URL("mailto:reader@example.com"))).toBe(false);
    expect(isSafeExternalUrl(new URL("http://localhost:3000"))).toBe(false);
    expect(isSafeExternalUrl(new URL("http://127.0.0.1"))).toBe(false);
    expect(isSafeExternalUrl(new URL("http://192.168.1.2"))).toBe(false);
  });

  it("uses Open Graph metadata and resolves a relative favicon", () => {
    const preview = parseLinkPreviewHtml(
      '<meta property="og:title" content="Example title"><link rel="icon" href="/favicon.ico">',
      new URL("https://example.com/page"),
    );
    expect(preview).toEqual({ title: "Example title", icon: "https://example.com/favicon.ico" });
  });

  it("falls back to the domain when metadata is unavailable", () => {
    expect(domainFallback(new URL("https://www.example.com/page"))).toBe("www.example.com");
  });
});
