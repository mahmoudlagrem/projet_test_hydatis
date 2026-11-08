import { describe, expect, it } from "vitest";
import { makeTicket } from "../test/fakeApi";
import { DEFAULT_QUERY, filterTickets, paginate, parseQuery, serializeQuery, sortTickets } from "./query";

const tickets = [
  makeTicket({ id: 1, title: "Export broken", customer: "Éclipse Media", priority: "low", status: "open", createdAt: "2026-09-01T00:00:00Z" }),
  makeTicket({ id: 2, title: "Login slow", customer: "Cobalt Bank", priority: "urgent", status: "resolved", createdAt: "2026-09-03T00:00:00Z" }),
  makeTicket({ id: 3, title: "Invoice wrong", customer: "Cobalt Bank", priority: "urgent", status: "open", createdAt: "2026-09-05T00:00:00Z" }),
  makeTicket({ id: 12, title: "Dark theme", customer: "Granit", priority: "high", status: "in_progress", createdAt: "2026-09-02T00:00:00Z" }),
];
const ids = (list: { id: number }[]) => list.map((t) => t.id);

describe("filterTickets", () => {
  it("combines status and priority filters", () => {
    expect(ids(filterTickets(tickets, { q: "", status: "open", priority: "urgent" }))).toEqual([3]);
  });

  it("searches title, customer and requester, ignoring case and accents", () => {
    expect(ids(filterTickets(tickets, { q: "eclipse", status: "all", priority: "all" }))).toEqual([1]);
    expect(ids(filterTickets(tickets, { q: "  COBALT ", status: "all", priority: "all" }))).toEqual([2, 3]);
  });

  it("finds a ticket by its id, with or without #", () => {
    expect(ids(filterTickets(tickets, { q: "#12", status: "all", priority: "all" }))).toEqual([12]);
    expect(ids(filterTickets(tickets, { q: "12", status: "all", priority: "all" }))).toEqual([12]);
  });
});

describe("sortTickets", () => {
  it("sorts by date both ways", () => {
    expect(ids(sortTickets(tickets, "date_desc"))).toEqual([3, 2, 12, 1]);
    expect(ids(sortTickets(tickets, "date_asc"))).toEqual([1, 12, 2, 3]);
  });

  it("sorts by business priority (not alphabetically), newest first on ties", () => {
    expect(ids(sortTickets(tickets, "priority_desc"))).toEqual([3, 2, 12, 1]);
    expect(ids(sortTickets(tickets, "priority_asc"))).toEqual([1, 12, 3, 2]);
  });

  it("does not mutate its input", () => {
    const copy = [...tickets];
    sortTickets(tickets, "date_asc");
    expect(tickets).toEqual(copy);
  });
});

describe("paginate", () => {
  it("clamps an out-of-range page instead of showing an empty page", () => {
    const p = paginate([1, 2, 3, 4, 5], 99, 2);
    expect(p).toEqual({ items: [5], page: 3, pageCount: 3, total: 5 });
  });
});

describe("URL query", () => {
  it("round-trips a query through the URL", () => {
    const q = { q: "cobalt bank", status: "open", priority: "urgent", sort: "priority_desc", page: 2, ticket: 7 } as const;
    expect(parseQuery(serializeQuery(q))).toEqual(q);
  });

  it("keeps the URL short when everything is default", () => {
    expect(serializeQuery(DEFAULT_QUERY)).toBe("");
  });

  it("falls back to defaults on invalid or hostile values", () => {
    expect(parseQuery("?status=deleted&priority=<script>&sort=x&page=-3&ticket=abc")).toEqual(DEFAULT_QUERY);
  });
});
