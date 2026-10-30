import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createJudgeIngress, trustedFunnelOrigin } from "../scripts/lib/funnel-proxy";

const servers: http.Server[] = [];
const publicUrl = "https://judge.tail-demo.ts.net";
async function listen(server: http.Server) {
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  return address.port;
}
afterEach(async () => {
  for (const server of servers.splice(0).reverse()) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

describe("Funnel ingress boundary", () => {
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
