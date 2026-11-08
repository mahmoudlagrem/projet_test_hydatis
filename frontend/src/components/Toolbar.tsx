import { SORTS, SORT_LABELS, type ListQuery, type Sort } from "../lib/query";
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS, type Priority, type Status } from "../lib/types";

interface Props {
  query: ListQuery;
  onChange: (patch: Partial<ListQuery>) => void;
}

export function Toolbar({ query, onChange }: Props) {
  const hasFilters = query.q !== "" || query.status !== "all" || query.priority !== "all";
  return (
    <form className="toolbar" role="search" aria-label="Filter tickets" onSubmit={(e) => e.preventDefault()}>
      <div className="field field-search">
        <label htmlFor="q">Search</label>
        <input
          id="q"
          type="search"
          placeholder="Title, customer, requester or #id"
          value={query.q}
          maxLength={100}
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="status">Status</label>
        <select id="status" value={query.status} onChange={(e) => onChange({ status: e.target.value as Status | "all" })}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="priority">Priority</label>
        <select
          id="priority"
          value={query.priority}
          onChange={(e) => onChange({ priority: e.target.value as Priority | "all" })}
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="sort">Sort by</label>
        <select id="sort" value={query.sort} onChange={(e) => onChange({ sort: e.target.value as Sort })}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      {hasFilters && (
        <button type="button" className="btn btn-ghost" onClick={() => onChange({ q: "", status: "all", priority: "all" })}>
          Clear filters
        </button>
      )}
    </form>
  );
}
