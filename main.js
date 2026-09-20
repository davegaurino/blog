document.addEventListener("DOMContentLoaded", () => {
  const slides = [...document.querySelectorAll(".slide")];
  const dots = [...document.querySelectorAll(".slider-dot")];
  const prevBtn = document.querySelector(".slider-prev");
  const nextBtn = document.querySelector(".slider-next");

  let current = Math.max(0, slides.findIndex(slide => slide.classList.contains("active")));
  let timer = null;

  function showSlide(index) {
    if (!slides.length) return;

    const newIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === newIndex);
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === newIndex);
      dot.setAttribute("aria-current", i === newIndex ? "true" : "false");
    });

    current = newIndex;
  }

  function startSlider() {
    if (slides.length < 2) return;
    clearInterval(timer);
    timer = setInterval(() => {
      showSlide(current + 1);
    }, 10000);
  }

  dots.forEach((dot, index) => {
    dot.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showSlide(index);
      startSlider();
    });
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showSlide(current - 1);
      startSlider();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showSlide(current + 1);
      startSlider();
    });
  }

  // Make the first slide, dots, and controls fully functional immediately.
  showSlide(current);
  startSlider();

  const menuBtn = document.querySelector(".menu-btn");
  const nav = document.querySelector(".nav");

  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => {
      nav.classList.toggle("open");
      const open = nav.classList.contains("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
});

/* Sidebar Bible verse slider */
document.addEventListener("DOMContentLoaded", () => {
  const verseSlides = [...document.querySelectorAll(".verse-slide")];
  const verseDots = [...document.querySelectorAll(".verse-slider-dot")];
  const versePrev = document.querySelector(".verse-slider-prev");
  const verseNext = document.querySelector(".verse-slider-next");
  const dailyHost = document.getElementById("dailyVersesWrapper");
  const christianityHost = document.getElementById("christianityVerseSource");

  if (!verseSlides.length) return;

  let verseCurrent = 0;
  let verseTimer = null;

  const refPattern = /\b((?:[1-3]\s*)?[A-Za-z]+(?:\s+[A-Za-z]+){0,3}\s+\d+:\d+(?:[-–]\d+)?)\b/;

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function htmlToText(value) {
    const tmp = document.createElement("div");
    tmp.innerHTML = String(value || "");
    return cleanText(tmp.textContent || tmp.innerText || "");
  }

  function setVerse(source, text, reference, version) {
    text = cleanText(text)
      .replace(/^["“]+|["”]+$/g, "")
      .trim();
    reference = cleanText(reference)
      .replace(/\s*\((?:NIV|NKJV)\)\s*$/i, "")
      .trim();

    if (!text || !reference) return false;

    const slide = verseSlides.find(item => item.dataset.verseSource === source);
    if (!slide) return false;

    const textEl = slide.querySelector(".verse-text");
    const refEl = slide.querySelector(".verse-reference");

    textEl.textContent = text;
    refEl.textContent = `${reference} ${version}`;
    textEl.removeAttribute("aria-hidden");
    refEl.removeAttribute("aria-hidden");
    slide.dataset.ready = "true";

    refreshVerseState();
    return true;
  }

  function extractReference(raw) {
    const match = cleanText(raw).match(refPattern);
    return match ? { reference: match[1], index: match.index, full: match[0] } : null;
  }

  function parseDailyVerses() {
    if (!dailyHost || !cleanText(dailyHost.textContent)) return false;

    const links = [...dailyHost.querySelectorAll("a")]
      .map(a => cleanText(a.textContent))
      .filter(Boolean);

    let reference = "";
    let verseText = "";

    for (const text of links) {
      const found = extractReference(text);
      if (found) {
        reference = found.reference;
        break;
      }
    }

    const verseCandidates = links
      .filter(text => !extractReference(text))
      .filter(text => text.length > 15)
      .sort((a, b) => b.length - a.length);

    if (verseCandidates.length) {
      verseText = verseCandidates[0];
    }

    if (!reference || !verseText) {
      const raw = cleanText(dailyHost.textContent);
      const found = extractReference(raw);
      if (found) {
        reference = reference || found.reference;
        const left = cleanText(raw.slice(0, found.index));
        const right = cleanText(raw.slice(found.index + found.full.length));
        verseText = verseText || (left.length >= right.length ? left : right);
      }
    }

    return setVerse("dailyverses", verseText, reference, "NIV");
  }

  function parseBibleGateway() {
    const payload = window.__daveBibleGatewayVerse;
    if (!payload) return false;

    const verseText = htmlToText(
      payload.text ||
      payload.content ||
      payload.verse ||
      payload.passage ||
      ""
    );

    const reference = cleanText(
      payload.reference ||
      payload.display_ref ||
      payload.displayRef ||
      payload.ref ||
      ""
    );

    return setVerse("biblegateway", verseText, reference, "NKJV");
  }

  function parseChristianity() {
    if (!christianityHost || !cleanText(christianityHost.textContent)) return false;

    let raw = cleanText(christianityHost.textContent)
      .replace(/Daily Bible Verse/gi, "")
      .replace(/Provided by Christianity\.com Bible Search/gi, "")
      .replace(/Christianity\.com Bible Search/gi, "")
      .trim();

    const found = extractReference(raw);
    if (!found) return false;

    const reference = found.reference;
    const left = cleanText(raw.slice(0, found.index));
    const right = cleanText(raw.slice(found.index + found.full.length))
      .replace(/^\s*\((?:NIV|NKJV)\)\s*/i, "")
      .replace(/\s*\((?:NIV|NKJV)\)\s*$/i, "")
      .trim();

    const verseText = left.length >= right.length ? left : right;
    return setVerse("christianity", verseText, reference, "NIV");
  }

  function readyIndexes() {
    return verseSlides
      .map((slide, index) => slide.dataset.ready === "true" ? index : -1)
      .filter(index => index >= 0);
  }

  function showVerse(index) {
    const ready = readyIndexes();
    if (!ready.length) {
      verseSlides.forEach(slide => slide.classList.remove("active"));
      verseDots.forEach(dot => dot.classList.remove("active"));
      if (versePrev) versePrev.disabled = true;
      if (verseNext) verseNext.disabled = true;
      return;
    }

    let target = index;
    if (!ready.includes(target)) target = ready[0];

    verseSlides.forEach((slide, i) => {
      slide.classList.toggle("active", i === target);
    });

    verseDots.forEach((dot, i) => {
      const isReady = ready.includes(i);
      dot.disabled = !isReady;
      dot.classList.toggle("active", i === target);
      dot.setAttribute("aria-current", i === target ? "true" : "false");
    });

    verseCurrent = target;
    const disableArrows = ready.length < 2;
    if (versePrev) versePrev.disabled = disableArrows;
    if (verseNext) verseNext.disabled = disableArrows;
  }

  function moveVerse(direction) {
    const ready = readyIndexes();
    if (ready.length < 2) return;
    const pos = Math.max(0, ready.indexOf(verseCurrent));
    const nextPos = (pos + direction + ready.length) % ready.length;
    showVerse(ready[nextPos]);
  }

  function startVerseSlider() {
    clearInterval(verseTimer);
    if (readyIndexes().length < 2) return;
    verseTimer = setInterval(() => moveVerse(1), 10000);
  }

  function refreshVerseState() {
    const ready = readyIndexes();
    if (ready.length && !ready.includes(verseCurrent)) {
      verseCurrent = ready[0];
    }
    showVerse(verseCurrent);
    startVerseSlider();
  }

  window.DaveRefreshVerseWidget = function () {
    parseDailyVerses();
    parseBibleGateway();
    parseChristianity();
    refreshVerseState();
  };

  verseDots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      if (dot.disabled) return;
      showVerse(index);
      startVerseSlider();
    });
  });

  if (versePrev) {
    versePrev.addEventListener("click", () => {
      moveVerse(-1);
      startVerseSlider();
    });
  }

  if (verseNext) {
    verseNext.addEventListener("click", () => {
      moveVerse(1);
      startVerseSlider();
    });
  }

  const watchSource = host => {
    if (!host) return;
    const observer = new MutationObserver(() => {
      window.DaveRefreshVerseWidget();
    });
    observer.observe(host, { childList:true, subtree:true, characterData:true });
  };

  watchSource(dailyHost);
  watchSource(christianityHost);

  // Initial read plus brief retries for third-party scripts that finish after DOM ready.
  window.DaveRefreshVerseWidget();
  [500, 1200, 2500, 5000].forEach(delay => {
    setTimeout(() => window.DaveRefreshVerseWidget(), delay);
  });
});

