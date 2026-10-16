-- Baseline of the production schema, captured with `supabase db dump` on 2026-10-16.
--
-- Production was built through the SQL editor before migrations were tracked.
-- This file recreates that schema minus every object the later migrations
-- (20260902114500 onwards) create, so a fresh database built from all
-- migrations matches production.
--
-- Production already has this schema. Once this file is on main, mark it applied
-- there with `supabase migration repair --status applied`; never run it against
-- production.
-- Auth settings and email templates are configured in the dashboard, not here
-- (see supabase/README.md).

SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE "public"."application_status" AS ENUM (
    'pending',
    'viewed',
    'shortlisted',
    'rejected',
    'accepted',
    'withdrawn'
);

ALTER TYPE "public"."application_status" OWNER TO "postgres";

CREATE TYPE "public"."availability_status" AS ENUM (
    'available',
    'busy',
    'unavailable'
);

ALTER TYPE "public"."availability_status" OWNER TO "postgres";

CREATE TYPE "public"."budget_type" AS ENUM (
    'fixed',
    'range',
    'negotiable'
);

ALTER TYPE "public"."budget_type" OWNER TO "postgres";

CREATE TYPE "public"."capability_strength" AS ENUM (
    'basic',
    'strong',
    'expert'
);

ALTER TYPE "public"."capability_strength" OWNER TO "postgres";

CREATE TYPE "public"."deadline_type" AS ENUM (
    'specific_date',
    'flexible',
    'asap'
);

ALTER TYPE "public"."deadline_type" OWNER TO "postgres";

CREATE TYPE "public"."match_status" AS ENUM (
    'suggested',
    'viewed',
    'contacted',
    'accepted',
    'rejected',
    'archived'
);

ALTER TYPE "public"."match_status" OWNER TO "postgres";

CREATE TYPE "public"."preferred_provider_type" AS ENUM (
    'freelancer',
    'agency',
    'studio',
    'any'
);

ALTER TYPE "public"."preferred_provider_type" OWNER TO "postgres";

CREATE TYPE "public"."project_readiness_level" AS ENUM (
    'idea_only',
    'need_guidance',
    'content_ready',
    'design_ready',
    'spec_ready'
);

ALTER TYPE "public"."project_readiness_level" OWNER TO "postgres";

CREATE TYPE "public"."project_scope_level" AS ENUM (
    'small',
    'medium',
    'large'
);

ALTER TYPE "public"."project_scope_level" OWNER TO "postgres";

CREATE TYPE "public"."project_status" AS ENUM (
    'draft',
    'published',
    'in_discussion',
    'assigned',
    'completed',
    'cancelled'
);

ALTER TYPE "public"."project_status" OWNER TO "postgres";

CREATE TYPE "public"."provider_service_category" AS ENUM (
    'web_development',
    'mobile_development',
    'ui_ux_design',
    'graphic_design',
    'video_editing',
    'seo',
    'marketing',
    'copywriting',
    'branding',
    'ecommerce',
    'automation',
    'other'
);

ALTER TYPE "public"."provider_service_category" OWNER TO "postgres";

CREATE TYPE "public"."provider_type" AS ENUM (
    'freelancer',
    'agency',
    'studio',
    'company',
    'other'
);

ALTER TYPE "public"."provider_type" OWNER TO "postgres";

CREATE TYPE "public"."user_role" AS ENUM (
    'client',
    'provider',
    'admin'
);

