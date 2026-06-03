/* CARBONCHIP — site interactions
   Vanilla JS, no build step. Progressive enhancement only. */
(function () {
  "use strict";

  /* ── Mobile nav toggle ─────────────────────────────── */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") links.classList.remove("open");
    });
  }

  /* ── Mark active nav link by pathname ──────────────── */
  var path = location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
  document.querySelectorAll(".nav-links a[data-path]").forEach(function (a) {
    var p = a.getAttribute("data-path");
    if (p === path || (p !== "/" && path.indexOf(p) === 0)) a.classList.add("active");
    if (p === "/" && (path === "/" || path === "")) a.classList.add("active");
  });

  /* ── Reveal-on-scroll ──────────────────────────────── */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ── Generic tab groups ([data-tabs]) ──────────────── */
  document.querySelectorAll("[data-tabs]").forEach(function (group) {
    var btns = group.querySelectorAll(".tab-btn");
    var panels = group.querySelectorAll(".tab-panel");
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-tab");
        btns.forEach(function (b) { b.setAttribute("aria-selected", b === btn ? "true" : "false"); });
        panels.forEach(function (p) { p.classList.toggle("active", p.getAttribute("data-panel") === id); });
      });
    });
  });

  /* ── MaterialScienceToggle ─────────────────────────── */
  document.querySelectorAll("[data-mst]").forEach(function (mst) {
    var tabs = mst.querySelectorAll(".mst-tab");
    var panels = mst.querySelectorAll(".mst-panel");
    var layers = mst.querySelectorAll(".pot-layer");
    function select(id) {
      tabs.forEach(function (t) { t.setAttribute("aria-selected", t.getAttribute("data-layer") === id ? "true" : "false"); });
      panels.forEach(function (p) { p.classList.toggle("active", p.getAttribute("data-layer") === id); });
      layers.forEach(function (l) {
        var match = l.getAttribute("data-layer") === id;
        l.classList.toggle("active", match);
        l.classList.toggle("dim", !match);
      });
    }
    tabs.forEach(function (t) { t.addEventListener("click", function () { select(t.getAttribute("data-layer")); }); });
    layers.forEach(function (l) { l.addEventListener("click", function () { select(l.getAttribute("data-layer")); }); });
    if (tabs[0]) select(tabs[0].getAttribute("data-layer"));
  });

  /* ── Choice cards (checkbox styling) ───────────────── */
  document.querySelectorAll(".choice").forEach(function (choice) {
    var input = choice.querySelector("input");
    if (!input) return;
    function sync() { choice.classList.toggle("checked", input.checked); }
    input.addEventListener("change", sync);
    sync();
  });

  /* ── Lead / quote forms (client-side demo handling) ── */
  document.querySelectorAll("form[data-lead]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var success = form.parentElement.querySelector(".form-success");
      if (success) {
        form.style.display = "none";
        success.classList.add("show");
        success.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // Routing logic placeholder (Carbon Pots → engineering; timber → logistics)
      try {
        var data = Object.fromEntries(new FormData(form).entries());
        console.log("[carbonchip] lead captured (demo):", data);
      } catch (_) {}
    });
  });

  /* ── "Request Bulk Quote" deep-links to contact ────── */
  document.querySelectorAll("[data-quote]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var product = btn.getAttribute("data-quote");
      var url = "/timber-products#trade-account";
      try { sessionStorage.setItem("carbonchip_quote_item", product); } catch (_) {}
      var sel = document.querySelector("#quote-product");
      if (sel) {
        sel.value = product;
        document.querySelector("#trade-account").scrollIntoView({ behavior: "smooth" });
      } else {
        location.href = url;
      }
    });
  });

  /* Prefill product on contact pages */
  try {
    var stored = sessionStorage.getItem("carbonchip_quote_item");
    var sel2 = document.querySelector("#quote-product");
    if (stored && sel2) { sel2.value = stored; sessionStorage.removeItem("carbonchip_quote_item"); }
  } catch (_) {}

  /* ── Footer year ───────────────────────────────────── */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
