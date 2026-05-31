/* ============================================================================
 * cloud.js — Supabase data sync.
 *
 * Stores each user's entire data object as a single JSON row in the
 * `user_data` table (one row per user, protected by Row Level Security).
 * Pull on login; debounced upsert on every change. Local cache remains the
 * offline fallback, so the app keeps working without a connection.
 * Attaches to window.App.cloud
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});

  const TABLE = "user_data";
  const DEBOUNCE_MS = 900;

  let client = null;
  let userId = null;
  let timer = null;
  let pending = null;
  let status = "offline"; // offline | synced | saving | error | loading
  const statusListeners = [];

  function setStatus(s, detail) {
    status = s;
    statusListeners.forEach((fn) => {
      try {
        fn(s, detail);
      } catch (e) {
        console.error(e);
      }
    });
  }

  const cloud = {
    init(supabaseClient) {
      client = supabaseClient;
    },

    onStatus(fn) {
      statusListeners.push(fn);
      return () => {
        const i = statusListeners.indexOf(fn);
        if (i >= 0) statusListeners.splice(i, 1);
      };
    },

    getStatus() {
      return status;
    },

    setUser(id) {
      userId = id;
      if (!id) setStatus("offline");
    },

    /** Fetch this user's stored data object, or null if none exists yet. */
    async pull() {
      if (!client || !userId) return null;
      setStatus("loading");
      try {
        const { data, error } = await client
          .from(TABLE)
          .select("data")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        setStatus("synced");
        return data ? data.data : null;
      } catch (e) {
        console.error("Cloud pull failed:", e);
        setStatus("error", e.message);
        return null;
      }
    },

    /** Debounced save used as the store's remote persister. */
    pushDebounced(data) {
      if (!client || !userId) return;
      pending = data;
      setStatus("saving");
      clearTimeout(timer);
      timer = setTimeout(() => cloud.flush(), DEBOUNCE_MS);
    },

    /** Immediately write the latest pending (or supplied) data to the cloud. */
    async flush(dataArg) {
      if (!client || !userId) return;
      const data = dataArg || pending;
      if (!data) return;
      pending = null;
      clearTimeout(timer);
      setStatus("saving");
      try {
        const { error } = await client.from(TABLE).upsert(
          {
            user_id: userId,
            data: data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        if (error) throw error;
        setStatus("synced");
        return true;
      } catch (e) {
        console.error("Cloud push failed:", e);
        setStatus("error", e.message);
        return false;
      }
    },

    /** Push immediately (used when seeding the cloud from local data). */
    async pushNow(data) {
      return cloud.flush(data);
    },

    /* ---- admin (read-only) ---------------------------------------------*/

    /** Ask the backend whether the signed-in user is an allowlisted admin. */
    async amIAdmin() {
      if (!client || !userId) return false;
      try {
        const { data, error } = await client.rpc("am_i_admin");
        if (error) throw error;
        return !!data;
      } catch (e) {
        // Missing function (admin SQL not applied) or no access → not an admin.
        console.warn("Admin check unavailable:", e.message || e);
        return false;
      }
    },

    /** List all members (admin only; RLS returns just yourself otherwise). */
    async listUsers() {
      if (!client) return [];
      const { data, error } = await client
        .from("profiles")
        .select("id,email,created_at")
        .order("email", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    /** Fetch another user's stored data object (admins only, via RLS). */
    async pullUserData(id) {
      if (!client || !id) return null;
      const { data, error } = await client
        .from(TABLE)
        .select("data,updated_at")
        .eq("user_id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? { data: data.data, updatedAt: data.updated_at } : null;
    },
  };

  App.cloud = cloud;
})();
