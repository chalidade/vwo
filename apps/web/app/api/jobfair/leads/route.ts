import { createLead, listLeads } from "@vwo/db";
import { boothLeadInput, newLead, stallLeadInput } from "@vwo/shared";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { screenForm } from "@/lib/antibot";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readSizedBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("kind", [z.object({ kind: z.literal("booth"), data: boothLeadInput }), z.object({ kind: z.literal("stall"), data: stallLeadInput })]);

/** Every booth and stall request with its contact details: event admins only. */
export async function GET() {
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  return NextResponse.json({ leads: await listLeads(db) }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * A company asks for a booth, or a food business for a food court stall: a form, no price, no
 * payment. The organiser calls back. Signed in, so the booth or stall can be given to this account.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const body = await readSizedBody(req, schema, 4_000);
  if ("error" in body) return body.error;
  if (!(await allow(`lead:${user.id}`, 5, 86_400_000))) return fail(429, "too_many_requests");
  const d = body.data.data as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined);
  const refused = await screenForm(req, "lead", {
    email: str("email"),
    // Company names may be web addresses (Blibli.com), so they are checked like free text.
    names: { contactName: str("contactName"), city: str("city") },
    others: { name: str("company") ?? str("business"), industry: str("industry"), contactRole: str("contactRole"), sells: str("sells"), note: str("note") },
  });
  if (refused) return refused;
  const lead = newLead(randomUUID(), user.id, body.data, Date.now());
  const out = await createLead(db, lead);
  if ("error" in out) return fail(409, out.error);
  return NextResponse.json({ lead: { id: lead.id, kind: lead.kind, name: lead.name, status: lead.status, at: lead.at } }, { status: 201 });
}