ALTER TYPE "public"."user_role" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."accept_project_application"("target_application_id" "uuid") RETURNS TABLE("application_id" "uuid", "application_status" "public"."application_status", "conversation_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
  declare
    current_user_id uuid := auth.uid();
    selected_application record;
    selected_project record;
    already_accepted_application_id uuid;
    existing_conversation_id uuid;
  begin
    if current_user_id is null then
      raise exception 'Unauthorized.';
    end if;

    select
      a.id,
      a.project_id,
      a.provider_id,
      a.status
    into selected_application
    from public.applications a
    where a.id = target_application_id
    for update;

    if not found then
      raise exception 'Application not found.';
    end if;

    select
      p.id,
      p.client_id,
      p.status
    into selected_project
    from public.projects p
    where p.id = selected_application.project_id
    for update;

    if not found then
      raise exception 'Project not found.';
    end if;

    if selected_project.client_id <> current_user_id then
      raise exception 'Application not found.';
    end if;

    if selected_project.status not in ('published', 'in_discussion') then
      raise exception 'This project is no longer accepting providers.';
    end if;

    if selected_application.status in ('accepted', 'rejected', 'withdrawn') then
      raise exception 'This application can no longer be updated.';
    end if;

    select a.id
    into already_accepted_application_id
    from public.applications a
    where a.project_id = selected_application.project_id
      and a.status = 'accepted'
      and a.id <> selected_application.id
    limit 1
    for update;

    if already_accepted_application_id is not null then
      raise exception 'A provider has already been accepted for this project.';
    end if;

    select c.id
    into existing_conversation_id
    from public.conversations c
    where c.application_id = selected_application.id
    limit 1;

    if existing_conversation_id is null then
      begin
        insert into public.conversations (
          application_id,
          project_id,
          client_id,
          provider_id
        )
        values (
          selected_application.id,
          selected_application.project_id,
          selected_project.client_id,
          selected_application.provider_id
        )
        returning id into existing_conversation_id;
      exception
        when unique_violation then
          select c.id
          into existing_conversation_id
          from public.conversations c
          where c.application_id = selected_application.id
          limit 1;
      end;
    end if;

    update public.applications
    set status = 'accepted'
    where id = selected_application.id;

    update public.applications
    set status = 'rejected'
    where project_id = selected_application.project_id
      and id <> selected_application.id
      and status in ('pending', 'viewed', 'shortlisted');

    update public.projects
    set status = 'assigned'
    where id = selected_project.id;

    return query
    select
      selected_application.id,
      'accepted'::public.application_status,
      existing_conversation_id;
  end;
  $$;

ALTER FUNCTION "public"."accept_project_application"("target_application_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."auth_rate_limit_check"("target_scope" "text", "target_key_hash" "text") RETURNS TABLE("allowed" boolean, "retry_after_seconds" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  existing_limit record;
  now_at timestamptz := now();
begin
  select
    blocked_until
  into existing_limit
  from public.auth_rate_limits
  where scope = target_scope
    and key_hash = target_key_hash;

  if found
    and existing_limit.blocked_until is not null
    and existing_limit.blocked_until > now_at
  then
    return query
    select
      false,
      greatest(ceil(extract(epoch from existing_limit.blocked_until - now_at))::integer, 1);
    return;
  end if;

  return query select true, 0;
end;
$$;

ALTER FUNCTION "public"."auth_rate_limit_check"("target_scope" "text", "target_key_hash" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."auth_rate_limit_record_attempt"("target_scope" "text", "target_key_hash" "text", "max_attempts" integer, "window_seconds" integer, "block_seconds" integer) RETURNS TABLE("allowed" boolean, "retry_after_seconds" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_limit record;
  now_at timestamptz := now();
  next_attempt_count integer;
  next_blocked_until timestamptz;
begin
  if max_attempts < 1 or window_seconds < 1 or block_seconds < 1 then
    raise exception 'Invalid rate limit configuration.';
  end if;

  select
    attempt_count,
    window_start,
    blocked_until
  into current_limit
  from public.auth_rate_limits
  where scope = target_scope
    and key_hash = target_key_hash
  for update;

  if found
    and current_limit.blocked_until is not null
    and current_limit.blocked_until > now_at
  then
    return query
    select
      false,
      greatest(ceil(extract(epoch from current_limit.blocked_until - now_at))::integer, 1);
    return;
  end if;

  if not found
    or current_limit.window_start <= now_at - make_interval(secs => window_seconds)
  then
    insert into public.auth_rate_limits (
      scope,
      key_hash,
      attempt_count,
      window_start,
      blocked_until,
      updated_at
    )
    values (
      target_scope,
      target_key_hash,
      1,
      now_at,
      null,
      now_at
    )
    on conflict (scope, key_hash)
    do update set
      attempt_count = 1,
      window_start = excluded.window_start,
      blocked_until = null,
      updated_at = excluded.updated_at;

    return query select true, 0;
    return;
  end if;

  next_attempt_count := current_limit.attempt_count + 1;
  next_blocked_until := null;

  if next_attempt_count > max_attempts then
    next_blocked_until := now_at + make_interval(secs => block_seconds);
  end if;

  update public.auth_rate_limits
  set
    attempt_count = next_attempt_count,
    blocked_until = next_blocked_until,
    updated_at = now_at
  where scope = target_scope
    and key_hash = target_key_hash;

  if next_blocked_until is not null then
    return query select false, block_seconds;
    return;
  end if;

  return query select true, 0;
end;
$$;

ALTER FUNCTION "public"."auth_rate_limit_record_attempt"("target_scope" "text", "target_key_hash" "text", "max_attempts" integer, "window_seconds" integer, "block_seconds" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."auth_rate_limit_reset"("target_scope" "text", "target_key_hash" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  delete from public.auth_rate_limits
  where scope = target_scope
    and key_hash = target_key_hash;
end;
$$;

ALTER FUNCTION "public"."auth_rate_limit_reset"("target_scope" "text", "target_key_hash" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_conversation_participant"("target_conversation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.conversations
    where id = target_conversation_id
      and (
        client_id = auth.uid()
        or provider_id = auth.uid()
      )
  );
$$;

ALTER FUNCTION "public"."is_conversation_participant"("target_conversation_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."owns_project"("target_project_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.projects
    where id = target_project_id
      and client_id = auth.uid()
  );
$$;

ALTER FUNCTION "public"."owns_project"("target_project_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."owns_provider_profile"("target_provider_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.provider_profiles
    where id = target_provider_profile_id
      and user_id = auth.uid()
  );
$$;

ALTER FUNCTION "public"."owns_provider_profile"("target_provider_profile_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."provider_has_application_for_project"("target_project_id" "uuid", "target_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select exists (
      select 1
      from public.applications a
      where a.project_id = target_project_id
        and a.provider_id = target_provider_id
    );
  $$;

ALTER FUNCTION "public"."provider_has_application_for_project"("target_project_id" "uuid", "target_provider_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reject_project_application"("target_application_id" "uuid") RETURNS TABLE("application_id" "uuid", "application_status" "public"."application_status", "project_id" "uuid", "project_status" "public"."project_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_user_id uuid := auth.uid();
  selected_application record;
  selected_project record;
  active_application_id uuid;
begin
  if current_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  select
    a.id,
    a.project_id,
    a.provider_id,
    a.status
  into selected_application
  from public.applications a
  where a.id = target_application_id
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  select
    p.id,
    p.client_id,
    p.status
  into selected_project
  from public.projects p
  where p.id = selected_application.project_id
  for update;

  if not found then
    raise exception 'Project not found.';
  end if;

  if selected_project.client_id <> current_user_id then
    raise exception 'Application not found.';
  end if;

  if selected_application.status = 'rejected' then
    return query
    select
      selected_application.id,
      'rejected'::public.application_status,
      selected_project.id,
      selected_project.status;
    return;
  end if;

  if selected_application.status in ('accepted', 'withdrawn') then
    raise exception 'This application can no longer be rejected.';
  end if;

  if selected_application.status not in ('pending', 'viewed', 'shortlisted') then
    raise exception 'This application can no longer be rejected.';
  end if;

  update public.applications
  set status = 'rejected'
  where id = selected_application.id;

  if selected_project.status = 'in_discussion' then
    select a.id
    into active_application_id
    from public.applications a
    where a.project_id = selected_application.project_id
      and a.status in ('pending', 'viewed', 'shortlisted', 'accepted')
    limit 1;

    if active_application_id is null then
      update public.projects
      set status = 'published'
      where id = selected_project.id
        and status = 'in_discussion'
      returning id, client_id, status into selected_project;
    end if;
  end if;

  return query
  select
    selected_application.id,
    'rejected'::public.application_status,
    selected_project.id,
    selected_project.status;
end;
$$;

ALTER FUNCTION "public"."reject_project_application"("target_application_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."withdraw_project_application"("target_application_id" "uuid") RETURNS TABLE("application_id" "uuid", "application_status" "public"."application_status", "project_id" "uuid", "project_status" "public"."project_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  declare
    current_user_id uuid := auth.uid();
    selected_application record;
    selected_project record;
    active_application_id uuid;
  begin
    if current_user_id is null then
      raise exception 'Unauthorized.';
    end if;

    select
      a.id,
      a.project_id,
      a.provider_id,
      a.status
    into selected_application
    from public.applications a
    where a.id = target_application_id
    for update;

    if not found then
      raise exception 'Application not found.';
    end if;

    if selected_application.provider_id <> current_user_id then
      raise exception 'Application not found.';
    end if;

    if selected_application.status = 'withdrawn' then
      select p.id, p.status
      into selected_project
      from public.projects p
      where p.id = selected_application.project_id;

      if not found then
        raise exception 'Project not found.';
      end if;

      return query
      select
        selected_application.id,
        'withdrawn'::public.application_status,
        selected_project.id,
        selected_project.status;
      return;
    end if;

    if selected_application.status in ('accepted', 'rejected') then
      raise exception 'This application can no longer be withdrawn.';
    end if;

    if selected_application.status not in ('pending', 'viewed', 'shortlisted') then
      raise exception 'This application can no longer be withdrawn.';
    end if;

    update public.applications
    set status = 'withdrawn'
    where id = selected_application.id;

    select
      p.id,
      p.status
    into selected_project
    from public.projects p
    where p.id = selected_application.project_id
    for update;

    if not found then
      raise exception 'Project not found.';
    end if;

    if selected_project.status = 'in_discussion' then
      select a.id
      into active_application_id
      from public.applications a
      where a.project_id = selected_application.project_id
        and a.status in ('pending', 'viewed', 'shortlisted', 'accepted')
      limit 1;

      if active_application_id is null then
        update public.projects
        set status = 'published'
        where id = selected_project.id
          and status = 'in_discussion'
        returning id, status into selected_project;
      end if;
    end if;

    return query
    select
      selected_application.id,
      'withdrawn'::public.application_status,
      selected_project.id,
      selected_project.status;
  end;
  $$;

ALTER FUNCTION "public"."withdraw_project_application"("target_application_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "cover_message" "text" NOT NULL,
    "proposed_price" numeric(10,2),
    "estimated_delivery_days" integer,
    "status" "public"."application_status" DEFAULT 'pending'::"public"."application_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "applications_estimated_delivery_days_check" CHECK ((("estimated_delivery_days" IS NULL) OR ("estimated_delivery_days" > 0))),
    CONSTRAINT "applications_proposed_price_check" CHECK ((("proposed_price" IS NULL) OR ("proposed_price" >= (0)::numeric)))
);

ALTER TABLE "public"."applications" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."auth_rate_limits" (
    "scope" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "window_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "blocked_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."auth_rate_limits" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."business_domains" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."business_domains" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."client_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_name" "text" NOT NULL,
    "business_type" "text",
    "business_description" "text",
    "website_url" "text",
    "company_size" "text",
    "preferred_language" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "business_type_text" "text",
    "target_market_text" "text",
    "business_tax_id" "text",
    "project_idea" "text",
    "interested_solution_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "interested_solution_other_text" "text"
);

ALTER TABLE "public"."client_profiles" OWNER TO "postgres";

COMMENT ON COLUMN "public"."client_profiles"."business_type_text" IS 'Free-text description of what the client business does.';

COMMENT ON COLUMN "public"."client_profiles"."target_market_text" IS 'Free-text description of the client target market or audience.';

CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "application_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."conversations" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."feature_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."feature_tags" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "provider_profile_id" "uuid" NOT NULL,
    "score" numeric(5,2) NOT NULL,
    "status" "public"."match_status" DEFAULT 'suggested'::"public"."match_status" NOT NULL,
    "score_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    "matched_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "matches_score_check" CHECK ((("score" >= (0)::numeric) AND ("score" <= (100)::numeric)))
);

ALTER TABLE "public"."matches" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "message_text" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."messages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "avatar_url" "text",
    "phone" "text",
    "country" "text",
    "city" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."project_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL
);

ALTER TABLE "public"."project_categories" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."project_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."project_goals" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."project_request_features" (
    "project_id" "uuid" NOT NULL,
    "feature_id" "uuid" NOT NULL,
    "priority" smallint DEFAULT 2 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "project_request_features_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 3)))
);

ALTER TABLE "public"."project_request_features" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."project_request_goals" (
    "project_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."project_request_goals" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text" NOT NULL,
    "business_industry" "text",
    "goal" "text",
    "budget_type" "public"."budget_type" DEFAULT 'negotiable'::"public"."budget_type" NOT NULL,
    "budget_min" numeric(10,2),
    "budget_max" numeric(10,2),
    "deadline_type" "public"."deadline_type" DEFAULT 'flexible'::"public"."deadline_type" NOT NULL,
    "deadline_date" "date",
    "preferred_provider_type" "public"."preferred_provider_type" DEFAULT 'any'::"public"."preferred_provider_type" NOT NULL,
    "preferred_language" "text",
    "has_existing_website" boolean DEFAULT false NOT NULL,
    "existing_website_url" "text",
    "needs_design" boolean DEFAULT false NOT NULL,
    "needs_content_writing" boolean DEFAULT false NOT NULL,
    "needs_seo" boolean DEFAULT false NOT NULL,
    "status" "public"."project_status" DEFAULT 'draft'::"public"."project_status" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_type_id" "uuid",
    "business_domain_id" "uuid",
    "readiness_level" "public"."project_readiness_level",
    "scope_level" "public"."project_scope_level",
    "estimated_pages" integer,
    "desired_start_date" "date",
    "is_remote_friendly" boolean DEFAULT true NOT NULL,
    "discovery_notes" "text",
    "business_context_text" "text",
    "business_domain_other_text" "text",
    "what_do_you_need_text" "text",
    "target_audience_text" "text",
    "success_criteria_text" "text",
    "goal_other_text" "text",
    CONSTRAINT "chk_project_budget_range" CHECK ((("budget_min" IS NULL) OR ("budget_max" IS NULL) OR ("budget_min" <= "budget_max"))),
    CONSTRAINT "projects_budget_max_check" CHECK (("budget_max" >= (0)::numeric)),
    CONSTRAINT "projects_budget_min_check" CHECK (("budget_min" >= (0)::numeric)),
    CONSTRAINT "projects_estimated_pages_check" CHECK ((("estimated_pages" IS NULL) OR ("estimated_pages" > 0)))
);

ALTER TABLE "public"."projects" OWNER TO "postgres";

COMMENT ON COLUMN "public"."projects"."business_context_text" IS 'Free-text business context for the project request.';

COMMENT ON COLUMN "public"."projects"."business_domain_other_text" IS 'Used when predefined business domains do not fit and the client enters a custom domain description.';

COMMENT ON COLUMN "public"."projects"."what_do_you_need_text" IS 'Free-text explanation of what the client wants built.';

COMMENT ON COLUMN "public"."projects"."target_audience_text" IS 'Free-text description of the intended users or audience for the project.';

COMMENT ON COLUMN "public"."projects"."success_criteria_text" IS 'Free-text description of what success looks like for the project.';

COMMENT ON COLUMN "public"."projects"."goal_other_text" IS 'Used when predefined project goals do not fit and the client enters a custom goal.';

CREATE TABLE IF NOT EXISTS "public"."provider_business_domains" (
    "provider_profile_id" "uuid" NOT NULL,
    "business_domain_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."provider_business_domains" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."provider_feature_capabilities" (
    "provider_profile_id" "uuid" NOT NULL,
    "feature_id" "uuid" NOT NULL,
    "strength" "public"."capability_strength" DEFAULT 'strong'::"public"."capability_strength" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."provider_feature_capabilities" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."provider_goal_focuses" (
    "provider_profile_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."provider_goal_focuses" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."provider_languages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_profile_id" "uuid" NOT NULL,
    "language_code" "text" NOT NULL,
    "language_name" "text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."provider_languages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."provider_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider_type" "public"."provider_type" NOT NULL,
    "headline" "text",
    "bio" "text",
    "years_of_experience" integer,
    "portfolio_url" "text",
    "hourly_rate_min" numeric(10,2),
    "hourly_rate_max" numeric(10,2),
    "fixed_price_min" numeric(10,2),
    "fixed_price_max" numeric(10,2),
    "availability" "public"."availability_status" DEFAULT 'available'::"public"."availability_status" NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "average_rating" numeric(3,2) DEFAULT 0 NOT NULL,
    "total_reviews" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text",
    "company_name" "text",
    "team_size" integer,
    "project_budget_min" numeric(12,2),
    "project_budget_max" numeric(12,2),
    "preferred_scope" "public"."project_scope_level",
    "services_text" "text",
    "industries_text" "text",
    "ideal_client_text" "text",
    "tech_capabilities_text" "text",
    "business_domain_other_text" "text",
    "tax_id" "text",
    "social_link" "text",
    "service_categories" "public"."provider_service_category"[] DEFAULT '{}'::"public"."provider_service_category"[] NOT NULL,
    "service_category_other_text" "text",
    "about" "text",
    CONSTRAINT "chk_provider_fixed_range" CHECK ((("fixed_price_min" IS NULL) OR ("fixed_price_max" IS NULL) OR ("fixed_price_min" <= "fixed_price_max"))),
    CONSTRAINT "chk_provider_hourly_range" CHECK ((("hourly_rate_min" IS NULL) OR ("hourly_rate_max" IS NULL) OR ("hourly_rate_min" <= "hourly_rate_max"))),
    CONSTRAINT "provider_profiles_about_length" CHECK ((("about" IS NULL) OR ("char_length"("about") <= 3000))),
    CONSTRAINT "provider_profiles_average_rating_check" CHECK ((("average_rating" >= (0)::numeric) AND ("average_rating" <= (5)::numeric))),
    CONSTRAINT "provider_profiles_fixed_price_max_check" CHECK (("fixed_price_max" >= (0)::numeric)),
    CONSTRAINT "provider_profiles_fixed_price_min_check" CHECK (("fixed_price_min" >= (0)::numeric)),
    CONSTRAINT "provider_profiles_hourly_rate_max_check" CHECK (("hourly_rate_max" >= (0)::numeric)),
    CONSTRAINT "provider_profiles_hourly_rate_min_check" CHECK (("hourly_rate_min" >= (0)::numeric)),
    CONSTRAINT "provider_profiles_project_budget_max_check" CHECK ((("project_budget_max" IS NULL) OR ("project_budget_max" >= (0)::numeric))),
    CONSTRAINT "provider_profiles_project_budget_min_check" CHECK ((("project_budget_min" IS NULL) OR ("project_budget_min" >= (0)::numeric))),
    CONSTRAINT "provider_profiles_service_categories_not_empty" CHECK (("cardinality"("service_categories") > 0)),
    CONSTRAINT "provider_profiles_service_category_other_text_required" CHECK (((NOT ('other'::"public"."provider_service_category" = ANY ("service_categories"))) OR (NULLIF("btrim"("service_category_other_text"), ''::"text") IS NOT NULL))),
    CONSTRAINT "provider_profiles_social_link_format" CHECK ((("social_link" IS NULL) OR ("btrim"("social_link") = ''::"text") OR ("social_link" ~* '^https?://'::"text"))),
    CONSTRAINT "provider_profiles_tax_id_format" CHECK ((("tax_id" IS NULL) OR ("btrim"("tax_id") = ''::"text") OR ("btrim"("tax_id") ~ '^[0-9]{8,12}$'::"text"))),
    CONSTRAINT "provider_profiles_tax_id_required_for_business_types" CHECK ((("provider_type" <> ALL (ARRAY['agency'::"public"."provider_type", 'company'::"public"."provider_type", 'studio'::"public"."provider_type"])) OR (NULLIF("btrim"("tax_id"), ''::"text") IS NOT NULL))),
    CONSTRAINT "provider_profiles_team_size_check" CHECK ((("team_size" IS NULL) OR ("team_size" > 0))),
    CONSTRAINT "provider_profiles_total_reviews_check" CHECK (("total_reviews" >= 0)),
    CONSTRAINT "provider_profiles_years_of_experience_check" CHECK (("years_of_experience" >= 0)),
    CONSTRAINT "provider_profiles_years_of_experience_nonnegative" CHECK ((("years_of_experience" IS NULL) OR ("years_of_experience" >= 0)))
);

ALTER TABLE "public"."provider_profiles" OWNER TO "postgres";

COMMENT ON COLUMN "public"."provider_profiles"."services_text" IS 'Free-text description of the services the provider offers.';

COMMENT ON COLUMN "public"."provider_profiles"."industries_text" IS 'Free-text description of industries the provider works with.';

COMMENT ON COLUMN "public"."provider_profiles"."ideal_client_text" IS 'Free-text description of the provider ideal client profile.';

COMMENT ON COLUMN "public"."provider_profiles"."tech_capabilities_text" IS 'Free-text description of technical capabilities, stack, or delivery strengths.';

COMMENT ON COLUMN "public"."provider_profiles"."business_domain_other_text" IS 'Used when predefined business domains do not fit and the provider enters a custom domain description.';

COMMENT ON COLUMN "public"."provider_profiles"."tax_id" IS 'PIB. Required for agency/company/studio providers.';

COMMENT ON COLUMN "public"."provider_profiles"."social_link" IS 'Optional GitHub or LinkedIn profile link.';

COMMENT ON COLUMN "public"."provider_profiles"."service_categories" IS 'Selected service categories from provider onboarding.';

COMMENT ON COLUMN "public"."provider_profiles"."service_category_other_text" IS 'Free-text category description when "other" is selected.';

COMMENT ON COLUMN "public"."provider_profiles"."about" IS 'Optional provider about text shown on the profile.';

CREATE TABLE IF NOT EXISTS "public"."provider_service_types" (
    "provider_profile_id" "uuid" NOT NULL,
    "service_type_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."provider_service_types" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."service_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."service_types" OWNER TO "postgres";

ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."auth_rate_limits"
    ADD CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("scope", "key_hash");

ALTER TABLE ONLY "public"."business_domains"
    ADD CONSTRAINT "business_domains_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."business_domains"
    ADD CONSTRAINT "business_domains_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."client_profiles"
    ADD CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."client_profiles"
    ADD CONSTRAINT "client_profiles_user_id_key" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."feature_tags"
    ADD CONSTRAINT "feature_tags_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."feature_tags"
    ADD CONSTRAINT "feature_tags_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_project_id_provider_profile_id_key" UNIQUE ("project_id", "provider_profile_id");

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."project_categories"
    ADD CONSTRAINT "project_categories_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."project_categories"
    ADD CONSTRAINT "project_categories_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."project_categories"
    ADD CONSTRAINT "project_categories_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."project_goals"
    ADD CONSTRAINT "project_goals_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."project_goals"
    ADD CONSTRAINT "project_goals_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."project_request_features"
    ADD CONSTRAINT "project_request_features_pkey" PRIMARY KEY ("project_id", "feature_id");

ALTER TABLE ONLY "public"."project_request_goals"
    ADD CONSTRAINT "project_request_goals_pkey" PRIMARY KEY ("project_id", "goal_id");

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."provider_business_domains"
    ADD CONSTRAINT "provider_business_domains_pkey" PRIMARY KEY ("provider_profile_id", "business_domain_id");

ALTER TABLE ONLY "public"."provider_feature_capabilities"
    ADD CONSTRAINT "provider_feature_capabilities_pkey" PRIMARY KEY ("provider_profile_id", "feature_id");

ALTER TABLE ONLY "public"."provider_goal_focuses"
    ADD CONSTRAINT "provider_goal_focuses_pkey" PRIMARY KEY ("provider_profile_id", "goal_id");

ALTER TABLE ONLY "public"."provider_languages"
    ADD CONSTRAINT "provider_languages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."provider_languages"
    ADD CONSTRAINT "provider_languages_provider_profile_id_language_code_key" UNIQUE ("provider_profile_id", "language_code");

ALTER TABLE ONLY "public"."provider_profiles"
    ADD CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."provider_profiles"
    ADD CONSTRAINT "provider_profiles_user_id_key" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."provider_service_types"
    ADD CONSTRAINT "provider_service_types_pkey" PRIMARY KEY ("provider_profile_id", "service_type_id");

ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "uq_conversation_triplet" UNIQUE ("project_id", "client_id", "provider_id");

ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "uq_project_provider_application" UNIQUE ("project_id", "provider_id");

CREATE UNIQUE INDEX "applications_one_accepted_per_project_idx" ON "public"."applications" USING "btree" ("project_id") WHERE ("status" = 'accepted'::"public"."application_status");

CREATE UNIQUE INDEX "applications_project_provider_unique_idx" ON "public"."applications" USING "btree" ("project_id", "provider_id");

CREATE INDEX "applications_project_status_idx" ON "public"."applications" USING "btree" ("project_id", "status");

CREATE INDEX "applications_provider_created_at_idx" ON "public"."applications" USING "btree" ("provider_id", "created_at" DESC);

CREATE UNIQUE INDEX "conversations_application_id_unique_idx" ON "public"."conversations" USING "btree" ("application_id") WHERE ("application_id" IS NOT NULL);

CREATE INDEX "conversations_client_updated_at_idx" ON "public"."conversations" USING "btree" ("client_id", "updated_at" DESC);

CREATE INDEX "conversations_provider_updated_at_idx" ON "public"."conversations" USING "btree" ("provider_id", "updated_at" DESC);

CREATE INDEX "idx_applications_project_id" ON "public"."applications" USING "btree" ("project_id");

CREATE INDEX "idx_applications_provider_id" ON "public"."applications" USING "btree" ("provider_id");

CREATE INDEX "idx_applications_status" ON "public"."applications" USING "btree" ("status");

CREATE INDEX "idx_client_profiles_user_id" ON "public"."client_profiles" USING "btree" ("user_id");

CREATE INDEX "idx_conversations_client_id" ON "public"."conversations" USING "btree" ("client_id");

CREATE INDEX "idx_conversations_project_id" ON "public"."conversations" USING "btree" ("project_id");

CREATE INDEX "idx_conversations_provider_id" ON "public"."conversations" USING "btree" ("provider_id");

CREATE INDEX "idx_matches_project_status_score" ON "public"."matches" USING "btree" ("project_id", "status", "score" DESC);

CREATE INDEX "idx_matches_provider_status_score" ON "public"."matches" USING "btree" ("provider_profile_id", "status", "score" DESC);

CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");

CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at" DESC);

CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");

CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");

CREATE INDEX "idx_project_request_features_feature_id" ON "public"."project_request_features" USING "btree" ("feature_id");

CREATE INDEX "idx_project_request_goals_goal_id" ON "public"."project_request_goals" USING "btree" ("goal_id");

CREATE INDEX "idx_projects_business_domain_id" ON "public"."projects" USING "btree" ("business_domain_id");

CREATE INDEX "idx_projects_category_id" ON "public"."projects" USING "btree" ("category_id");

CREATE INDEX "idx_projects_client_id" ON "public"."projects" USING "btree" ("client_id");

CREATE INDEX "idx_projects_created_at" ON "public"."projects" USING "btree" ("created_at" DESC);

CREATE INDEX "idx_projects_service_type_id" ON "public"."projects" USING "btree" ("service_type_id");

CREATE INDEX "idx_projects_status" ON "public"."projects" USING "btree" ("status");

CREATE INDEX "idx_provider_feature_capabilities_feature_id" ON "public"."provider_feature_capabilities" USING "btree" ("feature_id");

CREATE INDEX "idx_provider_goal_focuses_goal_id" ON "public"."provider_goal_focuses" USING "btree" ("goal_id");

CREATE INDEX "idx_provider_profiles_availability" ON "public"."provider_profiles" USING "btree" ("availability");

CREATE INDEX "idx_provider_profiles_budget" ON "public"."provider_profiles" USING "btree" ("project_budget_min", "project_budget_max");

CREATE INDEX "idx_provider_profiles_is_verified" ON "public"."provider_profiles" USING "btree" ("is_verified");

CREATE INDEX "idx_provider_profiles_provider_type" ON "public"."provider_profiles" USING "btree" ("provider_type");

CREATE INDEX "idx_provider_profiles_user_id" ON "public"."provider_profiles" USING "btree" ("user_id");

CREATE INDEX "messages_conversation_created_at_idx" ON "public"."messages" USING "btree" ("conversation_id", "created_at");

CREATE INDEX "provider_profiles_service_categories_gin_idx" ON "public"."provider_profiles" USING "gin" ("service_categories");

CREATE OR REPLACE TRIGGER "set_updated_at_business_domains" BEFORE UPDATE ON "public"."business_domains" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_updated_at_feature_tags" BEFORE UPDATE ON "public"."feature_tags" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_updated_at_matches" BEFORE UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_updated_at_project_goals" BEFORE UPDATE ON "public"."project_goals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_updated_at_service_types" BEFORE UPDATE ON "public"."service_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_applications_updated_at" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_provider_profiles_updated_at" BEFORE UPDATE ON "public"."provider_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."client_profiles"
    ADD CONSTRAINT "client_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_request_features"
    ADD CONSTRAINT "project_request_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."feature_tags"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_request_features"
    ADD CONSTRAINT "project_request_features_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_request_goals"
    ADD CONSTRAINT "project_request_goals_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."project_goals"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_request_goals"
    ADD CONSTRAINT "project_request_goals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_business_domain_id_fkey" FOREIGN KEY ("business_domain_id") REFERENCES "public"."business_domains"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."project_categories"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."provider_business_domains"
    ADD CONSTRAINT "provider_business_domains_business_domain_id_fkey" FOREIGN KEY ("business_domain_id") REFERENCES "public"."business_domains"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."provider_business_domains"
    ADD CONSTRAINT "provider_business_domains_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."provider_feature_capabilities"
    ADD CONSTRAINT "provider_feature_capabilities_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."feature_tags"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."provider_feature_capabilities"
    ADD CONSTRAINT "provider_feature_capabilities_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."provider_goal_focuses"
    ADD CONSTRAINT "provider_goal_focuses_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."project_goals"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."provider_goal_focuses"
    ADD CONSTRAINT "provider_goal_focuses_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."provider_languages"
    ADD CONSTRAINT "provider_languages_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."provider_profiles"
    ADD CONSTRAINT "provider_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."provider_service_types"
    ADD CONSTRAINT "provider_service_types_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."provider_service_types"
    ADD CONSTRAINT "provider_service_types_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE CASCADE;

CREATE POLICY "Applications are readable by related users or admin" ON "public"."applications" FOR SELECT TO "authenticated" USING ((("provider_id" = "auth"."uid"()) OR "public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "applications"."project_id") AND ("projects"."client_id" = "auth"."uid"()))))));

CREATE POLICY "Client profiles are insertable by owner or admin" ON "public"."client_profiles" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Client profiles are readable by owner or admin" ON "public"."client_profiles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Client profiles are updatable by owner or admin" ON "public"."client_profiles" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Conversations are readable by participants or admin" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR ("provider_id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Conversations are updatable by participants or admin" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR ("provider_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("client_id" = "auth"."uid"()) OR ("provider_id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Matches are manageable by admin only" ON "public"."matches" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Matches are readable by related users or admin" ON "public"."matches" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR "public"."owns_project"("project_id") OR "public"."owns_provider_profile"("provider_profile_id")));

CREATE POLICY "Messages are readable by conversation participants or admin" ON "public"."messages" FOR SELECT TO "authenticated" USING (("public"."is_conversation_participant"("conversation_id") OR "public"."is_admin"()));

CREATE POLICY "Messages are updatable by sender participant or admin" ON "public"."messages" FOR UPDATE TO "authenticated" USING (((("sender_id" = "auth"."uid"()) AND "public"."is_conversation_participant"("conversation_id")) OR "public"."is_admin"())) WITH CHECK (((("sender_id" = "auth"."uid"()) AND "public"."is_conversation_participant"("conversation_id")) OR "public"."is_admin"()));

CREATE POLICY "Profiles are insertable by owner or admin" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Profiles are readable by owner or admin" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Profiles are updatable by owner or admin" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Project categories are manageable by admin" ON "public"."project_categories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Project categories are readable by authenticated users" ON "public"."project_categories" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Project feature links are manageable by project owner or admin" ON "public"."project_request_features" TO "authenticated" USING (("public"."owns_project"("project_id") OR "public"."is_admin"())) WITH CHECK (("public"."owns_project"("project_id") OR "public"."is_admin"()));

CREATE POLICY "Project feature links are readable by related users or admin" ON "public"."project_request_features" FOR SELECT TO "authenticated" USING (("public"."owns_project"("project_id") OR "public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "project_request_features"."project_id") AND ("projects"."status" = 'published'::"public"."project_status") AND (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'provider'::"public"."user_role")))))))));

CREATE POLICY "Project goals links are manageable by project owner or admin" ON "public"."project_request_goals" TO "authenticated" USING (("public"."owns_project"("project_id") OR "public"."is_admin"())) WITH CHECK (("public"."owns_project"("project_id") OR "public"."is_admin"()));

CREATE POLICY "Project goals links are readable by related users or admin" ON "public"."project_request_goals" FOR SELECT TO "authenticated" USING (("public"."owns_project"("project_id") OR "public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "project_request_goals"."project_id") AND ("projects"."status" = 'published'::"public"."project_status") AND (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'provider'::"public"."user_role")))))))));

CREATE POLICY "Projects are deletable by owning client or admin" ON "public"."projects" FOR DELETE TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Projects are insertable by owning client or admin" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK ((("client_id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Projects are readable by owner admin or providers when visible" ON "public"."projects" FOR SELECT TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR "public"."is_admin"() OR (("status" = ANY (ARRAY['published'::"public"."project_status", 'in_discussion'::"public"."project_status"])) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'provider'::"public"."user_role")))))));

CREATE POLICY "Projects are updatable by owning client or admin" ON "public"."projects" FOR UPDATE TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("client_id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Provider business domains are manageable by owner or admin" ON "public"."provider_business_domains" TO "authenticated" USING (("public"."owns_provider_profile"("provider_profile_id") OR "public"."is_admin"())) WITH CHECK (("public"."owns_provider_profile"("provider_profile_id") OR "public"."is_admin"()));

CREATE POLICY "Provider business domains are publicly readable" ON "public"."provider_business_domains" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Provider feature capabilities are manageable by owner or admin" ON "public"."provider_feature_capabilities" TO "authenticated" USING (("public"."owns_provider_profile"("provider_profile_id") OR "public"."is_admin"())) WITH CHECK (("public"."owns_provider_profile"("provider_profile_id") OR "public"."is_admin"()));

CREATE POLICY "Provider feature capabilities are publicly readable" ON "public"."provider_feature_capabilities" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Provider goal focuses are manageable by owner or admin" ON "public"."provider_goal_focuses" TO "authenticated" USING (("public"."owns_provider_profile"("provider_profile_id") OR "public"."is_admin"())) WITH CHECK (("public"."owns_provider_profile"("provider_profile_id") OR "public"."is_admin"()));

CREATE POLICY "Provider goal focuses are publicly readable" ON "public"."provider_goal_focuses" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Provider languages are manageable by owner or admin" ON "public"."provider_languages" TO "authenticated" USING (("public"."owns_provider_profile"("provider_profile_id") OR "public"."is_admin"())) WITH CHECK (("public"."owns_provider_profile"("provider_profile_id") OR "public"."is_admin"()));

CREATE POLICY "Provider languages are publicly readable" ON "public"."provider_languages" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Provider profiles are insertable by owner or admin" ON "public"."provider_profiles" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Provider profiles are publicly readable" ON "public"."provider_profiles" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Provider profiles are updatable by owner or admin" ON "public"."provider_profiles" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));

CREATE POLICY "Provider service types are manageable by owner or admin" ON "public"."provider_service_types" TO "authenticated" USING (("public"."owns_provider_profile"("provider_profile_id") OR "public"."is_admin"())) WITH CHECK (("public"."owns_provider_profile"("provider_profile_id") OR "public"."is_admin"()));

CREATE POLICY "Provider service types are publicly readable" ON "public"."provider_service_types" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Taxonomies are manageable by admin business domains" ON "public"."business_domains" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Taxonomies are manageable by admin feature tags" ON "public"."feature_tags" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Taxonomies are manageable by admin project goals" ON "public"."project_goals" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Taxonomies are manageable by admin service types" ON "public"."service_types" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Taxonomies are readable by authenticated users" ON "public"."business_domains" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Taxonomies are readable by authenticated users" ON "public"."feature_tags" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Taxonomies are readable by authenticated users" ON "public"."project_goals" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Taxonomies are readable by authenticated users" ON "public"."service_types" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Visible marketplace projects are readable by everyone" ON "public"."projects" FOR SELECT TO "authenticated", "anon" USING (("status" = ANY (ARRAY['published'::"public"."project_status", 'in_discussion'::"public"."project_status"])));

ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_insert_provider_open_project" ON "public"."applications" FOR INSERT TO "authenticated" WITH CHECK (((("provider_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "pr"
  WHERE (("pr"."id" = "auth"."uid"()) AND ("pr"."role" = 'provider'::"public"."user_role")))) AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "applications"."project_id") AND ("p"."status" = ANY (ARRAY['published'::"public"."project_status", 'in_discussion'::"public"."project_status"])) AND ("p"."client_id" <> "auth"."uid"()))))) OR "public"."is_admin"()));

CREATE POLICY "applications_select_related_users" ON "public"."applications" FOR SELECT TO "authenticated" USING ((("provider_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "applications"."project_id") AND ("p"."client_id" = "auth"."uid"()))))));

CREATE POLICY "applications_update_client_owner_or_admin" ON "public"."applications" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "applications"."project_id") AND ("p"."client_id" = "auth"."uid"())))))) WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "applications"."project_id") AND ("p"."client_id" = "auth"."uid"()))))));

