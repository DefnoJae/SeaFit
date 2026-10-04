function init() {
  $ui.register((ctx) => {
    const BOOTSTRAP_ATTR = "data-seafit-bootstrap";

    function pageBootstrap() {
      (function () {
        var host = window.parent;
        var doc = host && host.document;
        if (!host || !doc) return;

        var VERSION = "0.1.0";
        var STORAGE_KEY = "seafit.mode";
        var STYLE_ID = "seafit-player-style";
        var CONTROL_ATTR = "data-seafit-control";
        var MODES = ["fit", "fill", "stretch"];
        var LABELS = {
          fit: "Original / Fit",
          fill: "Crop / Fill",
          stretch: "Stretch"
        };
        var ICONS = {
          fit: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="7" width="25" height="18" rx="2.5"></rect><rect x="9" y="11" width="14" height="10" rx="1.5"></rect></svg>',
          fill: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 5H6a1 1 0 0 0-1 1v5M21 5h5a1 1 0 0 1 1 1v5M11 27H6a1 1 0 0 1-1-1v-5M21 27h5a1 1 0 0 0 1-1v-5"></path><path d="M11 11l-5-5M21 11l5-5M11 21l-5 5M21 21l5 5"></path></svg>',
          stretch: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="7" width="25" height="18" rx="2.5"></rect><path d="M7.5 16h17M7.5 16l4-4M7.5 16l4 4M24.5 16l-4-4M24.5 16l-4 4"></path></svg>'
        };

        var currentMode = readMode();
        var bodyObserver = null;
        var mountQueued = false;
        var resizeHandler = null;

        if (host.__seafit && host.__seafit.version === VERSION) {
          try { host.__seafit.mount(); } catch (_) {}
          return;
        }

        if (host.__seafit && host.__seafit.destroy) {
          try { host.__seafit.destroy(); } catch (_) {}
        }

        function readMode() {
          try {
            var value = host.localStorage.getItem(STORAGE_KEY);
            if (MODES.indexOf(value) !== -1) return value;
          } catch (_) {}
          return "fit";
        }

        function saveMode() {
          try { host.localStorage.setItem(STORAGE_KEY, currentMode); } catch (_) {}
        }

        function getVideo() {
          return doc.querySelector('video[data-vc-element="video"], video[data-video-core-element]');
        }

        function ensureStyle() {
          var style = doc.getElementById(STYLE_ID);
          if (!style) {
            style = doc.createElement("style");
            style.id = STYLE_ID;
            (doc.head || doc.documentElement).appendChild(style);
          }

          style.textContent =
            'video[data-vc-element="video"][data-seafit-mode="fit"]{object-fit:contain!important;object-position:center!important;}' +
            'video[data-vc-element="video"][data-seafit-mode="fill"]{object-fit:cover!important;object-position:center!important;}' +
            'video[data-vc-element="video"][data-seafit-mode="stretch"]{object-fit:fill!important;object-position:center!important;}' +
            'button[' + CONTROL_ATTR + '="1"]{appearance:none;background:transparent!important;border:0!important;color:#fff!important;cursor:pointer;display:flex;align-items:center;justify-content:center;position:relative;height:100%;flex:none;padding:0 8px;line-height:1;transition:opacity .15s ease;overflow:visible!important;}' +
            'button[' + CONTROL_ATTR + '="1"]:hover{opacity:.8;}' +
            'button[' + CONTROL_ATTR + '="1"]:focus{outline:none;}' +
            'button[' + CONTROL_ATTR + '="1"]:focus-visible{outline:none;opacity:.6;}' +
            'button[' + CONTROL_ATTR + '="1"] svg{display:block;width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round;}' +
            'button[' + CONTROL_ATTR + '="1"]::after{content:attr(data-seafit-tooltip);position:absolute;left:50%;bottom:calc(100% + 8px);transform:translate(-50%,4px);padding:4px 7px;border-radius:6px;background:rgba(12,12,14,.94);border:1px solid rgba(255,255,255,.14);color:#fff;font:600 11px/1.2 ui-sans-serif,system-ui,sans-serif;white-space:nowrap;opacity:0;visibility:hidden;pointer-events:none;z-index:999;transition:opacity .12s ease,transform .12s ease,visibility .12s ease;}' +
            'button[' + CONTROL_ATTR + '="1"]:hover::after{opacity:1;visibility:visible;transform:translate(-50%,0);}' +
            '[data-vc-element="mobile-control-bar-bottom-content"] button[' + CONTROL_ATTR + '="1"]{padding:0 4px;}' +
            '[data-vc-element="mobile-control-bar-bottom-content"] button[' + CONTROL_ATTR + '="1"] svg{width:26px;height:26px;}';
        }

        function updateButton(button) {
          if (!button) return;
          var label = LABELS[currentMode] || LABELS.fit;
          button.setAttribute("data-seafit-state", currentMode);
          button.setAttribute("data-seafit-tooltip", "Aspect: " + label);
          button.setAttribute("aria-label", "Video aspect mode: " + label + ". Click to change.");
          button.setAttribute("title", "Aspect: " + label);
          button.innerHTML = ICONS[currentMode] || ICONS.fit;
        }

        function updateAllButtons() {
          var buttons = doc.querySelectorAll('button[' + CONTROL_ATTR + '="1"]');
          for (var i = 0; i < buttons.length; i++) updateButton(buttons[i]);
        }

        function applyMode(shouldSave) {
          var video = getVideo();
          if (video) video.setAttribute("data-seafit-mode", currentMode);
          updateAllButtons();
          if (shouldSave) saveMode();
        }

        function cycleMode(event) {
          if (event) {
            try { event.preventDefault(); } catch (_) {}
            try { event.stopPropagation(); } catch (_) {}
          }
          var index = MODES.indexOf(currentMode);
          currentMode = MODES[(index + 1) % MODES.length];
          applyMode(true);
        }

        function createButton(layout) {
          var button = doc.createElement("button");
          button.type = "button";
          button.setAttribute("role", "button");
          button.setAttribute("data-vc-element", "control-button");
          button.setAttribute(CONTROL_ATTR, "1");
          button.setAttribute("data-seafit-layout", layout);
          button.className = "vc-control-button";
          button.addEventListener("click", cycleMode, true);
          button.addEventListener("pointerdown", function (event) {
            try { event.stopPropagation(); } catch (_) {}
          }, true);
          updateButton(button);
          return button;
        }

        function findLastDirectControlButton(container) {
          if (!container || !container.children) return null;
          for (var i = container.children.length - 1; i >= 0; i--) {
            var child = container.children[i];
            if (child && child.matches && child.matches('button[data-vc-element="control-button"]')) return child;
          }
          return null;
        }

        function mountDesktopControl() {
          var section = doc.querySelector('[data-vc-element="control-bar-main-section"]');
          if (!section) return false;

          var existing = section.querySelector('button[' + CONTROL_ATTR + '="1"][data-seafit-layout="desktop"]');
          if (existing) {
            updateButton(existing);
            return true;
          }

          var button = createButton("desktop");
          var fullscreenButton = findLastDirectControlButton(section);
          if (fullscreenButton) section.insertBefore(button, fullscreenButton);
          else section.appendChild(button);
          return true;
        }

        function mountMobileControl() {
          var section = doc.querySelector('[data-vc-element="mobile-control-bar-bottom-content"]');
          if (!section) return false;

          var existing = section.querySelector('button[' + CONTROL_ATTR + '="1"][data-seafit-layout="mobile"]');
          if (existing) {
            updateButton(existing);
            return true;
          }

          var button = createButton("mobile");
          var fullscreenButton = findLastDirectControlButton(section);
          if (fullscreenButton) section.insertBefore(button, fullscreenButton);
          else section.appendChild(button);
          return true;
        }

        function removeStaleControls() {
          var buttons = doc.querySelectorAll('button[' + CONTROL_ATTR + '="1"]');
          for (var i = 0; i < buttons.length; i++) {
            var button = buttons[i];
            var layout = button.getAttribute("data-seafit-layout");
            if (layout === "desktop" && !button.closest('[data-vc-element="control-bar-main-section"]')) button.remove();
            if (layout === "mobile" && !button.closest('[data-vc-element="mobile-control-bar-bottom-content"]')) button.remove();
          }
        }

        function mount() {
          ensureStyle();
          var video = getVideo();
          if (!video) return false;

          video.setAttribute("data-seafit-mode", currentMode);
          removeStaleControls();
          var desktop = mountDesktopControl();
          var mobile = mountMobileControl();
          updateAllButtons();
          return desktop || mobile;
        }

        function queueMount() {
          if (mountQueued) return;
          mountQueued = true;
          host.requestAnimationFrame(function () {
            mountQueued = false;
            mount();
          });
        }

        resizeHandler = function () { queueMount(); };
        host.addEventListener("resize", resizeHandler, true);

        bodyObserver = new host.MutationObserver(function () {
          var video = getVideo();
          if (!video) return;

          var needsMode = video.getAttribute("data-seafit-mode") !== currentMode;
          var desktopSection = doc.querySelector('[data-vc-element="control-bar-main-section"]');
          var mobileSection = doc.querySelector('[data-vc-element="mobile-control-bar-bottom-content"]');
          var desktopMissing = desktopSection && !desktopSection.querySelector('button[' + CONTROL_ATTR + '="1"][data-seafit-layout="desktop"]');
          var mobileMissing = mobileSection && !mobileSection.querySelector('button[' + CONTROL_ATTR + '="1"][data-seafit-layout="mobile"]');

          if (needsMode || desktopMissing || mobileMissing) queueMount();
        });

        if (doc.body) bodyObserver.observe(doc.body, { childList: true, subtree: true, attributes: false });

        host.__seafit = {
          version: VERSION,
          mount: mount,
          getMode: function () { return currentMode; },
          setMode: function (mode) {
            if (MODES.indexOf(mode) === -1) return false;
            currentMode = mode;
            applyMode(true);
            return true;
          },
          nextMode: function () {
            cycleMode();
            return currentMode;
          },
          destroy: function () {
            if (bodyObserver) {
              try { bodyObserver.disconnect(); } catch (_) {}
            }
            if (resizeHandler) {
              try { host.removeEventListener("resize", resizeHandler, true); } catch (_) {}
            }

            var buttons = doc.querySelectorAll('button[' + CONTROL_ATTR + '="1"]');
            for (var i = 0; i < buttons.length; i++) {
              try { buttons[i].removeEventListener("click", cycleMode, true); } catch (_) {}
              try { buttons[i].remove(); } catch (_) {}
            }

            var video = getVideo();
            if (video) {
              try { video.removeAttribute("data-seafit-mode"); } catch (_) {}
            }

            var style = doc.getElementById(STYLE_ID);
            if (style) {
              try { style.remove(); } catch (_) {}
            }
          }
        };

        mount();
      })();
    }

    function makeBootstrapHTML() {
      var script = "(" + pageBootstrap.toString() + ")();";
      return "<!doctype html><html><head><meta charset=\"utf-8\"></head><body><script>" +
        script.replace(/<\/script/gi, "<\\/script") +
        "</script></body></html>";
    }

    async function ensureBootstrap() {
      try {
        var existing = await ctx.dom.queryOne("iframe[" + BOOTSTRAP_ATTR + "=\"1\"]");
        if (existing) return;

        var frame = await ctx.dom.createElement("iframe");
        frame.setAttribute(BOOTSTRAP_ATTR, "1");
        frame.setAttribute("aria-hidden", "true");
        frame.setAttribute("tabindex", "-1");
        frame.setCssText("display:none!important;width:0!important;height:0!important;border:0!important;position:absolute!important;");
        frame.setAttribute("srcdoc", makeBootstrapHTML());

        ctx.setTimeout(async () => {
          try {
            var video = await ctx.dom.queryOne('video[data-vc-element="video"]');
            var control = await ctx.dom.queryOne('button[data-seafit-control="1"]');
            if (video && !control) ctx.toast.warning("SeaFit could not attach to Seanime's video controls.");
          } catch (_) {}
        }, 1400);
      } catch (_) {
        try { ctx.toast.error("SeaFit failed to initialize."); } catch (_) {}
      }
    }

    async function ensureIfPlayerExists() {
      try {
        var video = await ctx.dom.queryOne('video[data-vc-element="video"]');
        if (video) await ensureBootstrap();
      } catch (_) {}
    }

    ctx.dom.onReady(() => { ensureIfPlayerExists(); });
    ctx.dom.onMainTabReady(() => { ensureIfPlayerExists(); });
    ctx.dom.observe('video[data-vc-element="video"]', (elements) => {
      if (elements && elements.length) ensureBootstrap();
    });
    ctx.dom.observe('[data-vc-element="control-bar-main-section"]', (elements) => {
      if (elements && elements.length) ensureBootstrap();
    });
    ctx.dom.observe('[data-vc-element="mobile-control-bar-bottom-content"]', (elements) => {
      if (elements && elements.length) ensureBootstrap();
    });
  });
}
