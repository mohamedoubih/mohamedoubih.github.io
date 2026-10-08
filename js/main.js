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

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The header gets its bottom rule once the page has scrolled under it.
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 4);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // The nav marks the section you are reading.
  if (nav && "IntersectionObserver" in window) {
    var navLinks = {};
    Array.prototype.forEach.call(nav.querySelectorAll('a[href^="#"]'), function (a) {
      navLinks[a.getAttribute("href").slice(1)] = a;
    });
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var link = navLinks[entry.target.id];
          if (!link) return;
          if (entry.isIntersecting) {
            Object.keys(navLinks).forEach(function (id) {
              navLinks[id].removeAttribute("aria-current");
            });
            link.setAttribute("aria-current", "true");
          } else {
            link.removeAttribute("aria-current");
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    Object.keys(navLinks).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }

  // Printing shows the folded engineering detail too.
  var printOpened = [];
  window.addEventListener("beforeprint", function () {
    Array.prototype.forEach.call(document.querySelectorAll("details:not([open])"), function (d) {
      d.open = true;
      printOpened.push(d);
    });
  });
  window.addEventListener("afterprint", function () {
    printOpened.forEach(function (d) {
      d.open = false;
    });
    printOpened = [];
  });

  // Animations (AMS-02, valve, FD-11): a muted preview loop plays in each card while it is on screen...
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
      "prv-section/": "Pressure-relief valve · interactive 3D",
      "fd11-enclosure/": "FD-11 enclosure · interactive 3D"
    };
    var openAnim = function (page, step) {
      frame.src = page + "index.html?embed=1" + (step ? "&step=" + step + "&play=1" : "");
      modal.querySelector(".anim-modal__title").textContent = titles[page] || "Interactive 3D";
      frame.title = (titles[page] || "Interactive 3D").replace(" · ", ", ") + " animation";
      modal.querySelector(".anim-modal__out").href = page;
      modal.showModal();
      document.documentElement.classList.add("modal-open");
      frame.focus();
    };
    // Focus moves into the 3D page, so Escape is heard there too (same site, so this is allowed).
    frame.addEventListener("load", function () {
      try {
        frame.contentWindow.addEventListener("keydown", function (e) {
          if (e.key === "Escape") modal.close();
        });
      } catch (err) {}
    });
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
    if (location.hash === "#fd11-animation") openAnim("fd11-enclosure/", "");
  }
})();
