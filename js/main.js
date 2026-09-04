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
})();