CREATE POLICY "applications_update_provider_withdraw_own" ON "public"."applications" FOR UPDATE TO "authenticated" USING ((("provider_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['pending'::"public"."application_status", 'viewed'::"public"."application_status", 'shortlisted'::"public"."application_status"])))) WITH CHECK ((("provider_id" = "auth"."uid"()) AND ("status" = 'withdrawn'::"public"."application_status")));

ALTER TABLE "public"."auth_rate_limits" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."business_domains" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."client_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_profiles_insert_own" ON "public"."client_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "client_profiles_select_all_authenticated" ON "public"."client_profiles" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "client_profiles_update_own" ON "public"."client_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_insert_valid_application_participant" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."applications" "a"
     JOIN "public"."projects" "p" ON (("p"."id" = "a"."project_id")))
  WHERE (("a"."id" = "conversations"."application_id") AND ("conversations"."project_id" = "a"."project_id") AND ("conversations"."provider_id" = "a"."provider_id") AND ("conversations"."client_id" = "p"."client_id") AND ("a"."status" = ANY (ARRAY['pending'::"public"."application_status", 'viewed'::"public"."application_status", 'shortlisted'::"public"."application_status", 'accepted'::"public"."application_status"])) AND (("conversations"."client_id" = "auth"."uid"()) OR ("conversations"."provider_id" = "auth"."uid"()) OR "public"."is_admin"())))));

