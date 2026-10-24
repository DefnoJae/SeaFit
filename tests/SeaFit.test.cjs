const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/SeaFit.js'), 'utf8');
const bootstrap = source.slice(source.indexOf('    function pageBootstrap()'), source.indexOf('    function makeBootstrapHTML()'));

function setup(stored = {}, frame = null) {
  const state = { title: 'Anime A', video: element(), style: null, writes: 0, frames: [], listeners: {} };
  function element() {
    const attrs = {};
    return { getAttribute: k => attrs[k] ?? null, setAttribute(k, v) { attrs[k] = v; }, removeAttribute(k) { delete attrs[k]; }, remove() {} };
  }
  const storage = { 'seafit.modeByAnime.v1': JSON.stringify(stored), 'seafit.mode': 'stretch' };
  const doc = {
    documentElement: {}, head: { appendChild(s) { state.style = s; } },
    getElementById: () => state.style,
    createElement: () => element(),
    querySelector(s) {
      if (s.startsWith('video')) return state.video;
      if (s.includes('top-playback-info-title')) return state.title ? { textContent: state.title } : null;
      return null;
    },
    querySelectorAll: () => []
  };
  const host = {
    document: doc, URL, location: { href: 'https://seanime.test/' },
    localStorage: { getItem: k => storage[k] ?? null, setItem(k, v) { state.writes++; storage[k] = v; }, removeItem(k) { delete storage[k]; } },
    MutationObserver: class { constructor(cb) { state.observe = cb; } observe(target, options) { state.options = options; } disconnect() { state.disconnected = true; } },
    requestAnimationFrame(cb) { state.frames.push(cb); return state.frames.length; },
    cancelAnimationFrame() { state.frames = []; },
    addEventListener(k, cb) { state.listeners[k] = cb; }, removeEventListener(k) { delete state.listeners[k]; }
  };
  vm.runInNewContext(bootstrap + ';pageBootstrap();', { window: { parent: host, frameElement: frame } });
  state.host = host;
  state.api = host.__seafit;
  state.storage = storage;
  state.flush = () => { let count = 0; while (state.frames.length) { assert.ok(++count < 10, 'mount must settle'); state.frames.shift()(); } };
  state.replace = () => { state.video = element(); state.observe(); state.flush(); };
  return state;
}

test('same anime retains mode across video replacement and reload; other anime default to Fit', () => {
  const s = setup();
  s.api.setMode('stretch');
  s.replace();
  assert.equal(s.video.getAttribute('data-seafit-mode'), 'stretch');
  s.title = 'Anime B'; s.observe(); s.flush();
  assert.equal(s.video.getAttribute('data-seafit-mode'), 'fit');
  s.api.setMode('fill');
  s.title = '  ANIME   A '; s.observe(); s.flush();
  assert.equal(s.api.getMode(), 'stretch');
  assert.equal(setup(JSON.parse(s.storage['seafit.modeByAnime.v1'])).api.getMode(), 'stretch');
});

test('missing identity resets to Fit and never persists unknown selections', () => {
  const s = setup(); s.api.setMode('stretch');
  s.title = ''; s.observe(); s.flush();
  assert.equal(s.api.getAnimeKey(), null);
  assert.equal(s.video.getAttribute('data-seafit-mode'), 'fit');
  const writes = s.writes;
  s.api.nextMode(); s.api.setMode('stretch');
  assert.equal(s.api.getMode(), 'fit');
  assert.equal(s.writes, writes);
  s.title = 'Anime A'; s.observe(); s.flush();
  assert.equal(s.api.getMode(), 'stretch');
});

test('entry IDs are exact-route scoped; corrupt storage safely defaults', () => {
  const s = setup({ 'id:12': 'fill', 'title:anime a': 'invalid' });
  assert.equal(s.api.getMode(), 'fit');
  s.host.location.href = 'https://seanime.test/entry?id=12'; s.api.mount();
  assert.equal(s.api.getMode(), 'fill');
  s.host.location.href = 'https://seanime.test/entry-other?id=12'; s.api.mount();
  assert.equal(s.api.getMode(), 'fit');
  s.storage['seafit.modeByAnime.v1'] = '{';
  s.title = 'Anime B'; s.api.mount();
  assert.equal(s.api.getMode(), 'fit');
});

