import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { installFakeApi, makeTicket, SERVER_ERROR } from "./test/fakeApi";

const TICKETS = [
  makeTicket({ id: 1, title: "Export broken", customer: "Eclipse Media", priority: "low", status: "open" }),
  makeTicket({ id: 2, title: "Login slow", customer: "Cobalt Bank", priority: "urgent", status: "resolved" }),
  makeTicket({ id: 3, title: "Invoice wrong", customer: "Cobalt Bank", priority: "high", status: "in_progress" }),
];

const statusGroup = () => within(screen.getByRole("group", { name: "Change status" }));

describe("App", () => {
  it("shows a loading state, then the list", async () => {
    installFakeApi(TICKETS);
    render(<App />);
    expect(screen.getByText("Loading tickets…")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Export broken" })).toBeInTheDocument();
    expect(screen.getByText("3 tickets")).toBeInTheDocument();
  });

  it("shows an error state with a working retry when the API keeps failing", async () => {
    const api = installFakeApi(TICKETS);
    api.failNext(SERVER_ERROR, SERVER_ERROR, SERVER_ERROR); // exhausts the automatic retries
    render(<App />);
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent("Could not load the tickets");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Login slow" })).toBeInTheDocument();
  });

  it("filters from the toolbar, keeps filters in the URL, and shows an empty state", async () => {
    installFakeApi(TICKETS);
    render(<App />);
    await screen.findByRole("button", { name: "Export broken" });

    await userEvent.selectOptions(screen.getByLabelText("Priority"), "urgent");
    expect(screen.getByText("1 of 3 tickets match")).toBeInTheDocument();
    expect(window.location.search).toBe("?priority=urgent");

    await userEvent.type(screen.getByLabelText("Search"), "nothing like this");
    expect(screen.getByText("No ticket matches these filters.")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(screen.getByText("3 tickets")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("restores filters and the open ticket from a shared URL", async () => {
    installFakeApi(TICKETS);
    window.history.replaceState(null, "", "/?q=cobalt&ticket=3");
    render(<App />);
    expect(await screen.findByRole("heading", { level: 2, name: "Invoice wrong" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toHaveValue("cobalt");
    expect(screen.getByText("2 of 3 tickets match")).toBeInTheDocument();
  });

  it("changes a status optimistically and confirms it", async () => {
    const api = installFakeApi(TICKETS);
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Export broken" }));

    await userEvent.click(statusGroup().getByRole("button", { name: "Waiting on customer" }));
    // Immediate feedback, before the server answers
    expect(statusGroup().getByRole("button", { name: "Waiting on customer" })).toHaveAttribute("aria-pressed", "true");

    expect(await screen.findByText("Status changed to “Waiting on customer”.")).toBeInTheDocument();
    expect(api.tickets[0].status).toBe("waiting_customer");
  });

  it("rolls back and explains when the server fails, then succeeds on retry", async () => {
    const api = installFakeApi(TICKETS);
    render(<App />);
    await screen.findByRole("button", { name: "Export broken" });
    api.failNext(SERVER_ERROR);
    await userEvent.click(screen.getByRole("button", { name: "Export broken" }));
    await userEvent.click(statusGroup().getByRole("button", { name: "Resolved" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Not saved: Simulated server error, please retry. The status is back to “Open”.");
    expect(statusGroup().getByRole("button", { name: "Open" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Status changed to “Resolved”.")).toBeInTheDocument();
  });

  it("handles the API refusing to reopen a resolved ticket (409)", async () => {
    // The UI disables "Open" for resolved tickets, but the server can still refuse
    // (e.g. a colleague resolved it meanwhile): simulate that race.
    const api = installFakeApi(TICKETS);
    api.override(({ method }) =>
      method === "PATCH" ? { status: 409, body: { error: "A resolved ticket cannot be reopened" } } : undefined,
    );
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Invoice wrong" }));
    await userEvent.click(statusGroup().getByRole("button", { name: "Open" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("A resolved ticket cannot be reopened");
    expect(within(alert).queryByRole("button", { name: "Retry" })).not.toBeInTheDocument(); // retrying would fail again
    expect(statusGroup().getByRole("button", { name: "In progress" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not offer to reopen a resolved ticket", async () => {
    installFakeApi(TICKETS);
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Login slow" }));
    expect(statusGroup().getByRole("button", { name: "Open" })).toBeDisabled();
    expect(statusGroup().getByRole("button", { name: "In progress" })).toBeEnabled();
  });

  it("works with the keyboard: Enter opens the panel, Escape closes it and focus returns to the row", async () => {
    installFakeApi(TICKETS);
    render(<App />);
    const row = await screen.findByRole("button", { name: "Export broken" });
    row.focus();
    await userEvent.keyboard("{Enter}");

    const heading = screen.getByRole("heading", { level: 2, name: "Export broken" });
    expect(heading).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Export broken" })).toHaveFocus());
  });
});
