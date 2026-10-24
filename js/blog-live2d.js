const smallScreen = window.matchMedia('(max-width: 768px)');
if (!document.querySelector('#anMusic-page, .music-old-player')) {
  const modelPath = '/live2d-model-xiaohei/小黑.blog.model3.json';
  let resources;
  let active;
  let lifecycle = Promise.resolve();

  const loadResources = () => {
    resources ??= Promise.all([
      import('/js/vendor/l2d-widget.js'),
      fetch(modelPath).then(response => {
        if (!response.ok) throw new Error(`Live2D model: ${response.status}`);
        return response.json();
      }),
    ]).catch(error => {
      resources = undefined;
      throw error;
    });
    return resources;
  };

  async function mount() {
    if (smallScreen.matches || active) return;
    const [{ createWidget }, modelDefinition] = await loadResources();
    if (smallScreen.matches || active) return;
    const gaze = {
      maxTurn: 1,
      depth: 50,
      // Eye position as a fraction of the existing 220x260 canvas.
      eyeX: 0.30,
      eyeY: 0.54,
    };
    const manualIdleModels = new WeakSet();
    const pendingAreas = new Set();
    let tapQueued = false;
    let tapX = 0;
    // The model manifest assigns motions to hit areas; use those exact files.
    const hitMotions = new Map(modelDefinition.HitAreas.flatMap(hit => {
      const area = hit.Name.trim();
      if (!hit.Motion) return area === '左耳' || area === '右耳' ? [[area, [area, 0]]] : [];
      const [group, file] = hit.Motion.split(':', 2);
      const index = file ? modelDefinition.FileReferences.Motions[group]?.findIndex(motion => motion.File === file) : 0;
      return index >= 0 ? [[area, [group, index]]] : [];
    }));
    const keyboardLeftIndex = modelDefinition.FileReferences.Motions.Idle.findIndex(
      motion => motion.File === 'motion/左.motion3.json',
    );

    const before = new Set(document.body.children);
    const widget = createWidget({
      model: {
        path: modelPath,
        scale: 1.35,
        offset: [0.35, -0.05],
        volume: 0,
        tips: false,
      },
      position: 'bottom-right',
      size: { width: 220, height: 260 },
      primaryColor: '#e4b5ea',
      transitionDuration: 1000,
    });
    const stage = widget.l2d.getCanvas().parentElement;
    const current = { widget, stage, cleanupGaze: () => {} };
    active = current;
    widget.l2d.getCanvas().addEventListener('pointerdown', event => {
      const rect = widget.l2d.getCanvas().getBoundingClientRect();
      tapX = (event.clientX - rect.left) / rect.width;
    }, { passive: true });
    stage.classList.add('blog-live2d-stage');
    for (const element of document.body.children) {
      if (!before.has(element) && element !== stage) {
        element.classList.add('blog-live2d-status');
      }
    }

    widget.l2d.on('tap', area => {
      if (!area) return;
      pendingAreas.add(area.trim());
      if (tapQueued) return;
      tapQueued = true;
      queueMicrotask(() => {
        tapQueued = false;
        // Several meshes may overlap, so choose the smallest hit region.
        const hitAreas = widget.l2d.getHitAreaBounds();
        const bounds = new Map(hitAreas.map(hit => [hit.name.trim(), hit.w * hit.h]));
        const area = [...pendingAreas]
          .filter(name => hitMotions.has(name))
          .sort((left, right) => (bounds.get(left) ?? Infinity) - (bounds.get(right) ?? Infinity))[0];
        pendingAreas.clear();
        if (!area) return;
        let motion = hitMotions.get(area);
        if (area === '键盘01') {
          // The left half uses the model's left-key gesture.
          const keyboard = hitAreas.find(hit => hit.name.trim() === area);
          if (keyboard && tapX < keyboard.x + keyboard.w / 2) motion = ['Idle', keyboardLeftIndex];
        }
        widget.l2d.playMotion(motion[0], motion[1], 3);
      });
    });

    widget.l2d.on('loaded', () => {
      if (active !== current) return;
      const runtime = widget.l2d._state?.l2d6Model;
      const manager = runtime?._subdelegates?.[0]?.getLive2DManager();
      const model = manager?._models?.[0];
      if (model && !manualIdleModels.has(model)) {
        const startRandomMotion = model.startRandomMotion;
        model.startRandomMotion = function (group, priority, ...rest) {
          if (group === 'Idle' && priority === 1) return -1;
          return startRandomMotion.call(this, group, priority, ...rest);
        };
        model._motionManager.stopAllMotions();
        manualIdleModels.add(model);
      }
      if (!manager || stage.dataset.gazeMode === 'ray') return;

      // Match the previous widget's full [-1, 1] look range. Smooth the
      // direction near the eyes so a small cursor move does not snap the head.
      document.removeEventListener('mousemove', runtime.mouseMoveEventListener);
      document.removeEventListener('mouseout', runtime.mouseEndedEventListener);
      const onMove = event => {
        const rect = widget.l2d.getCanvas().getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width * gaze.eyeX);
        const dy = rect.top + rect.height * gaze.eyeY - event.clientY;
        const distance = Math.hypot(dx, dy);
        const turn = distance === 0 ? 0 :
          gaze.maxTurn * (2 / Math.PI) * Math.atan2(distance, gaze.depth) / distance;
        manager.onDrag(dx * turn, dy * turn);
      };
      const onLeave = event => {
        if (!event.relatedTarget) manager.onDrag(0, 0);
      };
      document.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('mouseout', onLeave, { passive: true });
      const onBlur = () => manager.onDrag(0, 0);
      window.addEventListener('blur', onBlur);
      current.cleanupGaze = () => {
        document.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseout', onLeave);
        window.removeEventListener('blur', onBlur);
      };
      stage.dataset.gazeMode = 'ray';
    });

  }

  async function reconcile() {
    if (!smallScreen.matches) return mount();
    if (!active) return;
    const current = active;
    active = undefined;
    current.cleanupGaze();
    const destroying = current.widget.destroy();
    // The mobile CSS hides the stage, so it may not emit transitionend.
    const fallback = setTimeout(() => current.stage.dispatchEvent(new Event('transitionend')), 1100);
    try {
      await destroying;
    } finally {
      clearTimeout(fallback);
    }
  }

  const syncWidget = () => {
    lifecycle = lifecycle.then(reconcile).catch(error => console.error('Live2D widget:', error));
  };
  smallScreen.addEventListener('change', syncWidget);
  syncWidget();
}
