import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Profiles / users. In a Supabase deployment this maps to `profiles` (auth.users mirror).
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default(""),
  avatarUrl: text("avatar_url"),
  preferences: jsonb("preferences").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("FREE"), // FREE | PRO | CREATOR
    status: text("status").notNull().default("active"), // active | canceled | past_due | trialing
    provider: text("provider").notNull().default("mock"),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subscriptions_user_unique").on(t.userId)]
);

export const usage = pgTable(
  "usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // YYYY-MM
    podcastsCreated: integer("podcasts_created").notNull().default(0),
    audioMinutesGenerated: numeric("audio_minutes_generated", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("usage_user_month_unique").on(t.userId, t.month)]
);

export const podcasts = pgTable(
  "podcasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled podcast"),
    description: text("description").notNull().default(""),
    sourceFileName: text("source_file_name").notNull(),
    sourcePath: text("source_path"),
    sourcePages: integer("source_pages").notNull().default(0),
    style: text("style").notNull().default("quick_summary"),
    length: text("length").notNull().default("quick"),
    language: text("language").notNull().default("ru"),
    voiceHost1: text("voice_host1").notNull().default("aidar"),
    voiceHost2: text("voice_host2").notNull().default("kseniya"),
    script: jsonb("script"), // { lines: [{ speaker, text }] }
    status: text("status").notNull().default("queued"), // queued | processing | completed | failed
    stage: text("stage").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    statusMessage: text("status_message"),
    errorCode: text("error_code"),
    audioPath: text("audio_path"),
    audioFormat: text("audio_format"),
    audioDurationSeconds: integer("audio_duration_seconds").notNull().default(0),
    fileSize: integer("file_size").notNull().default(0),
    visibility: text("visibility").notNull().default("private"), // private | public
    coverUrl: text("cover_url"),
    coverPath: text("cover_path"),
    generationCostEstimate: numeric("generation_cost_estimate", { precision: 10, scale: 4 })
      .notNull()
      .default("0"),
    estimatedMinutes: numeric("estimated_minutes", { precision: 10, scale: 2 }).notNull().default("0"),
    batchId: text("batch_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("podcasts_user_idx").on(t.userId), index("podcasts_visibility_idx").on(t.visibility)]
);

export const billingEvents = pgTable("billing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
