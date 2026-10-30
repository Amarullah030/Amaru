/* =========================================================
   ANIMASI HISADA (anime.js v3)
   ---------------------------------------------------------
   Semua animasi ada di sini. script.js cukup memanggil
   runAnimation("namaAnimasi", ...).

   Kalau anime.js gagal dimuat, atau perangkat meminta
   gerakan dikurangi (prefers-reduced-motion), semua fungsi
   di bawah tidak melakukan apa-apa dan aplikasi tetap jalan.
   ========================================================= */

"use strict";

(function () {
  const enabled =
    typeof anime !== "undefined" &&
    !window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

  /* Hitungan angka statistik yang sedang berjalan, per id */
  const counters = {};

  /* Hapus style sisa animasi supaya efek hover di CSS
     tetap bekerja */
  function clearStyles(targets, props) {
    const list =
      targets instanceof Element
        ? [targets]
        : Array.from(targets);

    list.forEach(el => {
      props.forEach(prop => {
        el.style[prop] = "";
      });
    });
  }

  /* Muncul dari bawah + memudar masuk */
  function fadeUp(targets, options = {}) {
    if (!targets || targets.length === 0) {
      return;
    }

    anime.remove(targets);

    anime({
      targets,
      opacity: [0, 1],
      translateY: [options.distance ?? 14, 0],
      duration: options.duration ?? 420,
      delay: options.delay ?? 0,
      easing: "easeOutCubic",
      complete: () =>
        clearStyles(targets, ["opacity", "transform"])
    });
  }

  const Animasi = {
    /* Halaman (Dashboard, Inventaris, dll.) saat dibuka */
    section(section) {
      if (!section) return;

      fadeUp(
        section.querySelectorAll(
          ".welcome-card, .stat-card, .section-card, .chart-card"
        ),
        {
          delay: anime.stagger(55)
        }
      );
    },

    /* Kartu login / sign up / buat admin */
    authCard(page) {
      const card =
        page?.querySelector(".auth-card");

      if (!card) return;

      fadeUp(card, {
        distance: 24,
        duration: 520
      });

      const logo =
        card.querySelector(".auth-logo");

      if (logo) {
        anime.remove(logo);

        anime({
          targets: logo,
          scale: [0.6, 1],
          rotate: [-8, 0],
          opacity: [0, 1],
          duration: 700,
          delay: 120,
          easing: "easeOutElastic(1, .6)",
          complete: () =>
            clearStyles(logo, ["opacity", "transform"])
        });
      }
    },

    /* Kartu bergoyang saat login / form gagal */
    shake(element) {
      if (!element) return;

      /* Kalau animasi muncul belum selesai, langsung tampilkan */
      anime.remove(element);
      clearStyles(element, ["opacity", "transform"]);

      anime({
        targets: element,
        translateX: [0, -10, 10, -7, 7, -3, 3, 0],
        duration: 480,
        easing: "easeInOutSine",
        complete: () =>
          clearStyles(element, ["transform"])
      });
    },

    /* Jendela modal (tambah barang / peminjaman) */
    modal(modal) {
      const card =
        modal?.querySelector(".modal-card");

      if (!card) return;

      anime.remove([modal, card]);

      anime({
        targets: modal,
        opacity: [0, 1],
        duration: 200,
        easing: "linear",
        complete: () =>
          clearStyles(modal, ["opacity"])
      });

      anime({
        targets: card,
        opacity: [0, 1],
        translateY: [24, 0],
        scale: [0.96, 1],
        duration: 450,
        easing: "easeOutBack",
        complete: () =>
          clearStyles(card, ["opacity", "transform"])
      });
    },

    /* Angka statistik berhitung dari nilai lama ke nilai baru */
    countUp(id, value) {
      const el =
        document.getElementById(id);

      if (!el) return;

      const from =
        Number(el.dataset.value || 0);

      const to =
        Number(value) || 0;

      el.dataset.value = to;

      /* Hentikan hitungan sebelumnya yang masih berjalan */
      if (counters[id]) {
        anime.remove(counters[id]);
      }

      if (from === to) {
        el.textContent = to;
        return;
      }

      const counter = {
        value: from
      };

      counters[id] = counter;

      anime({
        targets: counter,
        value: to,
        round: 1,
        duration: 700,
        easing: "easeOutExpo",
        update: () => {
          el.textContent = counter.value;
        }
      });
    },

    /* Baris tabel muncul bergantian (maks. 20 baris pertama) */
    rows(tbody) {
      if (!tbody) return;

      const rows =
        Array.from(
          tbody.querySelectorAll("tr")
        ).slice(0, 20);

      fadeUp(rows, {
        distance: 8,
        duration: 320,
        delay: anime.stagger(25)
      });
    },

    /* Efek "ditekan" pada tombol */
    press(button) {
      if (!button) return;

      anime.remove(button);

      /* Matikan transisi CSS sebentar supaya tidak bentrok */
      button.style.transition = "none";

      anime({
        targets: button,
        scale: [0.93, 1],
        duration: 380,
        easing: "easeOutBack",
        complete: () =>
          clearStyles(button, ["transform", "transition"])
      });
    }
  };

  if (!enabled) {
    return;
  }

  window.Animasi = Animasi;

  /* Modal di CSS punya animasi sendiri; dimatikan
     karena sudah diganti anime.js */
  document.documentElement.classList.add("anime-ready");

  /* Semua tombol mendapat efek ditekan */
  document.addEventListener(
    "pointerdown",
    event => {
      const button =
        event.target.closest(
          "button, .btn, .nav-link, .menu-link"
        );

      if (button && !button.disabled) {
        Animasi.press(button);
      }
    }
  );
})();