CREATE POLICY "conversations_select_participants" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR ("provider_id" = "auth"."uid"())));

CREATE POLICY "conversations_update_participants_only" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR ("provider_id" = "auth"."uid"()))) WITH CHECK ((("client_id" = "auth"."uid"()) OR ("provider_id" = "auth"."uid"())));

ALTER TABLE "public"."feature_tags" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_conversation_participants" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."client_id" = "auth"."uid"()) OR ("c"."provider_id" = "auth"."uid"()))))));

CREATE POLICY "messages_update_participants_only" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."client_id" = "auth"."uid"()) OR ("c"."provider_id" = "auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."client_id" = "auth"."uid"()) OR ("c"."provider_id" = "auth"."uid"()))))));

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "profiles_select_own_or_public" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));

ALTER TABLE "public"."project_categories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_categories_select_all_authenticated" ON "public"."project_categories" FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."project_goals" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."project_request_features" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."project_request_goals" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_delete_own" ON "public"."projects" FOR DELETE TO "authenticated" USING (("client_id" = "auth"."uid"()));

CREATE POLICY "projects_insert_client_own" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK (("client_id" = "auth"."uid"()));

CREATE POLICY "projects_select_visible_or_own" ON "public"."projects" FOR SELECT TO "authenticated" USING ((("status" = ANY (ARRAY['published'::"public"."project_status", 'in_discussion'::"public"."project_status"])) OR ("client_id" = "auth"."uid"())));

