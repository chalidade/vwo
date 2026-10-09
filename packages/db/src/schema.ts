// Database schema for Virtual Cafe World. Mirrors docs/design/ERD.md (v0.4).
// Every tenant-owned table carries venue_id so one database serves many cafes.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

// ---------------------------------------------------------------- enums
export const platformRole = pgEnum("platform_role", ["user", "super_admin"]);
export const venueStatus = pgEnum("venue_status", ["draft", "open", "closed", "archived"]);
export const venueRole = pgEnum("venue_role", ["owner", "admin", "cashier", "staff"]);
export const floorStatus = pgEnum("floor_status", ["draft", "published"]);
export const tableShape = pgEnum("table_shape", ["round", "square", "rect", "bar"]);
export const mapObjectType = pgEnum("map_object_type", [
  "wall", "counter", "door", "decor", "spawn_point", "blocked", "stairs", "elevator",
]);
export const checkinPointType = pgEnum("checkin_point_type", ["entrance", "table"]);
export const visitStatus = pgEnum("visit_status", ["checked_in", "checked_out"]);
export const checkinMethod = pgEnum("checkin_method", ["qr_entrance", "qr_table", "staff"]);
export const checkoutMethod = pgEnum("checkout_method", ["self", "staff", "auto_idle", "auto_closing"]);
export const memberType = pgEnum("member_type", ["host", "app_user", "companion"]);
export const visitEventType = pgEnum("visit_event_type", [
  "check_in", "member_join", "member_leave", "floor_change", "seat_claim", "seat_release",
  "order_placed", "check_out", "auto_check_out", "staff_override",
]);
export const occupancySource = pgEnum("occupancy_source", ["self", "host", "staff"]);
export const occupancyEndReason = pgEnum("occupancy_end_reason", ["stand_up", "check_out", "staff_clear", "auto"]);
export const orderStatus = pgEnum("order_status", [
  "pending_payment", "paid", "accepted", "preparing", "ready", "served", "cancelled", "refunded",
]);
export const paymentStatus = pgEnum("payment_status", ["pending", "paid", "failed", "expired", "refunded"]);
export const chatChannelType = pgEnum("chat_channel_type", ["venue", "table", "direct"]);
export const socialStatus = pgEnum("social_status", ["open_to_chat", "busy", "do_not_disturb"]);
export const dmPolicy = pgEnum("dm_policy", ["everyone", "friends", "nobody"]);
export const bodyType = pgEnum("body_type", ["a", "b", "c"]);
export const itemSlot = pgEnum("item_slot", ["hair", "face", "eyewear", "hat", "top", "bottom", "shoes", "back", "accessory", "held"]);
export const itemRarity = pgEnum("item_rarity", ["common", "rare", "epic"]);
export const unlockType = pgEnum("unlock_type", ["default", "visit_count", "purchase", "event", "staff_grant"]);
export const inventorySource = pgEnum("inventory_source", ["default", "reward", "purchase", "gift"]);
export const friendshipStatus = pgEnum("friendship_status", ["pending", "accepted", "declined"]);
export const interactionType = pgEnum("interaction_type", ["table_invite", "join_table_request", "treat"]);
export const interactionStatus = pgEnum("interaction_status", ["pending", "accepted", "declined", "expired", "cancelled"]);
export const reportReason = pgEnum("report_reason", ["spam", "harassment", "inappropriate", "other"]);
export const reportStatus = pgEnum("report_status", ["open", "reviewed", "action_taken", "dismissed"]);

