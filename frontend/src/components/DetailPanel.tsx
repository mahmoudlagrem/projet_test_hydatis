import { useEffect, useRef } from "react";
import { formatDateTime } from "../lib/format";
import { STATUSES, STATUS_LABELS, canTransition, type Status, type Ticket } from "../lib/types";
import type { Mutation } from "../lib/useTickets";
import { PriorityBadge, StatusBadge } from "./Badges";

interface Props {
  ticketId: number;
  ticket: Ticket | undefined;
  mutation: Mutation | undefined;
  onClose: () => void;
  onChangeStatus: (ticket: Ticket, status: Status) => void;
  onDismissMutation: (id: number) => void;
}

export function DetailPanel({ ticketId, ticket, mutation, onClose, onChangeStatus, onDismissMutation }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus into the panel when it opens or switches ticket, so keyboard and screen reader users follow.
  useEffect(() => {
    headingRef.current?.focus();
  }, [ticketId]);

  // Success messages fade on their own; errors stay until dismissed or retried.
  useEffect(() => {
    if (mutation?.kind !== "success") return;
    const timer = setTimeout(() => onDismissMutation(ticketId), 4000);
    return () => clearTimeout(timer);
  }, [mutation, ticketId, onDismissMutation]);

  const pending = mutation?.kind === "pending";

  return (
    <aside
      className="panel"
      aria-labelledby="panel-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="panel-header">
        <h2 id="panel-title" tabIndex={-1} ref={headingRef}>
          {ticket ? ticket.title : `Ticket #${ticketId}`}
        </h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close ticket details">
          ✕
        </button>
      </div>

      {!ticket ? (
        <p className="state">This ticket does not exist or is no longer available.</p>
      ) : (
        <>
          <dl className="meta">
            <div>
              <dt>Ticket</dt>
              <dd>#{ticket.id}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{ticket.customer}</dd>
            </div>
            <div>
              <dt>Requester</dt>
              <dd>{ticket.requester}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>
                <PriorityBadge priority={ticket.priority} />
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={ticket.status} pending={pending} />
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>
                <time dateTime={ticket.createdAt}>{formatDateTime(ticket.createdAt)}</time>
              </dd>
            </div>
            <div>
              <dt>Last update</dt>
              <dd>
                <time dateTime={ticket.updatedAt}>{formatDateTime(ticket.updatedAt)}</time>
              </dd>
            </div>
          </dl>

          <h3>Description</h3>
          <p className="description">{ticket.description}</p>

          {/* Not `disabled` while saving: disabling the focused button would throw keyboard focus
              back to <body>. Double submits are blocked in useTickets instead. */}
          <fieldset className="status-picker" aria-busy={pending}>
            <legend>Change status</legend>
            <div className="status-buttons">
              {STATUSES.map((s) => {
                const current = s === ticket.status;
                const allowed = current || canTransition(ticket.status, s);
                return (
                  <button
                    key={s}
                    type="button"
                    className={`btn status-btn${current ? " current" : ""}`}
                    aria-pressed={current}
                    disabled={!allowed}
                    title={allowed ? undefined : "A resolved ticket cannot be reopened"}
                    onClick={() => !current && onChangeStatus(ticket, s)}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
            {ticket.status === "resolved" && (
              <p className="hint">A resolved ticket cannot be reopened. It can still be moved to another status.</p>
            )}
          </fieldset>

          {/* Always in the DOM so screen readers announce changes. */}
          <div className="feedback" aria-live="polite">
            {mutation?.kind === "pending" && <p className="msg">Saving “{STATUS_LABELS[mutation.target]}”…</p>}
            {mutation?.kind === "success" && <p className="msg msg-success">{mutation.message}</p>}
          </div>
          {mutation?.kind === "error" && (
            <div className="msg msg-error" role="alert">
              <p>{mutation.message}</p>
              <div className="msg-actions">
                {mutation.retryable && (
                  <button type="button" className="btn" onClick={() => onChangeStatus(ticket, mutation.target)}>
                    Retry
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => onDismissMutation(ticket.id)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
