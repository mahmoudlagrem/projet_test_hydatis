import { PRIORITY_LABELS, STATUS_LABELS, type Priority, type Status } from "../lib/types";

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>;
}

export function StatusBadge({ status, pending = false }: { status: Status; pending?: boolean }) {
  return (
    <span className={`badge status-${status}`}>
      {STATUS_LABELS[status]}
      {pending && (
        <>
          <span className="spinner" aria-hidden="true" />
          <span className="sr-only"> (saving)</span>
        </>
      )}
    </span>
  );
}
