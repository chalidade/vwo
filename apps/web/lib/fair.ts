import "server-only";
import { type FairApplicationRow, isBoothMember } from "@vwo/db";
import { db } from "./db";
import type { FairApplicationOut } from "@vwo/shared";

/** Accounts that run the event: they see and change everything. */
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
    ...(row.shared as object),
    id: row.id,
    seeker: row.userId,
    status: row.status as FairApplicationOut["status"],
    at: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/** Event admins, and the company accounts that run this booth. */
export async function canManageBooth(user: { id: string; email: string; role: string } | null, boothKey: string) {
  if (!user) return false;
  return isFairAdmin(user) || isBoothMember(db, user.id, boothKey);
}
