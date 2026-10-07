import { createServer } from "node:http";
import { createDb } from "@vwo/db";
import { createRealtimeServer } from "./server";

const port = Number(process.env.REALTIME_PORT ?? 4001);
const { db } = createDb();
const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404).end();
});
createRealtimeServer(http, db, { corsOrigin: process.env.WEB_ORIGIN ?? "*" });
http.listen(port, () => console.log(`realtime listening on :${port}`));
