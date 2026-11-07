// GENERATED from backend/src/contracts/auth/password.ts by scripts/sync-contracts.mjs. Do not edit;
// change the backend file and run npm run contracts:sync.
import { z } from "zod";

/** One password rule for register, reset and (later) account settings. 72 is bcrypt's input limit. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(72, "Password must be 72 characters or fewer.");