// ---------------------------------------------------------------- accounts & character
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  displayName: text("display_name").notNull(),
  platformRole: platformRole("platform_role").notNull().default("user"),
  createdAt: createdAt(),
});

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  nickname: text("nickname").notNull(),
  bio: text("bio"),
  interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
  socialStatus: socialStatus("social_status").notNull().default("open_to_chat"),
  dmPolicy: dmPolicy("dm_policy").notNull().default("friends"),
  acceptTableInvites: boolean("accept_table_invites").notNull().default(true),
  showInLiveList: boolean("show_in_live_list").notNull().default(true),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const avatars = pgTable("avatars", {
  id: id(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  bodyType: bodyType("body_type").notNull().default("a"),
  skinTone: text("skin_tone").notNull(),
  appearanceCache: jsonb("appearance_cache").notNull().default({}),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------- tenant
export const venues = pgTable(
  "venues",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    currency: text("currency").notNull().default("IDR"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).notNull().default("0"),
    serviceRate: numeric("service_rate", { precision: 5, scale: 4 }).notNull().default("0"),
    openingHours: jsonb("opening_hours").notNull().default({}),
    idleCheckoutMinutes: integer("idle_checkout_minutes").notNull().default(30),
    status: venueStatus("status").notNull().default("draft"),
    ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [check("venues_slug_format", sql`${t.slug} ~ '^[a-z0-9-]{3,48}$'`)],
);

export const venueMembers = pgTable(
  "venue_members",
  {
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: venueRole("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.venueId, t.userId] })],
);

// ---------------------------------------------------------------- layout
export const floors = pgTable(
  "floors",
  {
    id: id(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    tileSize: integer("tile_size").notNull().default(32),
    backgroundUrl: text("background_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    layoutVersion: integer("layout_version").notNull().default(0),
    status: floorStatus("status").notNull().default("draft"),
  },
  (t) => [index("floors_venue_idx").on(t.venueId)],
);

export const cafeTables = pgTable(
  "cafe_tables",
  {
    id: id(),
    floorId: uuid("floor_id").notNull().references(() => floors.id, { onDelete: "cascade" }),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    shape: tableShape("shape").notNull().default("square"),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    width: doublePrecision("width").notNull().default(1),
    height: doublePrecision("height").notNull().default(1),
    rotation: integer("rotation").notNull().default(0),
    spriteKey: text("sprite_key"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("cafe_tables_floor_idx").on(t.floorId), uniqueIndex("cafe_tables_label_uq").on(t.venueId, t.label)],
);

export const seats = pgTable(
  "seats",
  {
    id: id(),
    floorId: uuid("floor_id").notNull().references(() => floors.id, { onDelete: "cascade" }),
    tableId: uuid("table_id").references(() => cafeTables.id, { onDelete: "set null" }),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    rotation: integer("rotation").notNull().default(0),
    spriteKey: text("sprite_key"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    index("seats_floor_idx").on(t.floorId),
    index("seats_table_idx").on(t.tableId),
    uniqueIndex("seats_label_uq").on(t.venueId, t.label),
  ],
);

export const mapObjects = pgTable(
  "map_objects",
  {
    id: id(),
    floorId: uuid("floor_id").notNull().references(() => floors.id, { onDelete: "cascade" }),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    type: mapObjectType("type").notNull(),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    width: doublePrecision("width").notNull().default(1),
    height: doublePrecision("height").notNull().default(1),
    rotation: integer("rotation").notNull().default(0),
    spriteKey: text("sprite_key"),
    isWalkable: boolean("is_walkable").notNull().default(false),
    targetFloorId: uuid("target_floor_id").references(() => floors.id, { onDelete: "set null" }),
    targetX: doublePrecision("target_x"),
    targetY: doublePrecision("target_y"),
    properties: jsonb("properties").notNull().default({}),
  },
  (t) => [
    index("map_objects_floor_idx").on(t.floorId),
    check(
      "map_objects_portal_target",
      sql`(${t.type} in ('stairs','elevator')) = (${t.targetFloorId} is not null)`,
    ),
    check("map_objects_portal_other_floor", sql`${t.targetFloorId} is null or ${t.targetFloorId} <> ${t.floorId}`),
  ],
);

export const checkinPoints = pgTable("checkin_points", {
  id: id(),
  venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  floorId: uuid("floor_id").references(() => floors.id, { onDelete: "set null" }),
  tableId: uuid("table_id").references(() => cafeTables.id, { onDelete: "set null" }),
  type: checkinPointType("type").notNull(),
  label: text("label").notNull(),
  secretKey: text("secret_key").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// ---------------------------------------------------------------- avatar items (need venues)
export const avatarItems = pgTable("avatar_items", {
  id: id(),
  venueId: uuid("venue_id").references(() => venues.id, { onDelete: "cascade" }),
  slot: itemSlot("slot").notNull(),
  name: text("name").notNull(),
  spriteKey: text("sprite_key").notNull(),
  colorOptions: text("color_options").array().notNull().default(sql`'{}'::text[]`),
  rarity: itemRarity("rarity").notNull().default("common"),
  unlockType: unlockType("unlock_type").notNull().default("default"),
  unlockValue: integer("unlock_value"),
  isActive: boolean("is_active").notNull().default(true),
});

export const avatarEquipped = pgTable(
  "avatar_equipped",
  {
    avatarId: uuid("avatar_id").notNull().references(() => avatars.id, { onDelete: "cascade" }),
    slot: itemSlot("slot").notNull(),
    itemId: uuid("item_id").notNull().references(() => avatarItems.id),
    color: text("color"),
  },
  (t) => [primaryKey({ columns: [t.avatarId, t.slot] })],
);

export const userInventory = pgTable(
  "user_inventory",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => avatarItems.id, { onDelete: "cascade" }),
    source: inventorySource("source").notNull().default("default"),
    acquiredAt: ts("acquired_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

// ---------------------------------------------------------------- visits & occupancy
export const visits = pgTable(
  "visits",
  {
    id: id(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    groupCode: text("group_code").unique(),
    status: visitStatus("status").notNull().default("checked_in"),
    checkinMethod: checkinMethod("checkin_method").notNull(),
    checkinPointId: uuid("checkin_point_id").references(() => checkinPoints.id, { onDelete: "set null" }),
    checkedInByUserId: uuid("checked_in_by_user_id").references(() => users.id),
    checkedInAt: ts("checked_in_at").notNull().defaultNow(),
    lastHeartbeatAt: ts("last_heartbeat_at"),
    checkoutMethod: checkoutMethod("checkout_method"),
    checkedOutByUserId: uuid("checked_out_by_user_id").references(() => users.id),
    checkedOutAt: ts("checked_out_at"),
  },
  (t) => [
    index("visits_active_idx").on(t.venueId).where(sql`${t.checkedOutAt} is null`),
    check("visits_status_consistent", sql`(${t.status} = 'checked_out') = (${t.checkedOutAt} is not null)`),
  ],
);

export const visitMembers = pgTable(
  "visit_members",
  {
    id: id(),
    visitId: uuid("visit_id").notNull().references(() => visits.id, { onDelete: "cascade" }),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    memberType: memberType("member_type").notNull(),
    displayName: text("display_name").notNull(),
    avatarAppearance: jsonb("avatar_appearance"),
    followsMemberId: uuid("follows_member_id").references((): AnyPgColumn => visitMembers.id, {
      onDelete: "set null",
    }),
    currentFloorId: uuid("current_floor_id").references(() => floors.id, { onDelete: "set null" }),
    joinedAt: ts("joined_at").notNull().defaultNow(),
    leftAt: ts("left_at"),
  },
  (t) => [
    // One active membership per user per cafe.
    uniqueIndex("visit_members_one_active_per_user")
      .on(t.userId, t.venueId)
      .where(sql`${t.leftAt} is null and ${t.userId} is not null`),
    // Exactly one host per visit.
    uniqueIndex("visit_members_one_host").on(t.visitId).where(sql`${t.memberType} = 'host'`),
    check("visit_members_companion_no_user", sql`${t.memberType} <> 'companion' or ${t.userId} is null`),
    check("visit_members_app_user_has_user", sql`${t.memberType} <> 'app_user' or ${t.userId} is not null`),
    index("visit_members_visit_idx").on(t.visitId),
  ],
);

export const visitEvents = pgTable(
  "visit_events",
  {
    id: id(),
    visitId: uuid("visit_id").notNull().references(() => visits.id, { onDelete: "cascade" }),
    visitMemberId: uuid("visit_member_id").references(() => visitMembers.id, { onDelete: "set null" }),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    type: visitEventType("type").notNull(),
    floorId: uuid("floor_id").references(() => floors.id, { onDelete: "set null" }),
    seatId: uuid("seat_id").references(() => seats.id, { onDelete: "set null" }),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    meta: jsonb("meta").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("visit_events_venue_time_idx").on(t.venueId, t.createdAt)],
);

export const seatOccupancies = pgTable(
  "seat_occupancies",
  {
    id: id(),
    seatId: uuid("seat_id").notNull().references(() => seats.id),
    visitId: uuid("visit_id").notNull().references(() => visits.id, { onDelete: "cascade" }),
    visitMemberId: uuid("visit_member_id").notNull().references(() => visitMembers.id, { onDelete: "cascade" }),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    source: occupancySource("source").notNull().default("self"),
    startedAt: ts("started_at").notNull().defaultNow(),
    endedAt: ts("ended_at"),
    endReason: occupancyEndReason("end_reason"),
  },
  (t) => [
    // One person per seat.
    uniqueIndex("seat_occupancies_one_per_seat").on(t.seatId).where(sql`${t.endedAt} is null`),
    // One seat per person.
    uniqueIndex("seat_occupancies_one_per_member").on(t.visitMemberId).where(sql`${t.endedAt} is null`),
    index("seat_occupancies_active_venue_idx").on(t.venueId).where(sql`${t.endedAt} is null`),
  ],
);

// ---------------------------------------------------------------- menu
export const menuCategories = pgTable("menu_categories", {
  id: id(),
  venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const menuItems = pgTable(
  "menu_items",
  {
    id: id(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull().references(() => menuCategories.id),
    name: text("name").notNull(),
    description: text("description"),
    price: money("price").notNull(),
    imageUrl: text("image_url"),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("menu_items_venue_idx").on(t.venueId), check("menu_items_price_positive", sql`${t.price} >= 0`)],
);

export const modifierGroups = pgTable("modifier_groups", {
  id: id(),
  venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select").notNull().default(1),
});

export const modifierOptions = pgTable("modifier_options", {
  id: id(),
  groupId: uuid("group_id").notNull().references(() => modifierGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceDelta: money("price_delta").notNull().default("0"),
  isAvailable: boolean("is_available").notNull().default(true),
});

export const menuItemModifierGroups = pgTable(
  "menu_item_modifier_groups",
  {
    menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
    modifierGroupId: uuid("modifier_group_id").notNull().references(() => modifierGroups.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.menuItemId, t.modifierGroupId] })],
);

// ---------------------------------------------------------------- orders & payments
export const orders = pgTable(
  "orders",
  {
    id: id(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    customerUserId: uuid("customer_user_id").references(() => users.id),
    recipientUserId: uuid("recipient_user_id").references(() => users.id),
    seatId: uuid("seat_id").references(() => seats.id),
    visitId: uuid("visit_id").references(() => visits.id),
    orderNumber: text("order_number").notNull(),
    businessDate: text("business_date").notNull(),
    status: orderStatus("status").notNull().default("pending_payment"),
    subtotal: money("subtotal").notNull(),
    taxAmount: money("tax_amount").notNull().default("0"),
    serviceAmount: money("service_amount").notNull().default("0"),
    total: money("total").notNull(),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_per_day").on(t.venueId, t.businessDate, t.orderNumber),
    index("orders_venue_status_idx").on(t.venueId, t.status),
  ],
);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
  nameSnapshot: text("name_snapshot").notNull(),
  unitPriceSnapshot: money("unit_price_snapshot").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotal: money("line_total").notNull(),
  forMemberId: uuid("for_member_id").references(() => visitMembers.id, { onDelete: "set null" }),
  note: text("note"),
});

export const orderItemModifiers = pgTable("order_item_modifiers", {
  id: id(),
  orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id, { onDelete: "cascade" }),
  modifierOptionId: uuid("modifier_option_id").notNull().references(() => modifierOptions.id),
  nameSnapshot: text("name_snapshot").notNull(),
  priceDeltaSnapshot: money("price_delta_snapshot").notNull(),
});

export const orderStatusEvents = pgTable("order_status_events", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: orderStatus("from_status"),
  toStatus: orderStatus("to_status").notNull(),
  changedByUserId: uuid("changed_by_user_id").references(() => users.id),
  createdAt: createdAt(),
});

export const payments = pgTable("payments", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  method: text("method").notNull(),
  amount: money("amount").notNull(),
  status: paymentStatus("status").notNull().default("pending"),
  providerRef: text("provider_ref").unique(),
  checkoutUrl: text("checkout_url"),
  rawPayload: jsonb("raw_payload"),
  paidAt: ts("paid_at"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- chat & social
export const chatChannels = pgTable(
  "chat_channels",
  {
    id: id(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    type: chatChannelType("type").notNull(),
    tableId: uuid("table_id").references(() => cafeTables.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [check("chat_channels_table_type", sql`(${t.type} = 'table') = (${t.tableId} is not null)`)],
);

export const chatChannelMembers = pgTable(
  "chat_channel_members",
  {
    channelId: uuid("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    joinedAt: ts("joined_at").notNull().defaultNow(),
    lastReadAt: ts("last_read_at"),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.userId] })],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: id(),
    channelId: uuid("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id").notNull().references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("chat_messages_channel_time_idx").on(t.channelId, t.createdAt)],
);

export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerUserId: uuid("blocker_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerUserId, t.blockedUserId] })],
);

export const friendships = pgTable(
  "friendships",
  {
    id: id(),
    requesterUserId: uuid("requester_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    addresseeUserId: uuid("addressee_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatus("status").notNull().default("pending"),
    metAtVenueId: uuid("met_at_venue_id").references(() => venues.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    respondedAt: ts("responded_at"),
  },
  (t) => [
    uniqueIndex("friendships_pair_uq").on(
      sql`least(${t.requesterUserId}, ${t.addresseeUserId})`,
      sql`greatest(${t.requesterUserId}, ${t.addresseeUserId})`,
    ),
    check("friendships_not_self", sql`${t.requesterUserId} <> ${t.addresseeUserId}`),
  ],
);

export const interactions = pgTable(
  "interactions",
  {
    id: id(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    fromUserId: uuid("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    toUserId: uuid("to_user_id").references(() => users.id, { onDelete: "cascade" }),
    type: interactionType("type").notNull(),
    tableId: uuid("table_id").references(() => cafeTables.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    status: interactionStatus("status").notNull().default("pending"),
    message: text("message"),
    createdAt: createdAt(),
    expiresAt: ts("expires_at").notNull(),
    respondedAt: ts("responded_at"),
  },
  (t) => [index("interactions_to_pending_idx").on(t.toUserId).where(sql`${t.status} = 'pending'`)],
);

export const userReports = pgTable("user_reports", {
  id: id(),
  venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  reporterUserId: uuid("reporter_user_id").notNull().references(() => users.id),
  reportedUserId: uuid("reported_user_id").notNull().references(() => users.id),
  chatMessageId: uuid("chat_message_id").references(() => chatMessages.id, { onDelete: "set null" }),
  reason: reportReason("reason").notNull(),
  detail: text("detail"),
  status: reportStatus("status").notNull().default("open"),
  handledByUserId: uuid("handled_by_user_id").references(() => users.id),
  createdAt: createdAt(),
});

export * from "./jobfair-schema";