CREATE POLICY "projects_update_own" ON "public"."projects" FOR UPDATE TO "authenticated" USING (("client_id" = "auth"."uid"())) WITH CHECK (("client_id" = "auth"."uid"()));

ALTER TABLE "public"."provider_business_domains" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."provider_feature_capabilities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."provider_goal_focuses" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."provider_languages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."provider_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_profiles_insert_own" ON "public"."provider_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "provider_profiles_select_all_authenticated" ON "public"."provider_profiles" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "provider_profiles_update_own" ON "public"."provider_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."provider_service_types" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "providers can read projects they applied to" ON "public"."projects" FOR SELECT TO "authenticated" USING ("public"."provider_has_application_for_project"("id", "auth"."uid"()));

ALTER TABLE "public"."service_types" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."accept_project_application"("target_application_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."accept_project_application"("target_application_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."accept_project_application"("target_application_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."auth_rate_limit_check"("target_scope" "text", "target_key_hash" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."auth_rate_limit_check"("target_scope" "text", "target_key_hash" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."auth_rate_limit_check"("target_scope" "text", "target_key_hash" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."auth_rate_limit_check"("target_scope" "text", "target_key_hash" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."auth_rate_limit_record_attempt"("target_scope" "text", "target_key_hash" "text", "max_attempts" integer, "window_seconds" integer, "block_seconds" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."auth_rate_limit_record_attempt"("target_scope" "text", "target_key_hash" "text", "max_attempts" integer, "window_seconds" integer, "block_seconds" integer) TO "anon";

GRANT ALL ON FUNCTION "public"."auth_rate_limit_record_attempt"("target_scope" "text", "target_key_hash" "text", "max_attempts" integer, "window_seconds" integer, "block_seconds" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."auth_rate_limit_record_attempt"("target_scope" "text", "target_key_hash" "text", "max_attempts" integer, "window_seconds" integer, "block_seconds" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."auth_rate_limit_reset"("target_scope" "text", "target_key_hash" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."auth_rate_limit_reset"("target_scope" "text", "target_key_hash" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."auth_rate_limit_reset"("target_scope" "text", "target_key_hash" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."auth_rate_limit_reset"("target_scope" "text", "target_key_hash" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";

GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";

GRANT ALL ON FUNCTION "public"."is_conversation_participant"("target_conversation_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."is_conversation_participant"("target_conversation_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_conversation_participant"("target_conversation_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."owns_project"("target_project_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."owns_project"("target_project_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."owns_project"("target_project_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."owns_provider_profile"("target_provider_profile_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."owns_provider_profile"("target_provider_profile_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."owns_provider_profile"("target_provider_profile_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."provider_has_application_for_project"("target_project_id" "uuid", "target_provider_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."provider_has_application_for_project"("target_project_id" "uuid", "target_provider_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."provider_has_application_for_project"("target_project_id" "uuid", "target_provider_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."provider_has_application_for_project"("target_project_id" "uuid", "target_provider_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."reject_project_application"("target_application_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."reject_project_application"("target_application_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."reject_project_application"("target_application_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."withdraw_project_application"("target_application_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."withdraw_project_application"("target_application_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."withdraw_project_application"("target_application_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."applications" TO "anon";

GRANT ALL ON TABLE "public"."applications" TO "authenticated";

GRANT ALL ON TABLE "public"."applications" TO "service_role";

GRANT ALL ON TABLE "public"."auth_rate_limits" TO "service_role";

-- Supabase default privileges grant new tables to anon and authenticated; production does not.
REVOKE ALL ON TABLE "public"."auth_rate_limits" FROM "anon", "authenticated";

GRANT ALL ON TABLE "public"."business_domains" TO "anon";

GRANT ALL ON TABLE "public"."business_domains" TO "authenticated";

GRANT ALL ON TABLE "public"."business_domains" TO "service_role";

GRANT ALL ON TABLE "public"."client_profiles" TO "anon";

GRANT ALL ON TABLE "public"."client_profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."client_profiles" TO "service_role";

GRANT ALL ON TABLE "public"."conversations" TO "anon";

GRANT ALL ON TABLE "public"."conversations" TO "authenticated";

GRANT ALL ON TABLE "public"."conversations" TO "service_role";

GRANT ALL ON TABLE "public"."feature_tags" TO "anon";

GRANT ALL ON TABLE "public"."feature_tags" TO "authenticated";

GRANT ALL ON TABLE "public"."feature_tags" TO "service_role";

GRANT ALL ON TABLE "public"."matches" TO "anon";

GRANT ALL ON TABLE "public"."matches" TO "authenticated";

GRANT ALL ON TABLE "public"."matches" TO "service_role";

GRANT ALL ON TABLE "public"."messages" TO "anon";

GRANT ALL ON TABLE "public"."messages" TO "authenticated";

GRANT ALL ON TABLE "public"."messages" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";

GRANT ALL ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."project_categories" TO "anon";

GRANT ALL ON TABLE "public"."project_categories" TO "authenticated";

GRANT ALL ON TABLE "public"."project_categories" TO "service_role";

GRANT ALL ON TABLE "public"."project_goals" TO "anon";

GRANT ALL ON TABLE "public"."project_goals" TO "authenticated";

GRANT ALL ON TABLE "public"."project_goals" TO "service_role";

GRANT ALL ON TABLE "public"."project_request_features" TO "anon";

GRANT ALL ON TABLE "public"."project_request_features" TO "authenticated";

GRANT ALL ON TABLE "public"."project_request_features" TO "service_role";

GRANT ALL ON TABLE "public"."project_request_goals" TO "anon";

GRANT ALL ON TABLE "public"."project_request_goals" TO "authenticated";

GRANT ALL ON TABLE "public"."project_request_goals" TO "service_role";

GRANT ALL ON TABLE "public"."projects" TO "anon";

GRANT ALL ON TABLE "public"."projects" TO "authenticated";

GRANT ALL ON TABLE "public"."projects" TO "service_role";

GRANT ALL ON TABLE "public"."provider_business_domains" TO "anon";

GRANT ALL ON TABLE "public"."provider_business_domains" TO "authenticated";

GRANT ALL ON TABLE "public"."provider_business_domains" TO "service_role";

GRANT ALL ON TABLE "public"."provider_feature_capabilities" TO "anon";

GRANT ALL ON TABLE "public"."provider_feature_capabilities" TO "authenticated";

GRANT ALL ON TABLE "public"."provider_feature_capabilities" TO "service_role";

GRANT ALL ON TABLE "public"."provider_goal_focuses" TO "anon";

GRANT ALL ON TABLE "public"."provider_goal_focuses" TO "authenticated";

GRANT ALL ON TABLE "public"."provider_goal_focuses" TO "service_role";

GRANT ALL ON TABLE "public"."provider_languages" TO "anon";

GRANT ALL ON TABLE "public"."provider_languages" TO "authenticated";

GRANT ALL ON TABLE "public"."provider_languages" TO "service_role";

GRANT ALL ON TABLE "public"."provider_profiles" TO "anon";

GRANT ALL ON TABLE "public"."provider_profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."provider_profiles" TO "service_role";

GRANT ALL ON TABLE "public"."provider_service_types" TO "anon";

GRANT ALL ON TABLE "public"."provider_service_types" TO "authenticated";

GRANT ALL ON TABLE "public"."provider_service_types" TO "service_role";

GRANT ALL ON TABLE "public"."service_types" TO "anon";

GRANT ALL ON TABLE "public"."service_types" TO "authenticated";

GRANT ALL ON TABLE "public"."service_types" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
