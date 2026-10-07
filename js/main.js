(function () {
  "use strict";

  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("site-nav");

  if (toggle && nav) {
    var closeNav = function () {
      toggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
    };

    toggle.addEventListener("click", function () {
      var isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      nav.classList.toggle("is-open", !isOpen);
    });

    Array.prototype.forEach.call(nav.querySelectorAll("a"), function (link) {
      link.addEventListener("click", closeNav);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });

    document.addEventListener("click", function (e) {
      var open = toggle.getAttribute("aria-expanded") === "true";
      if (open && !nav.contains(e.target) && !toggle.contains(e.target)) closeNav();
    });
  }

  // Progressive-enhancement reveal for below-the-fold project imagery only.
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion && "IntersectionObserver" in window) {
    var targets = document.querySelectorAll(".reveal");
    Array.prototype.forEach.call(targets, function (el) {
      el.classList.add("reveal-init");
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.remove("reveal-init");
            entry.target.classList.add("reveal-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    Array.prototype.forEach.call(targets, function (el) {
      io.observe(el);
    });
  }

  // Animations (AMS-02, valve): a muted preview loop plays in each card while it is on screen...
  var videos = document.querySelectorAll("video[data-autoplay]");
  if (!reduceMotion && "IntersectionObserver" in window) {
    var vio = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var v = entry.target;
          if (entry.isIntersecting) {
            var p = v.play();
            if (p && p.catch) p.catch(function () {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: 0.35 }
    );
    Array.prototype.forEach.call(videos, function (v) {
      vio.observe(v);
    });
  }

  // ...and the full interactive 3D opens in an overlay on this page, loaded only when asked for.
  var modal = document.getElementById("animModal");
  var frame = modal && modal.querySelector("iframe");
  if (modal && frame && typeof modal.showModal === "function") {
    var titles = {
      "ams02-transfer/": "AMS-02 Layer 0 integration · interactive 3D",
      "prv-section/": "Pressure-relief valve · interactive 3D"
    };
    var openAnim = function (page, step) {
      frame.src = page + "index.html?embed=1" + (step ? "&step=" + step + "&play=1" : "");
      modal.querySelector(".anim-modal__title").textContent = titles[page] || "Interactive 3D";
      modal.querySelector(".anim-modal__out").href = page;
      modal.showModal();
      document.documentElement.classList.add("modal-open");
      frame.focus();
    };
    modal.addEventListener("close", function () {
      frame.src = "about:blank"; // unloads the 3D scene
      document.documentElement.classList.remove("modal-open");
    });
    modal.querySelector(".anim-modal__close").addEventListener("click", function () {
      modal.close();
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) modal.close(); // a click on the dimmed backdrop
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-anim-open]"), function (link) {
      link.addEventListener("click", function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return; // let "open in new tab" through
        e.preventDefault();
        openAnim(link.getAttribute("href").split("?")[0], link.getAttribute("data-anim-open"));
      });
    });
    if (location.hash === "#ams-animation") openAnim("ams02-transfer/", "");
    if (location.hash === "#prv-animation") openAnim("prv-section/", "");
  }
})();
