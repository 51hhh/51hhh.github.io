(() => {
  if (window.location.pathname !== "/music/") return;

  const musicPage = document.getElementById("anMusic-page");
  const musicBackground = document.getElementById("an_music_bg");
  if (!musicPage || !musicBackground) return;

  const setupPlayer = () => {
    const player = musicPage.querySelector(".aplayer");
    const cover = musicPage.querySelector(".aplayer-pic");
    if (!player || !cover) return false;

    const updateBackground = () => {
      if (cover.style.backgroundImage) {
        musicBackground.style.backgroundImage = cover.style.backgroundImage;
      }
    };

    updateBackground();
    new MutationObserver(updateBackground).observe(cover, {
      attributes: true,
      attributeFilter: ["style"]
    });

    if (!window.matchMedia("(max-width: 768px)").matches) return true;

    const originalMenuButton = musicPage.querySelector(".aplayer-icon-menu");
    const musicList = musicPage.querySelector(".aplayer-list");
    const menuMask = document.getElementById("menu-mask");
    if (!originalMenuButton || !musicList) return true;

    // APlayer 1.10.1 chooses its event type from the user agent. Replace only
    // this button so the viewport-based mobile layout behaves consistently.
    const menuButton = originalMenuButton.cloneNode(true);
    originalMenuButton.replaceWith(menuButton);

    const setListOpen = open => {
      musicList.classList.toggle("aplayer-list-hide", !open);
      if (!menuMask) return;
      menuMask.style.display = open ? "block" : "none";
      menuMask.style.animation = open
        ? "0.5s ease 0s 1 normal none running to_show"
        : "";
    };

    setListOpen(false);
    menuButton.addEventListener("click", () => {
      setListOpen(musicList.classList.contains("aplayer-list-hide"));
    });
    menuMask?.addEventListener("click", () => setListOpen(false), true);
    return true;
  };

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (setupPlayer() || attempts >= 150) {
      window.clearInterval(timer);
    }
  }, 100);
})();
