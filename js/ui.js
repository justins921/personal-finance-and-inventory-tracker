/* ============================================================================
 * ui.js — shared rendering helpers: stat cards, tables, modal forms, toasts.
 * Attaches to window.App.ui
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const util = App.util;
  const esc = util.esc;

  /* ---- small presentational builders ------------------------------------*/

  function statCard({ label, value, sub, tone, big }) {
    return `
      <div class="stat ${big ? "stat--big" : ""} ${tone ? "stat--" + tone : ""}">
        <div class="stat__label">${esc(label)}</div>
        <div class="stat__value">${value}</div>
        ${sub ? `<div class="stat__sub">${sub}</div>` : ""}
      </div>`;
  }

  function sectionTitle(title, actionHtml) {
    return `<div class="section-head">
        <h2>${esc(title)}</h2>
        ${actionHtml || ""}
      </div>`;
  }

  function pill(text, tone) {
    return `<span class="pill ${tone ? "pill--" + tone : ""}">${esc(text)}</span>`;
  }

  function emptyState(text, actionHtml) {
    return `<div class="empty">
        <p>${esc(text)}</p>
        ${actionHtml || ""}
      </div>`;
  }

  /* ---- toast ------------------------------------------------------------*/

  let toastTimer = null;
  function toast(msg, tone) {
    let t = util.$("#toast");
    if (!t) {
      t = util.el(`<div id="toast" class="toast" role="status"></div>`);
      document.body.appendChild(t);
    }
    t.className = "toast show " + (tone ? "toast--" + tone : "");
    t.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.className = "toast";
    }, 2600);
  }

  /* ---- modal form -------------------------------------------------------*
   * openForm({ title, fields, values, submitLabel, onSubmit })
   *
   * fields: array of {
   *   name, label, type ("text"|"number"|"money"|"percent"|"date"|"select"|"textarea"),
   *   options? (for select), required?, hint?, step?, placeholder?
   * }
   * onSubmit receives a plain object of parsed values.
   * ----------------------------------------------------------------------*/

  function fieldHtml(f, values) {
    const v = values && values[f.name] != null ? values[f.name] : f.default != null ? f.default : "";
    const id = "f_" + f.name;
    const req = f.required ? "required" : "";
    if (f.type === "heading") {
      return `<div class="field field--wide form-heading">
          <span>${esc(f.label)}</span>
          ${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ""}
        </div>`;
    }
    let input;
    const isNumeric = f.type === "number" || f.type === "money" || f.type === "percent";
    if (f.type === "select") {
      input = `<select id="${id}" name="${f.name}" ${req}>
        ${(f.options || [])
          .map(
            (o) =>
              `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? "selected" : ""}>${esc(o.label)}</option>`
          )
          .join("")}
      </select>`;
    } else if (f.type === "textarea") {
      input = `<textarea id="${id}" name="${f.name}" rows="3" placeholder="${esc(f.placeholder || "")}" ${req}>${esc(v)}</textarea>`;
    } else if (f.type === "date") {
      input = `<input id="${id}" name="${f.name}" type="date" value="${esc(v)}" ${req}>`;
    } else if (isNumeric) {
      const step = f.step != null ? f.step : f.type === "percent" ? "0.01" : "any";
      const prefix = f.type === "money" ? `<span class="affix">$</span>` : "";
      const suffix = f.type === "percent" ? `<span class="affix affix--right">%</span>` : "";
      input = `<div class="input-affix ${f.type === "money" ? "has-prefix" : ""} ${f.type === "percent" ? "has-suffix" : ""}">
          ${prefix}
          <input id="${id}" name="${f.name}" type="number" inputmode="decimal" step="${step}" value="${esc(v)}" placeholder="${esc(f.placeholder || "")}" ${req}>
          ${suffix}
        </div>`;
    } else {
      input = `<input id="${id}" name="${f.name}" type="text" value="${esc(v)}" placeholder="${esc(f.placeholder || "")}" ${req}>`;
    }
    return `<div class="field ${f.wide ? "field--wide" : ""}">
        <label for="${id}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ""}</label>
        ${input}
        ${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ""}
      </div>`;
  }

  function openForm(cfg) {
    if (App.store && App.store.isViewingAs) {
      toast("Read-only — you're viewing another member's account.", "warn");
      return;
    }
    closeModal();
    const fields = cfg.fields || [];
    const overlay = util.el(`
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal">
          <div class="modal__head">
            <h3>${esc(cfg.title || "")}</h3>
            <button class="icon-btn" data-close aria-label="Close">✕</button>
          </div>
          <form class="modal__body grid-form">
            ${fields.map((f) => fieldHtml(f, cfg.values)).join("")}
          </form>
          <div class="modal__foot">
            ${cfg.onDelete ? `<button type="button" class="btn btn--danger-ghost" data-delete>Delete</button>` : "<span></span>"}
            <div class="modal__foot-right">
              <button type="button" class="btn btn--ghost" data-close>Cancel</button>
              <button type="button" class="btn btn--primary" data-submit>${esc(cfg.submitLabel || "Save")}</button>
            </div>
          </div>
        </div>
      </div>`);

    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");

    const form = util.$("form", overlay);

    function collect() {
      const out = {};
      fields.forEach((f) => {
        const node = form.elements[f.name];
        if (!node) return;
        let val = node.value;
        if (f.type === "number" || f.type === "money" || f.type === "percent") {
          val = val === "" ? "" : util.num(val);
        }
        out[f.name] = val;
      });
      return out;
    }

    function submit() {
      // basic required validation
      for (const f of fields) {
        if (f.required) {
          const node = form.elements[f.name];
          if (!node || String(node.value).trim() === "") {
            node && node.focus();
            toast(`"${f.label}" is required.`, "warn");
            return;
          }
        }
      }
      const values = collect();
      closeModal();
      cfg.onSubmit && cfg.onSubmit(values);
    }

    overlay.addEventListener("click", async (e) => {
      if (e.target === overlay) closeModal();
      if (e.target.closest("[data-close]")) closeModal();
      if (e.target.closest("[data-submit]")) submit();
      if (e.target.closest("[data-delete]")) {
        const yes = await confirmDialog({
          title: "Delete this item?",
          message: "This can't be undone.",
          confirmLabel: "Delete",
          danger: true,
        });
        if (yes) {
          closeModal();
          cfg.onDelete();
        }
      }
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submit();
    });
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        submit();
      }
    });

    // focus first field
    const first = util.$("input,select,textarea", form);
    if (first) setTimeout(() => first.focus(), 30);
  }

  /** Close the topmost modal/dialog; clear the body lock only when none remain. */
  function closeModal() {
    const all = util.$$(".modal-overlay");
    if (!all.length) return;
    all[all.length - 1].remove();
    if (!util.$(".modal-overlay")) document.body.classList.remove("modal-open");
  }

  // Esc closes the topmost modal.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  /* ---- styled confirm / alert dialogs -----------------------------------*
   * Drop-in, on-brand replacements for window.confirm / window.alert.
   * confirmDialog(opts) -> Promise<boolean>; alertDialog(opts) -> Promise<void>.
   * They stack over an open form (e.g. delete confirmation) and clean up
   * their own keyboard handlers.
   * ----------------------------------------------------------------------*/

  function buildDialog(opts, withCancel) {
    const danger = !!opts.danger;
    const overlay = util.el(`
      <div class="modal-overlay" role="alertdialog" aria-modal="true">
        <div class="modal modal--dialog ${danger ? "modal--danger" : ""}">
          <div class="modal__body dialog-body">
            <div class="dialog-icon ${danger ? "dialog-icon--danger" : "dialog-icon--info"}">${danger ? "⚠" : "ℹ"}</div>
            <div class="dialog-text">
              <h3>${esc(opts.title || (withCancel ? "Are you sure?" : "Notice"))}</h3>
              ${opts.message ? `<p>${esc(opts.message)}</p>` : ""}
            </div>
          </div>
          <div class="modal__foot">
            <span></span>
            <div class="modal__foot-right">
              ${withCancel ? `<button type="button" class="btn btn--ghost" data-cancel>${esc(opts.cancelLabel || "Cancel")}</button>` : ""}
              <button type="button" class="btn ${danger ? "btn--danger" : "btn--primary"}" data-ok>${esc(opts.confirmLabel || "OK")}</button>
            </div>
          </div>
        </div>
      </div>`);
    return overlay;
  }

  function showDialog(opts, withCancel) {
    return new Promise((resolve) => {
      const overlay = buildDialog(opts, withCancel);
      document.body.appendChild(overlay);
      document.body.classList.add("modal-open");

      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        document.removeEventListener("keydown", onKey, true);
        if (overlay.parentNode) overlay.remove();
        if (!util.$(".modal-overlay")) document.body.classList.remove("modal-open");
        resolve(val);
      };

      const onKey = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation(); // don't let the global handler also fire
          finish(withCancel ? false : undefined);
        } else if (e.key === "Enter") {
          e.preventDefault();
          finish(withCancel ? true : undefined);
        }
      };
      document.addEventListener("keydown", onKey, true);

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.closest("[data-cancel]")) finish(withCancel ? false : undefined);
        else if (e.target.closest("[data-ok]")) finish(withCancel ? true : undefined);
      });

      setTimeout(() => {
        const b = overlay.querySelector("[data-ok]");
        if (b) b.focus();
      }, 30);
    });
  }

  function confirmDialog(opts) {
    return showDialog(opts || {}, true);
  }
  function alertDialog(opts) {
    if (typeof opts === "string") opts = { message: opts };
    return showDialog(opts || {}, false);
  }

  App.ui = {
    statCard,
    sectionTitle,
    pill,
    emptyState,
    toast,
    openForm,
    closeModal,
    confirm: confirmDialog,
    alert: alertDialog,
  };
})();
