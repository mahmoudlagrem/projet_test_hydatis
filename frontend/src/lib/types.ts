export const STATUSES = ["open", "in_progress", "waiting_customer", "resolved"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export interface Ticket {
  id: number;
  title: string;
  customer: string;
  requester: string;
  priority: Priority;
  status: Status;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_customer: "Waiting on customer",
  resolved: "Resolved",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const isStatus = (v: unknown): v is Status => STATUSES.includes(v as Status);
export const isPriority = (v: unknown): v is Priority => PRIORITIES.includes(v as Priority);

/**
 * Business rule mirrored from the API: a resolved ticket cannot go back to "open".
 * The UI uses it to disable that option up front; the API stays the source of truth (409).
 */
export function canTransition(from: Status, to: Status): boolean {
  if (from === to) return false;
  return !(from === "resolved" && to === "open");
}
