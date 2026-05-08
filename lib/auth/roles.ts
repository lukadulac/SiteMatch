import type { Database } from "@/types/supabase";

export type UserRole = Database["public"]["Enums"]["user_role"];
export type MarketplaceRole = Exclude<UserRole, "admin">;
export type ProviderType = Database["public"]["Enums"]["provider_type"];
export type ProviderServiceCategory =
  Database["public"]["Enums"]["provider_service_category"];

export function isAppRole(role: unknown): role is UserRole {
  return role === "client" || role === "provider" || role === "admin";
}

export function isMarketplaceRole(role: unknown): role is MarketplaceRole {
  return role === "client" || role === "provider";
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
