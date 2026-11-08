import { vi } from "vitest";
import type { Ticket } from "../lib/types";

export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    title: "Login page is slow",
    customer: "Acme",
    requester: "Jane Doe",
    priority: "medium",
    status: "open",
    description: "It takes 10 seconds.",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

type Reply = { status: number; body: unknown };
type Handler = (req: { method: string; path: string; body: unknown }) => Reply | undefined;

/**
 * Stubs global fetch with a tiny in-memory version of the mock API.
 * `failNext` queues forced replies (e.g. a 500) before the normal behaviour kicks in.
 */
export function installFakeApi(initial: Ticket[]) {
  const tickets = initial.map((t) => ({ ...t }));
  const forced: Reply[] = [];
  const overrides: Handler[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const path = url.pathname.replace(/^\/api/, "");

    const reply: Reply =
      forced.shift() ??
      overrides.map((h) => h({ method, path, body })).find(Boolean) ??
      defaultHandler(tickets, method, path, body);
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    fetchMock,
    tickets,
    failNext: (...replies: Reply[]) => forced.push(...replies),
    override: (h: Handler) => overrides.push(h),
  };
}

function defaultHandler(tickets: Ticket[], method: string, path: string, body: unknown): Reply {
  if (method === "GET" && path === "/tickets") return { status: 200, body: tickets };
  const m = path.match(/^\/tickets\/(\d+)$/);
  const ticket = m && tickets.find((t) => t.id === Number(m[1]));
  if (!ticket) return { status: 404, body: { error: "Ticket not found" } };
  if (method === "PATCH") {
    const status = (body as { status: Ticket["status"] }).status;
    if (ticket.status === "resolved" && status === "open")
      return { status: 409, body: { error: "A resolved ticket cannot be reopened" } };
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    return { status: 200, body: ticket };
  }
  return { status: 200, body: ticket };
}

export const SERVER_ERROR: Reply = { status: 500, body: { error: "Simulated server error, please retry" } };
