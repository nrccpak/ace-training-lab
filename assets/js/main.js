/* =========================================================================
   ACE TRAINING LAB — MAIN JAVASCRIPT
   =========================================================================
   Handles:
   1. Mobile navigation menu toggle
   2. Enroll Now sidebar widget collapse/expand
   3. FAQ accordion (faqs.html only — harmless elsewhere, just finds nothing)
   4. Formspree form submission (AJAX, shows success/error message in place
      instead of redirecting away from the page)
   ========================================================================= */

document.addEventListener("DOMContentLoaded", function () {

  /* ---------------------------------------------------------------------
     1. MOBILE NAVIGATION TOGGLE
     --------------------------------------------------------------------- */
  var navToggle = document.querySelector(".nav-toggle");
  var mainNav = document.querySelector(".main-nav");
  var navOverlay = document.querySelector(".nav-overlay");

  function closeNav() {
    mainNav.classList.remove("open");
    navOverlay.classList.remove("open");
  }

  if (navToggle && mainNav && navOverlay) {
    navToggle.addEventListener("click", function () {
      mainNav.classList.toggle("open");
      navOverlay.classList.toggle("open");
    });
    navOverlay.addEventListener("click", closeNav);
    // close menu when a nav link is tapped (mobile)
    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
  }

  /* ---------------------------------------------------------------------
     2. ENROLL NOW SIDEBAR WIDGET — collapse/expand on click
     --------------------------------------------------------------------- */
  var enrollWidget = document.querySelector(".enroll-widget");
  var enrollHeader = document.querySelector(".enroll-widget-header");

  if (enrollWidget && enrollHeader) {
    enrollHeader.addEventListener("click", function () {
      enrollWidget.classList.toggle("collapsed");
    });
  }

  // Any button/link with class "open-enroll-widget" expands the floating
  // Enroll Now widget and scrolls it into view (used by in-page "Enroll Now"
  // buttons on course pages).
  document.querySelectorAll(".open-enroll-widget").forEach(function (btn) {
    btn.addEventListener("click", function (event) {
      if (enrollWidget) {
        event.preventDefault();
        enrollWidget.classList.remove("collapsed");
        enrollWidget.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    });
  });

  /* ---------------------------------------------------------------------
     3. FAQ ACCORDION
     --------------------------------------------------------------------- */
  var faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(function (item) {
    var question = item.querySelector(".faq-question");
    if (!question) return;
    question.addEventListener("click", function () {
      var wasOpen = item.classList.contains("open");
      // close all other open items (accordion behaviour)
      faqItems.forEach(function (other) {
        other.classList.remove("open");
      });
      if (!wasOpen) {
        item.classList.add("open");
      }
    });
  });

  /* ---------------------------------------------------------------------
     4. FORMSPREE FORM SUBMISSION (AJAX)
     --------------------------------------------------------------------- */
  var formspreeForms = document.querySelectorAll("form[data-formspree]");

  formspreeForms.forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var successBox = form.querySelector(".form-success");
      var errorBox = form.querySelector(".form-error");
      var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');

      if (successBox) successBox.style.display = "none";
      if (errorBox) errorBox.style.display = "none";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.dataset.originalText || submitBtn.textContent;
        submitBtn.textContent = "Sending...";
      }

      var data = new FormData(form);

      fetch(form.action, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          if (response.ok) {
            form.reset();
            if (successBox) successBox.style.display = "block";
          } else {
            response.json().then(function (json) {
              console.error("Formspree error:", json);
              if (errorBox) errorBox.style.display = "block";
            });
          }
        })
        .catch(function (err) {
          console.error("Network error submitting form:", err);
          if (errorBox) errorBox.style.display = "block";
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText;
          }
        });
    });
  });

});
