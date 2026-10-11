/* AI 窗口 · 3D 科幻控制台背景(轻量 WebGL)
 * 设计约束:本机常见为软件渲染(Microsoft Basic Render Driver / SwiftShader),无独显。
 * 因此背景必须极轻:pixelRatio 锁 1、少量图元、内置 FPS 看门狗自动降级、页面隐藏即暂停。
 * 依赖:同目录 ./vendor/three.module.js(已本地化,不联网、不访问 CDN)。
 * 与 app.js 解耦:仅负责 canvas 背景,并提供 window.__bg3d.setEnabled(bool) 供手动开关。
 */
import * as THREE from './vendor/three.module.js';

(function () {
  'use strict';

  var FLAG_KEY = 'ai-fxb-3d';
  var canvas = document.getElementById('bg3d');
  if (!canvas) return;

  try { if (localStorage.getItem(FLAG_KEY) === 'off') { canvas.remove(); return; } } catch (e) {}

  var renderer, scene, camera, stars, grid, ring, raf = 0, running = false;
  var degraded = false, dead = false;
  var W = 0, H = 0;

  function isSoftwareRenderer() {
    try {
      var gl = renderer.getContext();
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      return /basic render|swiftshader|llvmpipe|software|mesa off/i.test(name);
    } catch (e) { return false; }
  }

  function build(starCount) {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070f, 0.055);
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0.6, 6);

    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(starCount * 3);
    for (var i = 0; i < starCount; i++) {
      var r = 6 + Math.random() * 16;
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.6;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var m = new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false });
    stars = new THREE.Points(g, m);
    scene.add(stars);

    grid = new THREE.GridHelper(40, 24, 0x1d4ed8, 0x112233);
    grid.material.transparent = true;
    grid.material.opacity = 0.16;
    grid.position.y = -2.2;
    scene.add(grid);

    var rg = new THREE.RingGeometry(2.1, 2.16, 64);
    var rm = new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
    ring = new THREE.Mesh(rg, rm);
    ring.rotation.x = Math.PI / 2.4;
    scene.add(ring);
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }

  var t0 = 0;
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    var t = (now - t0) / 1000;
    stars.rotation.y = t * 0.02;
    ring.rotation.z = t * 0.05;
    camera.position.x = Math.sin(t * 0.08) * 0.5;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    watchdog(now);
  }

  var frames = 0, watchStart = 0, watched = false;
  function watchdog(now) {
    if (watched) return;
    if (!watchStart) { watchStart = now; return; }
    frames++;
    var dt = now - watchStart;
    if (dt >= 2500) {
      watched = true;
      var fps = frames / (dt / 1000);
      if (fps < 12) kill();
      else if (fps < 24 && !degraded) degrade();
    }
  }

  function degrade() {
    degraded = true;
    stop();
    if (stars) stars.geometry.setDrawRange(0, Math.floor(stars.geometry.attributes.position.count / 2));
    renderer.render(scene, camera);
  }

  function kill() {
    dead = true; stop();
    if (canvas) canvas.style.display = 'none';
  }

  function start() {
    if (running || dead || degraded) return;
    running = true; t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function init() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, powerPreference: 'default' });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);

    var soft = isSoftwareRenderer();
    build(soft ? 500 : 1100);
    resize();
    if (soft) { degrade(); return; }

    start();

    window.addEventListener('resize', function () {
      resize();
      if (degraded) renderer.render(scene, camera);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else if (!degraded && !dead) start();
    });
  }

  window.__bg3d = {
    setEnabled: function (on) {
      try { localStorage.setItem(FLAG_KEY, on ? 'on' : 'off'); } catch (e) {}
      if (on) {
        canvas.style.display = '';
        if (!dead && !degraded) start(); else if (!dead) renderer.render(scene, camera);
      } else { stop(); canvas.style.display = 'none'; }
    },
    isDegraded: function () { return degraded || dead; }
  };

  try { init(); } catch (e) { console.warn('[bg3d] init failed:', e && e.message, e); canvas.style.display = 'none'; }
})();
