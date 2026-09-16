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
