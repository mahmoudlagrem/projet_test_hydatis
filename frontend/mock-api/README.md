# Mock API for the "Support tickets" case study

Requires Node.js 18 or later. No installation needed.

```
node server.js
```

The API listens on http://localhost:3001.

| Route | Description |
|---|---|
| `GET /tickets` | all tickets |
| `GET /tickets/:id` | one ticket |
| `PATCH /tickets/:id` | change the status, body `{ "status": "open" | "in_progress" | "waiting_customer" | "resolved" }` |

On purpose, the server answers slowly (150 to 900 ms), fails with a 500 on about 1 call in 8, and refuses to reopen a resolved ticket (409). Data lives in memory: restart the server to reset it. Ticket fields: `id, title, customer, requester, priority (low|medium|high|urgent), status, description, createdAt, updatedAt`.
