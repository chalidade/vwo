// Seeds a demo venue reachable at /vwo/cafe-a: two floors joined by stairs, tables with
// auto-placed seats, an entrance QR, a small menu, default avatar items and demo users.
import { randomBytes } from "node:crypto";
import { DEMO_VENUE, type ObjectSpec, seatLabel, seatPositionsAround } from "@vwo/shared";
import { eq } from "drizzle-orm";
import { createDb } from "./client";
import {
  avatarItems,
  cafeTables,
  checkinPoints,
  floors,
  mapObjects,
  menuCategories,
  menuItemModifierGroups,
  menuItems,
  modifierGroups,
  modifierOptions,
  profiles,
  seats,
  users,
  venueMembers,
  venues,
} from "./schema";

const { db, close } = createDb();

const existing = await db.query.venues.findFirst({ where: eq(venues.slug, "cafe-a") });
if (existing) {
  console.log("seed: cafe-a already exists, skipping");
  await close();
  process.exit(0);
}

await db.transaction(async (tx) => {
  const [owner, customer] = await tx
    .insert(users)
    .values([
      { email: "owner@cafe-a.test", displayName: "Owner Cafe A", platformRole: "super_admin" },
      { email: "pelanggan@cafe-a.test", displayName: "Pelanggan Demo" },
    ])
    .returning();
  if (!owner || !customer) throw new Error("seed users failed");
  await tx.insert(profiles).values([
    { userId: owner.id, nickname: "Owner" },
    { userId: customer.id, nickname: "Rina", bio: "Suka kopi susu", interests: ["kopi", "musik"] },
  ]);

  const [venue] = await tx
    .insert(venues)
    .values({
      slug: "cafe-a",
      name: "Cafe A",
      description: "Cafe contoh untuk pengembangan",
      status: "open",
      taxRate: "0.1100",
      serviceRate: "0.0500",
      openingHours: { mon: ["08:00", "22:00"], tue: ["08:00", "22:00"], wed: ["08:00", "22:00"], thu: ["08:00", "22:00"], fri: ["08:00", "23:00"], sat: ["08:00", "23:00"], sun: ["09:00", "22:00"] },
      ownerUserId: owner.id,
    })
    .returning();
  if (!venue) throw new Error("seed venue failed");
  await tx.insert(venueMembers).values({ venueId: venue.id, userId: owner.id, role: "owner" });

  const [ground, rooftop] = await tx
    .insert(floors)
    .values([
      { venueId: venue.id, name: "Lantai 1", width: 20, height: 14, sortOrder: 0, status: "published", layoutVersion: 1 },
      { venueId: venue.id, name: "Rooftop", width: 16, height: 10, sortOrder: 1, status: "published", layoutVersion: 1 },
    ])
    .returning();
  if (!ground || !rooftop) throw new Error("seed floors failed");

  const floorRows = [ground, rooftop];
  await tx.insert(mapObjects).values(
    DEMO_VENUE.objects.map((o: ObjectSpec) => {
      const target = o.target ? floorRows[o.target.floor] : undefined;
      return {
        floorId: floorRows[o.floor]!.id,
        venueId: venue.id,
        type: o.type,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        spriteKey: o.spriteKey ?? null,
        isWalkable: o.isWalkable ?? false,
        targetFloorId: target?.id ?? null,
        targetX: o.target?.x ?? null,
        targetY: o.target?.y ?? null,
      };
    }),
  );

  const tableSpecs = DEMO_VENUE.tables.map((t) => ({ ...t, floor: floorRows[t.floor]! }));
  for (const spec of tableSpecs) {
    const [table] = await tx
      .insert(cafeTables)
      .values({ floorId: spec.floor.id, venueId: venue.id, label: spec.label, shape: spec.shape, x: spec.x, y: spec.y, width: spec.width, height: spec.height })
      .returning();
    if (!table) throw new Error("seed table failed");
    const positions = seatPositionsAround(spec, spec.capacity);
    await tx.insert(seats).values(
      positions.map((p, i) => ({
        floorId: spec.floor.id,
        tableId: table.id,
        venueId: venue.id,
        label: seatLabel(spec.label, i),
        x: p.x,
        y: p.y,
        rotation: p.rotation,
      })),
    );
  }

  await tx.insert(checkinPoints).values({
    venueId: venue.id,
    floorId: ground.id,
    type: "entrance",
    label: "Pintu depan",
    secretKey: randomBytes(32).toString("hex"),
  });

  const [coffee, food] = await tx
    .insert(menuCategories)
    .values([
      { venueId: venue.id, name: "Kopi", sortOrder: 0 },
      { venueId: venue.id, name: "Makanan", sortOrder: 1 },
    ])
    .returning();
  if (!coffee || !food) throw new Error("seed categories failed");
  const items = await tx
    .insert(menuItems)
    .values([
      { venueId: venue.id, categoryId: coffee.id, name: "Kopi Susu Gula Aren", price: "25000", sortOrder: 0 },
      { venueId: venue.id, categoryId: coffee.id, name: "Americano", price: "22000", sortOrder: 1 },
      { venueId: venue.id, categoryId: coffee.id, name: "Cappuccino", price: "28000", sortOrder: 2 },
      { venueId: venue.id, categoryId: food.id, name: "Croissant", price: "20000", sortOrder: 0 },
      { venueId: venue.id, categoryId: food.id, name: "Nasi Goreng Kampung", price: "35000", sortOrder: 1 },
    ])
    .returning();

  const [sugar] = await tx
    .insert(modifierGroups)
    .values({ venueId: venue.id, name: "Level gula", minSelect: 1, maxSelect: 1 })
    .returning();
  if (!sugar) throw new Error("seed modifier failed");
  await tx.insert(modifierOptions).values([
    { groupId: sugar.id, name: "Normal" },
    { groupId: sugar.id, name: "Less sugar" },
    { groupId: sugar.id, name: "No sugar" },
  ]);
  await tx
    .insert(menuItemModifierGroups)
    .values(items.filter((i) => i.categoryId === coffee.id).map((i) => ({ menuItemId: i.id, modifierGroupId: sugar.id })));

  await tx.insert(avatarItems).values([
    { slot: "hair", name: "Rambut pendek", spriteKey: "hair/short", colorOptions: ["#2b1b12", "#6b4423", "#d4a373"] },
    { slot: "hair", name: "Rambut panjang", spriteKey: "hair/long", colorOptions: ["#2b1b12", "#6b4423", "#d4a373"] },
    { slot: "top", name: "Kaos", spriteKey: "top/tshirt", colorOptions: ["#ffffff", "#1f2937", "#2563eb"] },
    { slot: "bottom", name: "Celana jeans", spriteKey: "bottom/jeans" },
    { slot: "shoes", name: "Sneakers", spriteKey: "shoes/sneakers" },
    { venueId: venue.id, slot: "top", name: "Apron Cafe A", spriteKey: "top/apron-cafe-a", rarity: "rare", unlockType: "visit_count", unlockValue: 5 },
  ]);
});

console.log("seed: created cafe-a (open /vwo/cafe-a)");
await close();
