import "server-only";
import type { FairApplicationRow } from "@vwo/db";
import type { FairApplicationOut } from "@vwo/shared";

/** Accounts that run the event. Until companies have their own accounts, only they see applicants. */
export function isFairAdmin(user: { email: string; role: string } | null) {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(user.email.toLowerCase());
}

export function applicationOut(row: FairApplicationRow): FairApplicationOut {
  return {
    ...(row.data as Omit<FairApplicationOut, "id" | "seeker" | "status" | "at" | "updatedAt">),
    id: row.id,
    seeker: row.userId,
    status: row.status as FairApplicationOut["status"],
    at: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}
