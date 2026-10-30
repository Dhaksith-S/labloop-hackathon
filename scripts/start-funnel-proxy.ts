import { createJudgeIngress } from "./lib/funnel-proxy";

const server = createJudgeIngress({
  publicUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  upstreamPort: Number(process.env.PORT ?? "3210"),
  localPreflight: process.env.LABLOOP_FUNNEL_PREFLIGHT === "1",
});
server.listen(Number(process.env.LABLOOP_INGRESS_PORT ?? "3211"), "127.0.0.1", () => {
  console.log("Judge ingress listening on loopback only; exact origin enforced; administrative and developer paths blocked.");
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close());
