export interface LinkPreviewMetadata {
  title: string;
  icon: string | null;
  domain: string;
}

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 || (octets[0] === 169 && octets[1] === 254) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168);
}

export function isSafeExternalUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return (url.protocol === "http:" || url.protocol === "https:") && hostname !== "localhost" && hostname !== "::1" && !hostname.endsWith(".localhost") && !isPrivateIpv4(hostname) && !hostname.startsWith("fc") && !hostname.startsWith("fd") && !hostname.startsWith("fe80:");
}

export function domainFallback(url: URL) {
  return url.hostname;
}

function htmlAttribute(tag: string, name: string) {
  return new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1] ?? null;
}

export function parseLinkPreviewHtml(html: string, url: URL): Pick<LinkPreviewMetadata, "title" | "icon"> {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const ogTitleTag = metaTags.find((tag) => /(?:property|name)\s*=\s*["']og:title["']/i.test(tag));
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const title = (ogTitleTag ? htmlAttribute(ogTitleTag, "content") : titleTag)?.replace(/\s+/g, " ").trim() || domainFallback(url);
  const iconTag = (html.match(/<link\b[^>]*>/gi) ?? []).find((tag) => /rel\s*=\s*["'][^"']*\b(?:icon|shortcut icon)\b[^"']*["']/i.test(tag));
  const iconHref = iconTag ? htmlAttribute(iconTag, "href") : null;
  return { title, icon: iconHref ? new URL(iconHref, url).toString() : `${url.origin}/favicon.ico` };
}
