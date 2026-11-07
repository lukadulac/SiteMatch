import type { Database } from "@/types/supabase";

export type UserRole = Database["public"]["Enums"]["user_role"];
export type ProviderType = Database["public"]["Enums"]["provider_type"];
export type ProviderServiceCategory =
  Database["public"]["Enums"]["provider_service_category"];

export function isAppRole(role: unknown): role is UserRole {
  return role === "client" || role === "provider" || role === "admin";
}

export function getDashboardPath(role: UserRole) {
  if (role === "client") {
    return "/dashboard/client";
  }

  if (role === "provider") {
    return "/dashboard/provider";
  }

  return "/dashboard/admin";
}
