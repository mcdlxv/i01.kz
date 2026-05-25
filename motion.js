// Scroll reveals + nav active state + count-up
// Uses scroll/resize listeners rather than IntersectionObserver
// for reliability across all preview environments.

(function () {
  // Arm the reveal animations only after first paint —
  // ensures elements that are immediately in view animate in
  // and elements offscreen stay primed for scroll-trigger.
  requestAnimationFrame(() => {
    document.body.classList.add("js-reveals");
  });

  const reveals = Array.from(document.querySelectorAll(".reveal"));
  const nav = document.querySelector(".nav");
  const sections = Array.from(document.querySelectorAll("section[id]"));
  const links = Array.from(document.querySelectorAll(".nav__menu a"));
  const linksById = {};
  links.forEach((l) => {
    const id = l.getAttribute("href").replace("#", "");
    linksById[id] = l;
  });

  const stats = Array.from(document.querySelectorAll("[data-count]"));
  const statState = new WeakMap();

  function runStat(el) {
    if (statState.get(el)) return;
    statState.set(el, true);
    const target = parseInt(el.dataset.count, 10);
    const dur = 1400;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    }
    requestAnimationFrame(tick);
  }

  function update() {
    const h = window.innerHeight;
    // Nav scrolled
    if (window.scrollY > 40) nav.classList.add("scrolled");
    else nav.classList.remove("scrolled");

    // Reveals
    for (let i = 0; i < reveals.length; i++) {
      const el = reveals[i];
      if (el.classList.contains("in")) continue;
      const r = el.getBoundingClientRect();
      if (r.top < h - 60 && r.bottom > 0) {
        el.classList.add("in");
      }
    }

    // Active nav link based on which section midpoint is closest to viewport center
    let active = null;
    const center = window.scrollY + h * 0.45;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const top = s.offsetTop;
      const bot = top + s.offsetHeight;
      if (center >= top && center < bot) {
        active = s.id;
        break;
      }
    }
    if (active) {
      links.forEach((l) => l.classList.remove("active"));
      const link = linksById[active];
      if (link) link.classList.add("active");
    }

    // Stats
    for (let i = 0; i < stats.length; i++) {
      const r = stats[i].getBoundingClientRect();
      if (r.top < h - 40 && r.bottom > 0) runStat(stats[i]);
    }
  }

  let ticking = false;
  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  // Initial sweep + a short follow-up in case fonts/layout shift
  update();
  setTimeout(update, 50);
  setTimeout(update, 250);
  setTimeout(update, 800);

  // Smooth scroll for in-page links
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        window.scrollTo({ top: target.offsetTop - 20, behavior: "smooth" });
      }
    });
  });

  // Year
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // Magnetic CTA — element drifts slightly toward cursor on hover.
  // Driven via --mx / --my CSS vars so CSS keeps full control of transition + hover state.
  const magnets = document.querySelectorAll(".magnetic, .product-cta, .hero__scroll");
  magnets.forEach((el) => {
    const STR_X = 0.18;
    const STR_Y = 0.22;
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * STR_X;
      const y = (e.clientY - r.top - r.height / 2) * STR_Y;
      el.style.setProperty("--mx", x + "px");
      el.style.setProperty("--my", y + "px");
    });
    el.addEventListener("mouseleave", () => {
      el.style.setProperty("--mx", "0px");
      el.style.setProperty("--my", "0px");
    });
  });

  // YouTube tile click-to-play
  document.querySelectorAll(".tile[data-yt]").forEach((tile) => {
    tile.addEventListener("click", (e) => {
      // Let the "Watch on YouTube" link work as a normal link
      if (e.target.closest(".tile__yt")) return;
      if (tile.classList.contains("is-playing")) return;
      const id = tile.dataset.yt;
      tile.innerHTML =
        '<iframe class="tile__iframe"' +
        ' src="https://www.youtube-nocookie.com/embed/' + id +
            '?autoplay=1&rel=0&modestbranding=1&playsinline=1"' +
        ' title="i01.kz video"' +
        ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"' +
        ' allowfullscreen></iframe>';
      tile.classList.add("is-playing");
    });
  });
})();
