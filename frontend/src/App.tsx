import { useCallback, useMemo } from "react";
import { DetailPanel } from "./components/DetailPanel";
import { Pagination } from "./components/Pagination";
import { TicketList, TicketListSkeleton } from "./components/TicketList";
import { Toolbar } from "./components/Toolbar";
import { filterTickets, paginate, sortTickets } from "./lib/query";
import { useTheme } from "./lib/useTheme";
import { useTickets } from "./lib/useTickets";
import { useUrlQuery } from "./lib/useUrlQuery";

export default function App() {
  const [query, update] = useUrlQuery();
  const [theme, toggleTheme] = useTheme();
  const { tickets, load, reload, mutations, changeStatus, dismissMutation } = useTickets();

  const visible = useMemo(() => sortTickets(filterTickets(tickets, query), query.sort), [tickets, query]);
  const page = paginate(visible, query.page);
  const selected = query.ticket === null ? undefined : tickets.find((t) => t.id === query.ticket);

  const closePanel = useCallback(() => {
    const id = query.ticket;
    update({ ticket: null });
    // Give focus back to the row the user came from.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-ticket-id="${id}"]`)?.focus());
  }, [query.ticket, update]);

  return (
    <div className="app">
      <a className="skip-link" href="#tickets">
        Skip to tickets
      </a>
      <header className="app-header">
        <h1>
          Nordia <span>Support tickets</span>
        </h1>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀ Light" : "☾ Dark"}
        </button>
      </header>

      <Toolbar query={query} onChange={update} />

      <div className={`layout${query.ticket !== null ? " with-panel" : ""}`}>
        <main id="tickets" className="list-area" tabIndex={-1}>
          {load.kind === "loading" && <TicketListSkeleton />}

          {load.kind === "error" && (
            <div className="state state-error" role="alert">
              <p>
                <strong>Could not load the tickets.</strong> {load.message}
              </p>
              <button type="button" className="btn btn-primary" onClick={() => void reload()}>
                Try again
              </button>
            </div>
          )}

          {load.kind === "ready" && (
            <>
              <p className="count" role="status">
                {page.total === tickets.length
                  ? `${page.total} tickets`
                  : `${page.total} of ${tickets.length} tickets match`}
              </p>
              {page.total === 0 ? (
                <div className="state">
                  {tickets.length === 0 ? (
                    <p>There are no tickets yet.</p>
                  ) : (
                    <>
                      <p>No ticket matches these filters.</p>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => update({ q: "", status: "all", priority: "all" })}
                      >
                        Clear filters
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <TicketList
                    tickets={page.items}
                    selectedId={query.ticket}
                    mutations={mutations}
                    onSelect={(id) => update({ ticket: id })}
                  />
                  <Pagination page={page.page} pageCount={page.pageCount} onPage={(p) => update({ page: p })} />
                </>
              )}
            </>
          )}
        </main>

        {query.ticket !== null && load.kind === "ready" && (
          <DetailPanel
            ticketId={query.ticket}
            ticket={selected}
            mutation={mutations[query.ticket]}
            onClose={closePanel}
            onChangeStatus={changeStatus}
            onDismissMutation={dismissMutation}
          />
        )}
      </div>
    </div>
  );
}
