// Mock API for the Frontend case study. Node.js 18+, no dependency.
//   node server.js            (listens on http://localhost:3001)
// Routes: GET /tickets, GET /tickets/:id, PATCH /tickets/:id   body: { "status": "open|in_progress|waiting_customer|resolved" }
// Behaviour on purpose: random latency (150-900 ms), about 1 call in 8 fails with a 500, and a resolved ticket cannot be
// moved back to "open" (409). Data lives in memory: restarting the server resets it.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3001);
const STATUSES = ["open", "in_progress", "waiting_customer", "resolved"];
const tickets = JSON.parse(fs.readFileSync(path.join(__dirname, "tickets.json"), "utf8"));

function send(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const delay = 150 + Math.floor(Math.random() * 750);
  setTimeout(() => {
    if (Math.random() < 1 / 8) return send(res, 500, { error: "Simulated server error, please retry" });
    const url = new URL(req.url, "http://localhost");
    const m = url.pathname.match(/^\/tickets(?:\/(\d+))?$/);
    if (!m) return send(res, 404, { error: "Not found" });
    const id = m[1] ? Number(m[1]) : null;
    if (req.method === "GET" && id === null) return send(res, 200, tickets);
    const ticket = id === null ? null : tickets.find((t) => t.id === id);
    if (req.method === "GET") return ticket ? send(res, 200, ticket) : send(res, 404, { error: "Ticket not found" });
    if (req.method === "PATCH" && ticket) {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        let body = {};
        try { body = JSON.parse(raw || "{}"); } catch { return send(res, 400, { error: "Invalid JSON" }); }
        if (!STATUSES.includes(body.status)) return send(res, 400, { error: "Invalid status" });
        if (ticket.status === "resolved" && body.status === "open") return send(res, 409, { error: "A resolved ticket cannot be reopened" });
        ticket.status = body.status;
        ticket.updatedAt = new Date().toISOString();
        send(res, 200, ticket);
      });
      return;
    }
    send(res, ticket === undefined || ticket === null ? 404 : 405, { error: "Not found or method not allowed" });
  }, delay);
});
server.listen(PORT, () => console.log("Mock API on http://localhost:" + PORT + "/tickets"));
