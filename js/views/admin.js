/* ============================================================================
 * views/admin.js — member directory for admins. Pick a member to view their
 * account read-only. Backend RLS is the real gate; this UI only appears for
 * allowlisted admins (see supabase-admin.sql).
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const V = (App.views = App.views || {});
  const util = App.util;
  const esc = util.esc;

  V.admin = {
    render(root) {
      if (!App.isAdmin) {
        root.innerHTML = `
          <div class="view-head"><h1>Admin</h1></div>
          <div class="card"><p class="muted">You don't have access to this page.</p></div>`;
        return;
      }

      root.innerHTML = `
        <div class="view-head">
          <div>
            <h1>Admin · Members</h1>
            <p class="muted">Open any member's account in read-only mode to review their dashboard, portfolio, and statement.</p>
          </div>
        </div>
        <div class="card">
          <input class="admin-search" id="adminSearch" type="search" placeholder="Search by email…" autocomplete="off" />
          <div id="adminList"><p class="muted">Loading members…</p></div>
        </div>`;

      const listEl = util.$("#adminList", root);
      const me = App.auth && App.auth.user && App.auth.user();

      App.cloud
        .listUsers()
        .then((users) => {
          if (!users.length) {
            listEl.innerHTML = `<p class="muted">No members found.</p>`;
            return;
          }
          const draw = (filter) => {
            const f = (filter || "").trim().toLowerCase();
            const rows = users.filter((u) => !f || (u.email || "").toLowerCase().includes(f));
            if (!rows.length) {
              listEl.innerHTML = `<p class="muted">No members match "${esc(filter)}".</p>`;
              return;
            }
            listEl.innerHTML = `
              <table class="mini-table admin-table">
                <thead><tr><th>Email</th><th>Joined</th><th></th></tr></thead>
                <tbody>
                ${rows
                  .map(
                    (u) => `<tr>
                      <td>${esc(u.email || "(no email)")}${me && u.id === me.id ? ` <span class="pill">you</span>` : ""}</td>
                      <td>${u.created_at ? util.niceDate(String(u.created_at).slice(0, 10)) : "—"}</td>
                      <td class="num"><button class="btn btn--ghost btn--sm" data-view-user="${esc(u.id)}" data-email="${esc(u.email || "")}">View account →</button></td>
                    </tr>`
                  )
                  .join("")}
                </tbody>
              </table>
              <p class="muted small">${rows.length} member${rows.length === 1 ? "" : "s"}. Viewing is read-only — you can't change anyone's data.</p>`;

            util.$$("[data-view-user]", listEl).forEach((btn) => {
              btn.addEventListener("click", () => {
                App.enterUserView({
                  id: btn.getAttribute("data-view-user"),
                  email: btn.getAttribute("data-email"),
                });
              });
            });
          };

          draw("");
          const search = util.$("#adminSearch", root);
          if (search) search.addEventListener("input", () => draw(search.value));
        })
        .catch((e) => {
          console.error(e);
          listEl.innerHTML = `<p class="muted">Couldn't load members. Make sure <code>supabase-admin.sql</code> has been run in your Supabase project.</p>`;
        });
    },
  };
})();
