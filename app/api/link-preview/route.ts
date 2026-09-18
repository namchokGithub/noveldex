import {
  domainFallback,
  isSafeExternalUrl,
  parseLinkPreviewHtml,
} from "@/libs/linkPreview";

const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 256 * 1024;

async function fetchPreview(url: URL) {
  let current = url;
  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    if (!isSafeExternalUrl(current)) throw new Error("Unsafe URL");
    const response = await fetch(current, {
      redirect: "manual",
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Invalid redirect");
      current = new URL(location, current);
      continue;
    }
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (
      !response.ok ||
      contentLength > MAX_HTML_BYTES ||
      !response.headers.get("content-type")?.includes("text/html")
    )
      throw new Error("No HTML metadata");
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return {
      ...parseLinkPreviewHtml(html, current),
      domain: domainFallback(current),
    };
  }
  throw new Error("Too many redirects");
}

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url");
  if (!rawUrl) return Response.json({ error: "Missing URL" }, { status: 400 });
  let url: URL;
  try {
    url = new URL(rawUrl);
    if (!isSafeExternalUrl(url)) throw new Error("Unsafe URL");
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }
  try {
    const preview = await fetchPreview(url);
    return Response.json(preview, {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return Response.json(
      { title: domainFallback(url), icon: null, domain: domainFallback(url) },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  }
}
