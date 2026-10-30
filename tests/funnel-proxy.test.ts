import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createJudgeIngress, judgeProxyProvider, trustedFunnelOrigin } from "../scripts/lib/funnel-proxy";

const servers: http.Server[] = [];
const publicUrl = "https://judge.tail-demo.ts.net";
async function listen(server: http.Server) {
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  return address.port;
}
async function rawRequest(port: number, pathname: string, headers: http.OutgoingHttpHeaders, method = "GET", body = "") {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: pathname, headers, method }, res => {
      let text = "";
      res.on("data", chunk => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: text }));
    });
    req.on("error", reject); req.end(body);
  });
}
afterEach(async () => {
  for (const server of servers.splice(0).reverse()) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

describe("Funnel ingress boundary", () => {
  it("requires an explicit supported proxy provider", () => {
    expect(judgeProxyProvider()).toBe("tailscale");
    expect(judgeProxyProvider("cloudflare")).toBe("cloudflare");
    expect(() => judgeProxyProvider("arbitrary-proxy")).toThrow();
  });

  it("validates a single Cloudflare hostname without enabling any hostname wildcard", () => {
    const exact = "https://fictional-judge-demo.trycloudflare.com";
    expect(trustedFunnelOrigin(exact, false, "cloudflare").origin).toBe(exact);
    expect(() => trustedFunnelOrigin(exact)).toThrow();
    for (const value of [publicUrl, "https://*.trycloudflare.com", "https://trycloudflare.com",
      "http://fictional-judge-demo.trycloudflare.com", `${exact}:8443`, `${exact}/admin`,
      `${exact}?host=evil`, "https://sub.fictional-judge-demo.trycloudflare.com",
      "https://-judge.trycloudflare.com", "https://judge.trycloudflare.com.evil.invalid",
      "https://user:pass@judge.trycloudflare.com", "https://labloop-preflight.invalid"]) {
      expect(() => trustedFunnelOrigin(value, false, "cloudflare")).toThrow();
    }
    expect(trustedFunnelOrigin("https://labloop-preflight.invalid", true, "cloudflare").host).toBe("labloop-preflight.invalid");
  });

  it("pins Cloudflare Host, ignores spoofed forwarding headers and preserves same-origin Server Actions", async () => {
    const host = "fictional-judge-demo.trycloudflare.com";
    const origin = `https://${host}`;
    let received: { headers: http.IncomingHttpHeaders; body: string } | undefined;
    const upstream = await listen(http.createServer(async (req, res) => {
      let body = ""; for await (const chunk of req) body += chunk;
      received = { headers: req.headers, body };
      res.end("ok");
    }));
    const port = await listen(createJudgeIngress({ publicUrl: origin, provider: "cloudflare", upstreamPort: upstream }));
    expect((await rawRequest(port, "/login", { host: "other.trycloudflare.com", "x-forwarded-host": host })).status).toBe(421);
    expect((await rawRequest(port, "/login", { host, origin: "https://other.trycloudflare.com" }, "POST")).status).toBe(403);
    expect((await rawRequest(port, "/login", { host }, "POST")).status).toBe(403);
    for (const pathname of ["/admin", "/%61dmin", "/api/debug", "/metrics", "/.env.local", "/__nextjs_original-stack-frame"]) {
      expect((await rawRequest(port, pathname, { host })).status).toBe(404);
    }
    expect(received).toBeUndefined();
    const response = await rawRequest(port, "/login", { host, origin, "x-forwarded-host": "evil.invalid",
      "x-forwarded-proto": "http", "cf-access-authenticated-user-email": "spoof@example.invalid",
      "next-action": "fixture-action", "content-type": "text/plain;charset=UTF-8" }, "POST", '["fixture"]');
    expect(response.status).toBe(200);
    expect(received?.body).toBe('["fixture"]');
    expect(received?.headers.host).toBe(host);
    expect(received?.headers["x-forwarded-host"]).toBe(host);
    expect(received?.headers["x-forwarded-proto"]).toBe("https");
    expect(received?.headers["next-action"]).toBe("fixture-action");
    expect(received?.headers["cf-access-authenticated-user-email"]).toBeUndefined();
  });

  it("accepts only exact device HTTPS origins and a separate explicit local preflight", () => {
    expect(trustedFunnelOrigin(publicUrl).host).toBe("judge.tail-demo.ts.net");
    for (const value of ["http://judge.tail-demo.ts.net", "https://*.ts.net", "https://example.com",
      "https://judge.tail-demo.ts.net:8443", `${publicUrl}/admin`, "https://user:password@judge.tail-demo.ts.net",
      "https://labloop-preflight.invalid", "https://..ts.net", "https://-judge.tail.ts.net"]) expect(() => trustedFunnelOrigin(value)).toThrow();
    expect(trustedFunnelOrigin("https://labloop-preflight.invalid", true).host).toBe("labloop-preflight.invalid");
  });

  it("preserves Server Action payload/content type and normalizes proxy headers to one trusted origin", async () => {
    let received: { headers: http.IncomingHttpHeaders; body: string } | undefined;
    const upstream = await listen(http.createServer(async (req, res) => {
      let body = ""; for await (const chunk of req) body += chunk;
      received = { headers: req.headers, body };
      res.setHeader("Set-Cookie", "demo_session=test; Path=/; Secure; HttpOnly; SameSite=Lax");
      res.end("ok");
    }));
    const port = await listen(createJudgeIngress({ publicUrl, upstreamPort: upstream }));
    const result = await fetch(`http://127.0.0.1:${port}/bookings/example`, {
      method: "POST", headers: { Host: "127.0.0.1", Origin: publicUrl,
        "X-Forwarded-Host": "judge.tail-demo.ts.net", "X-Forwarded-Proto": "http",
        "Tailscale-User-Login": "spoofed@example.invalid", "Content-Type": "text/plain;charset=UTF-8",
        "Next-Action": "fixture-action", Cookie: "demo_session=test" }, body: '["fixture"]',
    });
    expect(result.status).toBe(200);
    expect(received?.body).toBe('["fixture"]');
    expect(received?.headers["content-type"]).toBe("text/plain;charset=UTF-8");
    expect(received?.headers["x-forwarded-host"]).toBe("judge.tail-demo.ts.net");
    expect(received?.headers.host).toBe("judge.tail-demo.ts.net");
    expect(received?.headers["x-forwarded-proto"]).toBe("https");
    expect(received?.headers["tailscale-user-login"]).toBeUndefined();
    expect(result.headers.get("set-cookie")).toContain("Secure; HttpOnly; SameSite=Lax");
  });

  it("rejects foreign host/origin and origin-less mutations before the application sees them", async () => {
    let reached = 0;
    const upstream = await listen(http.createServer((_req, res) => { reached++; res.end("unexpected"); }));
    const port = await listen(createJudgeIngress({ publicUrl, upstreamPort: upstream }));
    const target = `http://127.0.0.1:${port}/login`;
    expect((await fetch(target, { headers: { "X-Forwarded-Host": "evil.invalid" } })).status).toBe(421);
    expect((await fetch(target, { method: "POST", headers: { "X-Forwarded-Host": "judge.tail-demo.ts.net", Origin: "https://evil.invalid" } })).status).toBe(403);
    expect((await fetch(target, { method: "POST", headers: { "X-Forwarded-Host": "judge.tail-demo.ts.net" } })).status).toBe(403);
    expect(reached).toBe(0);
  });

  it("blocks administrative/developer/filesystem paths, including encoded traversal", async () => {
    let reached = 0;
    const upstream = await listen(http.createServer((_req, res) => { reached++; res.end("ok"); }));
    const port = await listen(createJudgeIngress({ publicUrl, upstreamPort: upstream }));
    for (const pathname of ["/admin", "/%61dmin", "/resources/%2f..%2fadmin", "/__nextjs_original-stack-frame", "/.env.local", "/api/debug"]) {
      expect((await fetch(`http://127.0.0.1:${port}${pathname}`, { headers: { "X-Forwarded-Host": "judge.tail-demo.ts.net" } })).status).toBe(404);
    }
    expect(reached).toBe(0);
    expect((await fetch(`http://127.0.0.1:${port}/login`, { headers: { "X-Forwarded-Host": "judge.tail-demo.ts.net" } })).status).toBe(200);
    expect(reached).toBe(1);
  });
});
