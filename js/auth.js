/* ============================================================================
 * auth.js — Supabase email/password authentication + the login screen.
 * Attaches to window.App.auth and window.App.config
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const util = App.util;
  const esc = util.esc;

  /* ---- resolved config --------------------------------------------------*/
  const cfg = window.APP_CONFIG || {};
  App.config = {
    url: (cfg.SUPABASE_URL || "").trim(),
    anonKey: (cfg.SUPABASE_ANON_KEY || "").trim(),
    requireLogin: !!cfg.REQUIRE_LOGIN,
    isConfigured() {
      return !!(this.url && this.anonKey && typeof window.supabase !== "undefined");
    },
  };

  let client = null;
  let currentUser = null;
  const changeListeners = [];

  const auth = {
    init(supabaseClient) {
      client = supabaseClient;
    },

    onChange(fn) {
      changeListeners.push(fn);
    },

    _emit(user) {
      currentUser = user;
      changeListeners.forEach((fn) => {
        try {
          fn(user);
        } catch (e) {
          console.error(e);
        }
      });
    },

    user() {
      return currentUser;
    },

    /** Resolve the existing session (if the user is already logged in). */
    async getSession() {
      if (!client) return null;
      const { data } = await client.auth.getSession();
      currentUser = data && data.session ? data.session.user : null;
      return currentUser;
    },

    /** Wire Supabase's auth state changes to our listeners. */
    listen() {
      if (!client) return;
      client.auth.onAuthStateChange((event, session) => {
        const user = session ? session.user : null;
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
          auth._emit(user);
        }
      });
    },

    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) return { error: error.message };
      // If email confirmations are ON, there is no session until confirmed.
      const needsConfirm = !data.session;
      return { user: data.user, needsConfirm };
    },

    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { user: data.user };
    },

    async signOut() {
      if (!client) return;
      await client.auth.signOut();
      auth._emit(null);
    },

    /* ---- login screen ---------------------------------------------------*/

    /**
     * Render a full-screen login gate. Calls onSkip when the user chooses to
     * continue locally (only offered when REQUIRE_LOGIN is false).
     */
    renderGate(onSkip) {
      auth.removeGate();
      const allowSkip = !App.config.requireLogin;
      const gate = util.el(`
        <div class="auth-gate" id="authGate">
          <div class="auth-card">
            <div class="auth-brand"><span class="auth-brand__mark">◆</span> Financial Command Center</div>
            <h1 id="authTitle">Welcome back</h1>
            <p class="auth-sub" id="authSub">Sign in to access your data on any device.</p>

            <div class="auth-msg" id="authMsg" hidden></div>

            <form id="authForm" class="auth-form" autocomplete="on">
              <label for="authEmail">Email</label>
              <input id="authEmail" type="email" autocomplete="email" required placeholder="you@example.com" />

              <label for="authPass">Password</label>
              <input id="authPass" type="password" autocomplete="current-password" required minlength="6" placeholder="••••••••" />

              <button type="submit" class="btn btn--primary auth-submit" id="authSubmit">Sign in</button>
            </form>

            <p class="auth-toggle">
              <span id="authToggleText">New here?</span>
              <a href="#" id="authToggle">Create an account</a>
            </p>

            ${allowSkip ? `<div class="auth-or"><span>or</span></div>
              <button class="btn btn--ghost auth-skip" id="authSkip">Use on this device only</button>
              <p class="auth-fineprint">Local mode stores data only in this browser. You can sign in later to sync.</p>` : ""}
          </div>
          <p class="auth-footer">Free &amp; private · your data is protected by per-user access rules.</p>
        </div>
      `);
      document.body.appendChild(gate);

      let mode = "signin"; // or "signup"
      const $ = (s) => gate.querySelector(s);
      const msg = $("#authMsg");
      const showMsg = (text, tone) => {
        msg.hidden = false;
        msg.textContent = text;
        msg.className = "auth-msg auth-msg--" + (tone || "info");
      };
      const clearMsg = () => {
        msg.hidden = true;
      };

      function applyMode() {
        if (mode === "signin") {
          $("#authTitle").textContent = "Welcome back";
          $("#authSub").textContent = "Sign in to access your data on any device.";
          $("#authSubmit").textContent = "Sign in";
          $("#authPass").autocomplete = "current-password";
          $("#authToggleText").textContent = "New here?";
          $("#authToggle").textContent = "Create an account";
        } else {
          $("#authTitle").textContent = "Create your account";
          $("#authSub").textContent = "It's free. Your data will sync across your devices.";
          $("#authSubmit").textContent = "Create account";
          $("#authPass").autocomplete = "new-password";
          $("#authToggleText").textContent = "Already have an account?";
          $("#authToggle").textContent = "Sign in";
        }
        clearMsg();
      }

      $("#authToggle").addEventListener("click", (e) => {
        e.preventDefault();
        mode = mode === "signin" ? "signup" : "signin";
        applyMode();
      });

      $("#authForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = $("#authEmail").value.trim();
        const password = $("#authPass").value;
        const btn = $("#authSubmit");
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = "Please wait…";
        clearMsg();
        try {
          if (mode === "signup") {
            const res = await auth.signUp(email, password);
            if (res.error) {
              showMsg(res.error, "error");
            } else if (res.needsConfirm) {
              showMsg("Account created! Check your email to confirm your address, then sign in.", "ok");
              mode = "signin";
              applyMode();
            }
            // if no confirm needed, onAuthStateChange will take over.
          } else {
            const res = await auth.signIn(email, password);
            if (res.error) showMsg(res.error, "error");
            // success handled by onAuthStateChange
          }
        } catch (err) {
          showMsg(err.message || "Something went wrong.", "error");
        } finally {
          btn.disabled = false;
          btn.textContent = original;
        }
      });

      const skip = $("#authSkip");
      if (skip) skip.addEventListener("click", () => onSkip && onSkip());

      setTimeout(() => $("#authEmail").focus(), 40);
    },

    removeGate() {
      const g = document.getElementById("authGate");
      if (g) g.remove();
    },
  };

  App.auth = auth;
})();
