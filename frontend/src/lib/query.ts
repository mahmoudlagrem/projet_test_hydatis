import { PRIORITIES, isPriority, isStatus, type Priority, type Status, type Ticket } from "./types";

export const SORTS = ["date_desc", "date_asc", "priority_desc", "priority_asc"] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  date_desc: "Newest first",
  date_asc: "Oldest first",
  priority_desc: "Priority: urgent first",
  priority_asc: "Priority: low first",
};

export const PAGE_SIZE = 15;

/** Everything that describes "what the user is looking at". Serialised into the URL. */
export interface ListQuery {
  q: string;
  status: Status | "all";
  priority: Priority | "all";
  sort: Sort;
  page: number;
  ticket: number | null; // ticket open in the detail panel
}

export const DEFAULT_QUERY: ListQuery = {
  q: "",
  status: "all",
  priority: "all",
  sort: "date_desc",
  page: 1,
  ticket: null,
};

const PRIORITY_RANK: Record<Priority, number> = Object.fromEntries(
  PRIORITIES.map((p, i) => [p, i]),
) as Record<Priority, number>;

/** Lower-case and strip accents so "eclipse" matches "Éclipse". */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filterTickets(tickets: Ticket[], q: Pick<ListQuery, "q" | "status" | "priority">): Ticket[] {
  const needle = normalize(q.q.trim());
  return tickets.filter((t) => {
    if (q.status !== "all" && t.status !== q.status) return false;
    if (q.priority !== "all" && t.priority !== q.priority) return false;
    if (!needle) return true;
    // "#12" or "12" also finds ticket 12
    if (/^#?\d+$/.test(needle) && String(t.id) === needle.replace("#", "")) return true;
    return normalize(`${t.title} ${t.customer} ${t.requester}`).includes(needle);
  });
}

const time = (t: Ticket) => Date.parse(t.createdAt);

export function sortTickets(tickets: Ticket[], sort: Sort): Ticket[] {
  const byDateDesc = (a: Ticket, b: Ticket) => time(b) - time(a) || b.id - a.id;
  const copy = [...tickets];
  switch (sort) {
    case "date_desc":
      return copy.sort(byDateDesc);
    case "date_asc":
      return copy.sort((a, b) => -byDateDesc(a, b));
    // Within the same priority, newest first: the most useful tie-breaker for a support queue.
    case "priority_desc":
      return copy.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || byDateDesc(a, b));
    case "priority_asc":
      return copy.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDateDesc(a, b));
  }
}

export interface Page<T> {
  items: T[];
  page: number; // clamped to [1, pageCount]
  pageCount: number;
  total: number;
}

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pageCount,
    total: items.length,
  };
}

/**
 * URL <-> query. Anything unknown or malformed in the URL falls back to the default:
 * the address bar is user input and must never crash the app.
 */
export function parseQuery(search: string): ListQuery {
  const p = new URLSearchParams(search);
  const status = p.get("status");
  const priority = p.get("priority");
  const sort = p.get("sort");
  const page = Number(p.get("page"));
  const ticket = Number(p.get("ticket"));
  return {
    q: (p.get("q") ?? "").slice(0, 100),
    status: isStatus(status) ? status : "all",
    priority: isPriority(priority) ? priority : "all",
    sort: SORTS.includes(sort as Sort) ? (sort as Sort) : DEFAULT_QUERY.sort,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    ticket: Number.isInteger(ticket) && ticket > 0 ? ticket : null,
  };
}

export function serializeQuery(query: ListQuery): string {
  const p = new URLSearchParams();
  (Object.keys(DEFAULT_QUERY) as (keyof ListQuery)[]).forEach((key) => {
    const value = query[key];
    if (value !== DEFAULT_QUERY[key] && value !== null && value !== "") p.set(key, String(value));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}