/* Homepage wallpaper slider */
document.addEventListener("DOMContentLoaded", () => {
  const section = document.querySelector(".home-wallpaper-section");
  if (!section) return;

  const slides = [...section.querySelectorAll(".home-wallpaper-slide")];
  const dots = [...section.querySelectorAll(".home-wallpaper-dot")];
  const prev = section.querySelector(".home-wallpaper-prev");
  const next = section.querySelector(".home-wallpaper-next");

  if (!slides.length) return;

  let current = Math.max(0, slides.findIndex(slide => slide.classList.contains("active")));
  let timer = null;

  function showWallpaper(index) {
    const nextIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, i) => {
      const active = i === nextIndex;
      slide.classList.toggle("active", active);
      slide.setAttribute("aria-hidden", active ? "false" : "true");
    });

    dots.forEach((dot, i) => {
      const active = i === nextIndex;
      dot.classList.toggle("active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });

    current = nextIndex;
  }

  function startWallpaperSlider() {
    if (slides.length < 2) return;
    clearInterval(timer);
    timer = setInterval(() => {
      showWallpaper(current + 1);
    }, 10000);
  }

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showWallpaper(index);
      startWallpaperSlider();
    });
  });

  prev?.addEventListener("click", () => {
    showWallpaper(current - 1);
    startWallpaperSlider();
  });

  next?.addEventListener("click", () => {
    showWallpaper(current + 1);
    startWallpaperSlider();
  });

  section.addEventListener("mouseenter", () => clearInterval(timer));
  section.addEventListener("mouseleave", startWallpaperSlider);

  showWallpaper(current);
  startWallpaperSlider();
});
/* End homepage wallpaper slider */

