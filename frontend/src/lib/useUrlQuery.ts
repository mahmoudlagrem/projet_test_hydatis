import { useCallback, useEffect, useState } from "react";
import { parseQuery, serializeQuery, type ListQuery } from "./query";

/**
 * The URL is the single source of truth for filters, sort, page and the open ticket,
 * so any view can be shared or bookmarked. replaceState: typing in the search box
 * should not flood the browser history.
 */
export function useUrlQuery() {
  const [query, setQuery] = useState<ListQuery>(() => parseQuery(window.location.search));

  useEffect(() => {
    const onPop = () => setQuery(parseQuery(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const update = useCallback((patch: Partial<ListQuery>) => {
    setQuery((current) => {
      // Changing what is listed sends you back to page 1.
      const resetsPage = ["q", "status", "priority", "sort"].some((k) => k in patch);
      const next = { ...current, ...(resetsPage ? { page: 1 } : null), ...patch };
      const url = `${window.location.pathname}${serializeQuery(next)}${window.location.hash}`;
      window.history.replaceState(null, "", url);
      return next;
    });
  }, []);

  return [query, update] as const;
}
