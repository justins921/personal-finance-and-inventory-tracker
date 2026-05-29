/* ============================================================================
 * config.js — deployment configuration.
 *
 * To enable accounts + cross-device cloud sync, create a free Supabase project
 * (https://supabase.com), run the SQL in `supabase-setup.sql`, then paste your
 * project's URL and PUBLIC anon key below.
 *
 *   • The anon key is meant to be public and safe to ship in client code —
 *     your data is protected by per-user Row Level Security (see the SQL file).
 *   • Leave these blank to run the app in LOCAL-ONLY mode (no login; data is
 *     stored only in this browser). The app works fully either way.
 *
 * Find these in Supabase: Project Settings → API → "Project URL" and
 * "Project API keys → anon / public".
 * ==========================================================================*/
window.APP_CONFIG = {
  SUPABASE_URL: "https://idpvetawhxapqdvckvcb.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkcHZldGF3aHhhcHFkdmNrdmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzIxODQsImV4cCI6MjA5NTY0ODE4NH0.6iJywQOYH51AJ1gnCs4Rz0z0iFAEmnoc-PLmZKveSUI",

  // Set to true to require sign-in (hide the "use on this device only" option).
  REQUIRE_LOGIN: false,
};
