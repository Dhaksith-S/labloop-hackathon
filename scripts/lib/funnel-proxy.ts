import http from "node:http";
import path from "node:path";

export function trustedFunnelOrigin(value: string, localPreflight = false): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.port || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash ||
      !/^[a-z0-9.-]+$/.test(url.hostname) ||
      !(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+ts\.net$/.test(url.hostname) ||
        (localPreflight && url.hostname === "labloop-preflight.invalid"))) {
    throw new Error("Use the exact device HTTPS .ts.net origin, without port, path or wildcards.");
  }
  return url;
}

function safePath(rawUrl: string): string {
  let pathname = new URL(rawUrl, "http://local.invalid").pathname;
  for (let n = 0; n < 4; n++) {
    const decoded = decodeURIComponent(pathname);
    if (decoded === pathname) break;
    pathname = decoded;
  }
  if (/[\\\u0000-\u0020\u007f%]/.test(pathname)) throw new Error("Invalid URL path.");
  return path.posix.normalize(pathname);
}

/** A single fixed loopback upstream; never a file server or an arbitrary URL proxy. */
export function createJudgeIngress(options: {
  publicUrl: string; upstreamPort: number; localPreflight?: boolean;
}): http.Server {
  const origin = trustedFunnelOrigin(options.publicUrl, options.localPreflight);
  if (!Number.isInteger(options.upstreamPort) || options.upstreamPort < 1 || options.upstreamPort > 65535) {
    throw new Error("Invalid loopback upstream port.");
  }
  const allowedRoots = new Set(["resources", "how-it-works", "login", "signup", "dashboard",
    "bookings", "activity", "notifications", "profile", "owner", "favicon.ico"]);
  return http.createServer({ headersTimeout: 15_000, requestTimeout: 30_000 }, async (req, res) => {
    const reject = (code: number, message: string) => {
      res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      res.end(message);
    };
    // Tailscale overwrites X-Forwarded-Host with the real public Host. Only the
    // exact configured host is accepted here, then rewritten before Next sees it.
    const forwardedHost = req.headers["x-forwarded-host"];
    const incomingHost = forwardedHost ?? req.headers.host;
    if (incomingHost !== origin.host) return reject(421, "Unrecognized demo hostname.");
    if (!["GET", "HEAD", "POST"].includes(req.method ?? "")) return reject(405, "Method not allowed.");
    if (req.headers.origin && req.headers.origin !== origin.origin) {
      return reject(403, "Untrusted request origin.");
    }
    if (req.method === "POST" && req.headers.origin !== origin.origin) {
      return reject(403, "A same-origin request is required.");
    }
    let pathname: string;
    try { pathname = safePath(req.url ?? "/"); } catch { return reject(400, "Invalid request path."); }
    const root = pathname.split("/")[1];
    if (pathname !== "/" && !allowedRoots.has(root) && !pathname.startsWith("/_next/static/")) {
      return reject(404, "Not found.");
    }
    const maxBody = 1024 * 1024;
    if (Number(req.headers["content-length"] ?? 0) > maxBody) {
      req.resume(); return reject(413, "Request body too large.");
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    try {
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > maxBody) return reject(413, "Request body too large.");
        chunks.push(Buffer.from(chunk));
      }
    } catch { if (!res.headersSent) reject(400, "Incomplete request."); return; }
    const body = Buffer.concat(chunks);
    const headers = { ...req.headers };
    for (const key of Object.keys(headers)) {
      if (key.startsWith("x-forwarded-") || key.startsWith("tailscale-") ||
          ["forwarded", "connection", "transfer-encoding", "upgrade", "proxy-authorization", "proxy-connection"].includes(key)) {
        delete headers[key];
      }
    }
    headers.host = origin.host;
    headers["x-forwarded-host"] = origin.host;
    headers["x-forwarded-proto"] = "https";
    if (req.method === "POST") headers["content-length"] = String(body.length);
    const upstream = http.request({ hostname: "127.0.0.1", port: options.upstreamPort,
      path: req.url, method: req.method, headers, timeout: 30_000 }, response => {
      const responseHeaders = { ...response.headers };
      delete responseHeaders["x-powered-by"];
      responseHeaders["strict-transport-security"] = "max-age=86400";
      responseHeaders["content-security-policy"] = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
      res.writeHead(response.statusCode ?? 502, responseHeaders);
      response.pipe(res);
    });
    upstream.on("timeout", () => upstream.destroy(new Error("Upstream timeout")));
    upstream.on("error", () => { if (!res.headersSent) reject(502, "Demo application unavailable."); else res.destroy(); });
    res.on("close", () => { if (!res.writableEnded) upstream.destroy(); });
    upstream.end(body);
  });
}
