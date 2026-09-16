import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'fr');
  CREATE TYPE "public"."enum_docs_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__docs_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__docs_v_published_locale" AS ENUM('en', 'fr');
  CREATE TYPE "public"."enum_plugin_ai_instructions_field_type" AS ENUM('text', 'textarea', 'upload', 'richText');
  CREATE TYPE "public"."enum_plugin_ai_instructions_model_id" AS ENUM('Oai-text', 'Oai-object');
  CREATE TABLE "docs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"category_id" integer,
  	"sidebar_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_docs_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "docs_locales" (
  	"title" varchar,
  	"description" varchar,
  	"sidebar_label" varchar,
  	"body" jsonb,
  	"markdown" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_docs_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_category_id" integer,
  	"version_sidebar_order" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__docs_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__docs_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_docs_v_locales" (
  	"version_title" varchar,
  	"version_description" varchar,
  	"version_sidebar_label" varchar,
  	"version_body" jsonb,
  	"version_markdown" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "plugin_ai_instructions_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "plugin_ai_instructions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"schema_path" varchar,
  	"field_type" "enum_plugin_ai_instructions_field_type" DEFAULT 'text',
  	"relation_to" varchar,
  	"model_id" "enum_plugin_ai_instructions_model_id",
  	"disabled" boolean DEFAULT false,
  	"oai_text_settings_model" varchar DEFAULT 'chat',
  	"oai_text_settings_max_tokens" numeric DEFAULT 5000,
  	"oai_text_settings_temperature" numeric DEFAULT 0.7,
  	"oai_text_settings_extract_attachments" boolean,
  	"oai_object_settings_model" varchar DEFAULT 'chat',
  	"oai_object_settings_max_tokens" numeric DEFAULT 5000,
  	"oai_object_settings_temperature" numeric DEFAULT 0.7,
  	"oai_object_settings_extract_attachments" boolean,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "plugin_ai_instructions_locales" (
  	"prompt" varchar,
  	"system" varchar DEFAULT 'INSTRUCTIONS:
  You are a highly skilled and professional blog writer,
  renowned for crafting engaging and well-organized articles.
  When given a title, you meticulously create blogs that are not only
  informative and accurate but also captivating and beautifully structured.',
  	"layout" varchar DEFAULT '[paragraph] - Write a concise introduction (2-3 sentences) that outlines the main topic.
  [horizontalrule] - Insert a horizontal rule to separate the introduction from the main content.
  [list] - Create a list with 3-5 items. Each list item should contain:
     a. [heading] - A brief, descriptive heading (up to 5 words)
     b. [paragraph] - A short explanation or elaboration (1-2 sentences)
  [horizontalrule] - Insert another horizontal rule to separate the main content from the conclusion.
  [paragraph] - Compose a brief conclusion (2-3 sentences) summarizing the key points.
  [quote] - Include a relevant quote from a famous person, directly related to the topic. Format: "Quote text." - Author Name',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"docs_id" integer,
  	"categories_id" integer,
  	"media_id" integer,
  	"users_id" integer,
  	"plugin_ai_instructions_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "docs" ADD CONSTRAINT "docs_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "docs_locales" ADD CONSTRAINT "docs_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_parent_id_docs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v_locales" ADD CONSTRAINT "_docs_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_docs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_locales" ADD CONSTRAINT "categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "plugin_ai_instructions_images" ADD CONSTRAINT "plugin_ai_instructions_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plugin_ai_instructions_images" ADD CONSTRAINT "plugin_ai_instructions_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plugin_ai_instructions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "plugin_ai_instructions_locales" ADD CONSTRAINT "plugin_ai_instructions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plugin_ai_instructions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_docs_fk" FOREIGN KEY ("docs_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plugin_ai_instructions_fk" FOREIGN KEY ("plugin_ai_instructions_id") REFERENCES "public"."plugin_ai_instructions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "docs_slug_idx" ON "docs" USING btree ("slug");
  CREATE INDEX "docs_category_idx" ON "docs" USING btree ("category_id");
  CREATE INDEX "docs_updated_at_idx" ON "docs" USING btree ("updated_at");
  CREATE INDEX "docs_created_at_idx" ON "docs" USING btree ("created_at");
  CREATE INDEX "docs__status_idx" ON "docs" USING btree ("_status");
  CREATE UNIQUE INDEX "docs_locales_locale_parent_id_unique" ON "docs_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_docs_v_parent_idx" ON "_docs_v" USING btree ("parent_id");
  CREATE INDEX "_docs_v_version_version_slug_idx" ON "_docs_v" USING btree ("version_slug");
  CREATE INDEX "_docs_v_version_version_category_idx" ON "_docs_v" USING btree ("version_category_id");
  CREATE INDEX "_docs_v_version_version_updated_at_idx" ON "_docs_v" USING btree ("version_updated_at");
  CREATE INDEX "_docs_v_version_version_created_at_idx" ON "_docs_v" USING btree ("version_created_at");
  CREATE INDEX "_docs_v_version_version__status_idx" ON "_docs_v" USING btree ("version__status");
  CREATE INDEX "_docs_v_created_at_idx" ON "_docs_v" USING btree ("created_at");
  CREATE INDEX "_docs_v_updated_at_idx" ON "_docs_v" USING btree ("updated_at");
  CREATE INDEX "_docs_v_snapshot_idx" ON "_docs_v" USING btree ("snapshot");
  CREATE INDEX "_docs_v_published_locale_idx" ON "_docs_v" USING btree ("published_locale");
  CREATE INDEX "_docs_v_latest_idx" ON "_docs_v" USING btree ("latest");
  CREATE INDEX "_docs_v_autosave_idx" ON "_docs_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_docs_v_locales_locale_parent_id_unique" ON "_docs_v_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "categories_locales_locale_parent_id_unique" ON "categories_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "plugin_ai_instructions_images_order_idx" ON "plugin_ai_instructions_images" USING btree ("_order");
  CREATE INDEX "plugin_ai_instructions_images_parent_id_idx" ON "plugin_ai_instructions_images" USING btree ("_parent_id");
  CREATE INDEX "plugin_ai_instructions_images_image_idx" ON "plugin_ai_instructions_images" USING btree ("image_id");
  CREATE UNIQUE INDEX "plugin_ai_instructions_schema_path_idx" ON "plugin_ai_instructions" USING btree ("schema_path");
  CREATE INDEX "plugin_ai_instructions_updated_at_idx" ON "plugin_ai_instructions" USING btree ("updated_at");
  CREATE INDEX "plugin_ai_instructions_created_at_idx" ON "plugin_ai_instructions" USING btree ("created_at");
  CREATE UNIQUE INDEX "plugin_ai_instructions_locales_locale_parent_id_unique" ON "plugin_ai_instructions_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_docs_id_idx" ON "payload_locked_documents_rels" USING btree ("docs_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_plugin_ai_instructions_id_idx" ON "payload_locked_documents_rels" USING btree ("plugin_ai_instructions_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "docs" CASCADE;
  DROP TABLE "docs_locales" CASCADE;
  DROP TABLE "_docs_v" CASCADE;
  DROP TABLE "_docs_v_locales" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "categories_locales" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "plugin_ai_instructions_images" CASCADE;
  DROP TABLE "plugin_ai_instructions" CASCADE;
  DROP TABLE "plugin_ai_instructions_locales" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_docs_status";
  DROP TYPE "public"."enum__docs_v_version_status";
  DROP TYPE "public"."enum__docs_v_published_locale";
  DROP TYPE "public"."enum_plugin_ai_instructions_field_type";
  DROP TYPE "public"."enum_plugin_ai_instructions_model_id";`)
}
