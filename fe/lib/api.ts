/**
 * Compatibility facade. New feature code imports its domain API module and
 * shared transport code imports from `lib/api/client`.
 */

export * from "@/lib/api/client";
export * from "@/features/auth/api";
export * from "@/features/forecast/api";
export * from "@/features/alerts/api";
export * from "@/features/chat/api";
