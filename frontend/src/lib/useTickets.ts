import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchTickets, updateTicketStatus } from "./api";
import { STATUS_LABELS, type Status, type Ticket } from "./types";

export type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

/** Per-ticket state of the last status change, shown in the detail panel. */
export type Mutation =
  | { kind: "pending"; target: Status }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string; target: Status; retryable: boolean };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [mutations, setMutations] = useState<Record<number, Mutation>>({});
  const loadController = useRef<AbortController | null>(null);
  // Mirror of the pending ids, readable synchronously (guards against double submits).
  const pending = useRef(new Set<number>());

  const reload = useCallback(async () => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoad({ kind: "loading" });
    try {
      const data = await fetchTickets(controller.signal);
      setTickets(data);
      setLoad({ kind: "ready" });
    } catch (err) {
      if (controller.signal.aborted) return; // superseded by a newer load or unmounted
      setLoad({ kind: "error", message: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => loadController.current?.abort();
  }, [reload]);

  const setMutation = (id: number, m: Mutation | null) =>
    setMutations((all) => {
      const next = { ...all };
      if (m) next[id] = m;
      else delete next[id];
      return next;
    });

  const patchLocal = (id: number, patch: Partial<Ticket> | ((t: Ticket) => Ticket)) =>
    setTickets((all) => all.map((t) => (t.id === id ? (typeof patch === "function" ? patch(t) : { ...t, ...patch }) : t)));

  /**
   * Optimistic update: the new status shows immediately, the API call runs in the background,
   * and on failure we roll back to the previous status and explain why.
   */
  const changeStatus = useCallback(async (ticket: Ticket, target: Status) => {
    if (pending.current.has(ticket.id) || ticket.status === target) return;
    const previous = ticket.status;
    pending.current.add(ticket.id);
    patchLocal(ticket.id, { status: target });
    setMutation(ticket.id, { kind: "pending", target });

    try {
      const saved = await updateTicketStatus(ticket.id, target);
      patchLocal(ticket.id, saved); // server is the source of truth (updatedAt, etc.)
      setMutation(ticket.id, { kind: "success", message: `Status changed to “${STATUS_LABELS[saved.status]}”.` });
    } catch (err) {
      // Only roll back if nothing else changed the ticket meanwhile.
      patchLocal(ticket.id, (t) => (t.status === target ? { ...t, status: previous } : t));
      const reason = errorMessage(err).replace(/\.$/, "");
      setMutation(ticket.id, {
        kind: "error",
        target,
        retryable: err instanceof ApiError ? err.retryable : true,
        message: `Not saved: ${reason}. The status is back to “${STATUS_LABELS[previous]}”.`,
      });
    } finally {
      pending.current.delete(ticket.id);
    }
  }, []);

  const dismissMutation = useCallback((id: number) => setMutation(id, null), []);

  return { tickets, load, reload, mutations, changeStatus, dismissMutation };
}
