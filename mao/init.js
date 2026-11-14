/* Boot the catch-the-cat game. Kept out of the page markdown so Butterfly's
   auto description/excerpt only picks up the page text. */
window.game = new CatchTheCatGame({
  w: 15,
  h: 15,
  r: 20,
  initialWallCount: 8,
  backgroundColor: 0xffffff,
  parent: 'catch-the-cat',
  statusBarAlign: 'center',
  credit: 'https://polar-bear.eu.org/'
});

/* Phaser 3.16 caches the canvas position at boot and only recomputes it on
   window resize. Inside the theme the canvas still moves after boot (WOW
   animations, lazy-loaded images, aside widgets), which would offset every
   click by the drift. Recompute before the pointer event reaches Phaser — the
   capture-phase listener on document runs ahead of Phaser's own canvas one. */
(function () {
  var refresh = function () {
    if (window.game && window.game.scale) window.game.scale.refresh();
  };
  window.addEventListener('load', refresh);
  window.addEventListener('scroll', refresh, { passive: true });
  document.addEventListener('pointerdown', refresh, true);
  document.addEventListener('touchstart', refresh, true);
  setTimeout(refresh, 1200);
})();
