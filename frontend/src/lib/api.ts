import { isPriority, isStatus, type Status, type Ticket } from "./types";

export const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 for network failure / timeout */
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
  /** Worth retrying: network errors, timeouts and 5xx. Never 4xx (our request is wrong or refused). */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

interface RequestOptions {
  method?: "GET" | "PATCH";
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function request<T>(path: string, { method = "GET", body, signal, timeoutMs = 8000 }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err; // caller cancelled: propagate as-is, not an API error
    const timedOut = controller.signal.aborted;
    throw new ApiError(timedOut ? "The server took too long to answer." : "Cannot reach the server. Check your connection.", 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const serverMessage =
      data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
    throw new ApiError(serverMessage ?? `Request failed (${res.status}).`, res.status);
  }
  return data as T;
}

/** Retries only retryable errors, with a short linear backoff. Safe for GET and for our idempotent PATCH. */
export async function withRetry<T>(fn: () => Promise<T>, { retries = 2, delayMs = 300 } = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof ApiError) || !err.retryable || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
}

/** Light runtime check: we do not trust the network blindly. Malformed records are dropped, not rendered. */
export function isTicket(v: unknown): v is Ticket {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    Number.isInteger(t.id) &&
    typeof t.title === "string" &&
    typeof t.customer === "string" &&
    typeof t.requester === "string" &&
    typeof t.description === "string" &&
    isPriority(t.priority) &&
    isStatus(t.status) &&
    typeof t.createdAt === "string" &&
    !Number.isNaN(Date.parse(t.createdAt)) &&
    typeof t.updatedAt === "string"
  );
}

export async function fetchTickets(signal?: AbortSignal): Promise<Ticket[]> {
  const data = await withRetry(() => request<unknown>("/tickets", { signal }));
  if (!Array.isArray(data)) throw new ApiError("Unexpected response from the server.", 0);
  return data.filter(isTicket);
}

/**
 * Not retried automatically: the user sees the failure and decides to retry.
 * (Setting a status is idempotent, so a manual retry is always safe.)
 */
export async function updateTicketStatus(id: number, status: Status): Promise<Ticket> {
  const data = await request<unknown>(`/tickets/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } });
  if (!isTicket(data)) throw new ApiError("Unexpected response from the server.", 0);
  return data;
}
