import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import {
  synchronize,
  nextDailySync,
  shouldSync,
} from "../src/application/synchronize.js";
import { ApplePriceSource } from "./infrastructure/apple.js";
import { FrankfurterSource } from "./infrastructure/frankfurter.js";
import { FileCatalogStore } from "./infrastructure/store.js";

const port = Number(process.env.PORT ?? 3000);
const hour = Number(process.env.SYNC_HOUR_KST ?? 9);
if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535 ||
  !Number.isInteger(hour) ||
  hour < 0 ||
  hour > 23
)
  throw new Error("PORT 또는 SYNC_HOUR_KST 설정이 올바르지 않습니다.");
const store = new FileCatalogStore(process.env.DATA_DIR ?? "./data");
let snapshot = await store.read();
let syncing = false;
let stopping = false;
let syncJob: Promise<void> | null = null;
const staticRoot = resolve("dist");
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://store.storeimages.cdn-apple.com https://www.apple.com; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (!["GET", "HEAD"].includes(request.method ?? "")) {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }
    if (url.pathname === "/api/health") {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(
        JSON.stringify({
          status: "ok",
          ready: snapshot.products.length > 0 && Boolean(snapshot.exchangeRate),
          syncing,
        }),
      );
      return;
    }
    if (url.pathname === "/api/catalog") {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=30",
      });
      response.end(
        JSON.stringify({
          ...snapshot,
          syncing,
          nextSyncAt: nextDailySync(
            new Date(),
            hour,
            snapshot.attemptedAt,
          ).toISOString(),
        }),
      );
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      response.writeHead(404);
      response.end();
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const file = resolve(
      staticRoot,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(staticRoot + sep)) {
      response.writeHead(404);
      response.end();
      return;
    }
    const content = await readFile(file);
    response.writeHead(200, {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      "Cache-Control": pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    response.writeHead(missing ? 404 : 400, {
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end(
      missing ? "페이지를 찾을 수 없습니다." : "요청을 처리할 수 없습니다.",
    );
  }
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.maxHeadersCount = 30;

function updateIfDue() {
  if (syncing || stopping) return;
  const now = new Date();
  if (!shouldSync(now, snapshot.attemptedAt, hour)) return;
  syncing = true;
  syncJob = (async () => {
    try {
      snapshot = { ...snapshot, attemptedAt: now.toISOString() };
      await store.write(snapshot);
      snapshot = await synchronize(
        store,
        new ApplePriceSource(),
        new FrankfurterSource(),
        now,
      );
      console.log(
        JSON.stringify({
          event: "sync",
          products: snapshot.products.length,
          issues: snapshot.issues.length,
        }),
      );
    } catch (error) {
      console.error(
        "데이터 갱신 실패",
        error instanceof Error ? error.message : "알 수 없는 오류",
      );
      snapshot = {
        ...snapshot,
        issues: [
          {
            source: "Storage",
            message: "갱신을 완료하지 못했습니다. 마지막 확인값을 표시합니다.",
          },
        ],
      };
    } finally {
      syncing = false;
    }
  })();
}
server.listen(port, "0.0.0.0", () => {
  console.log(`http://localhost:${port}`);
  updateIfDue();
});
const timer = setInterval(updateIfDue, 30_000);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
    clearInterval(timer);
    server.close();
    void Promise.resolve(syncJob).finally(() => process.exit(0));
    setTimeout(() => process.exit(1), 25_000).unref();
  });
