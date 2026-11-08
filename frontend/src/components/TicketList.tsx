import { formatDate } from "../lib/format";
import type { Ticket } from "../lib/types";
import type { Mutation } from "../lib/useTickets";
import { PriorityBadge, StatusBadge } from "./Badges";

interface Props {
  tickets: Ticket[];
  selectedId: number | null;
  mutations: Record<number, Mutation>;
  onSelect: (id: number) => void;
}

/**
 * A real <table> (good for screen readers and wide screens), restyled as cards on mobile.
 * Each row has exactly one focusable element, the title button, so Tab moves ticket by ticket.
 */
export function TicketList({ tickets, selectedId, mutations, onSelect }: Props) {
  return (
    <table className="tickets">
      <caption className="sr-only">Support tickets</caption>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Title</th>
          <th scope="col">Customer</th>
          <th scope="col">Priority</th>
          <th scope="col">Status</th>
          <th scope="col">Created</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((t) => (
          <tr
            key={t.id}
            className={t.id === selectedId ? "selected" : undefined}
            onClick={() => onSelect(t.id)} // mouse convenience; keyboard users use the button
          >
            <td className="col-id">#{t.id}</td>
            <td className="col-title">
              <button
                type="button"
                className="link"
                data-ticket-id={t.id}
                aria-current={t.id === selectedId ? "true" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(t.id);
                }}
              >
                {t.title}
              </button>
            </td>
            <td className="col-customer" data-label="Customer">
              {t.customer}
            </td>
            <td data-label="Priority">
              <PriorityBadge priority={t.priority} />
            </td>
            <td data-label="Status">
              <StatusBadge status={t.status} pending={mutations[t.id]?.kind === "pending"} />
            </td>
            <td className="col-date" data-label="Created">
              <time dateTime={t.createdAt}>{formatDate(t.createdAt)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TicketListSkeleton() {
  return (
    <div className="skeleton" aria-busy="true">
      <p className="sr-only" role="status">
        Loading tickets…
      </p>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="skeleton-row" aria-hidden="true" />
      ))}
    </div>
  );
}