test('observer coalesces mounts, watches source changes, and cleanup cancels pending work', () => {
  const s = setup();
  assert.ok(s.options.attributeFilter.includes('src'));
  s.api.setMode('fill'); s.video.removeAttribute('data-seafit-mode');
  s.observe(); s.observe();
  assert.equal(s.frames.length, 1);
  s.flush(); s.observe();
  assert.equal(s.frames.length, 0);
  s.listeners.resize(); s.api.destroy();
  assert.equal(s.frames.length, 0);
  assert.equal(s.disconnected, true);
  assert.equal(s.api.mount(), false);
});

test('version matches manifest and marketplace icon stays unchanged', () => {
  const manifest = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../Manifest.json')));
  assert.equal(manifest.version, '0.1.5');
  assert.equal(setup().api.version, manifest.version);
  assert.equal(manifest.icon, 'https://raw.githubusercontent.com/DefnoJae/SeaFit/refs/heads/main/assets/iconv3.jpg');
});

test('concurrent player notifications create only one bootstrap frame', async () => {
  const callbacks = [];
  let created = 0;
  let frame = null;
  const ctx = {
    videoCore: { addEventListener() {}, getCurrentMedia() { return { id: 1500 }; } },
    dom: {
      onReady() {}, onMainTabReady() {},
      observe(selector, cb) { callbacks.push(cb); },
      async queryOne() { return frame; },
      async createElement() { created++; frame = { setAttribute() {}, setCssText() {} }; return frame; }
    },
    setTimeout() {}, toast: { error() { assert.fail('bootstrap failed'); } }
  };
  vm.runInNewContext(source + ';init();', { $ui: { register(cb) { cb(ctx); } } });
  callbacks.forEach(cb => cb([{}]));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(created, 1);
});

test('extension reload upgrades an existing frame once and playback events update its identity', async () => {
  const events = {};
  const attrs = {};
  let scripts = 0;
  let id = 1500;
  const frame = { setAttribute(k,v) { attrs[k] = v; if(k === 'srcdoc') scripts++; } };
  const ctx = {
    videoCore: { getCurrentMedia: () => ({id}), addEventListener(k,cb) { events[k] = cb; } },
    dom: { onReady() {}, onMainTabReady() {}, observe() {}, async queryOne() { return frame; } },
    toast: { error() { assert.fail('bootstrap failed'); } }
  };
  vm.runInNewContext(source + ';init();', { $ui: { register(cb) { cb(ctx); } } });
  events['video-loaded']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attrs['data-seafit-anime-id'], '1500');
  assert.match(attrs.srcdoc, /0\.1\.5/);
  id = 999; events['video-playback-state']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attrs['data-seafit-anime-id'], '999');
  id = null; events['video-playlist']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attrs['data-seafit-anime-id'], '');
  assert.equal(scripts, 1);
});

test('playback identity survives hidden titles and ignores unrelated entry pages', () => {
  let id = '1500';
  const s = setup({}, { hasAttribute() { return true; }, getAttribute() { return id; } });
  s.api.setMode('fill');
  s.title = ''; s.host.location.href = 'app://-/entry?id=999'; s.api.mount();
  assert.equal(s.api.getAnimeKey(), 'id:1500');
  assert.equal(s.api.getMode(), 'fill');
  id = '999'; s.observe(); s.flush();
  assert.equal(s.api.getMode(), 'fit');
  id = ''; s.observe(); s.flush();
  assert.equal(s.api.getAnimeKey(), null);
  assert.equal(s.api.getMode(), 'fit');
});

test('Anime4K display canvases inherit mode when added or replaced', () => {
  const s = setup();
  const attrs = {};
  const canvas = { getAttribute: k => attrs[k], setAttribute(k,v) { attrs[k] = v; }, removeAttribute(k) { delete attrs[k]; } };
  s.video.parentElement = { querySelectorAll(selector) {
    assert.equal(selector, 'canvas.vc-anime4k-canvas, canvas[data-mpv-prism-video-canvas]');
    return [canvas];
  } };
  s.api.setMode('fill');
  assert.equal(attrs['data-seafit-mode'], 'fill');
  canvas.removeAttribute('data-seafit-mode'); s.observe(); s.flush();
  assert.equal(attrs['data-seafit-mode'], 'fill');
  s.api.destroy();
  assert.equal(attrs['data-seafit-mode'], undefined);
});
