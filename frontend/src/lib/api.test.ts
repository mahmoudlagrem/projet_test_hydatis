import { describe, expect, it } from "vitest";
import { installFakeApi, makeTicket, SERVER_ERROR } from "../test/fakeApi";
import { ApiError, fetchTickets, updateTicketStatus } from "./api";

describe("api client", () => {
  it("retries GET /tickets after a 500 and succeeds", async () => {
    const api = installFakeApi([makeTicket()]);
    api.failNext(SERVER_ERROR);
    const tickets = await fetchTickets();
    expect(tickets).toHaveLength(1);
    expect(api.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 attempts and surfaces the server message", async () => {
    const api = installFakeApi([makeTicket()]);
    api.failNext(SERVER_ERROR, SERVER_ERROR, SERVER_ERROR);
    await expect(fetchTickets()).rejects.toMatchObject({ status: 500, message: "Simulated server error, please retry" });
    expect(api.fetchMock).toHaveBeenCalledTimes(3);
  });

  it("drops malformed records instead of rendering them", async () => {
    installFakeApi([makeTicket({ id: 1 }), { ...makeTicket({ id: 2 }), status: "deleted" } as never]);
    expect((await fetchTickets()).map((t) => t.id)).toEqual([1]);
  });

  it("reports a 409 as a non-retryable ApiError and does not retry it", async () => {
    const api = installFakeApi([makeTicket({ id: 5, status: "resolved" })]);
    const error = await updateTicketStatus(5, "open").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, retryable: false });
    expect(api.fetchMock).toHaveBeenCalledTimes(1);
    expect(api.fetchMock.mock.calls[0][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ status: "open" }) });
  });
});
