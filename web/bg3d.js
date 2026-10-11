/* AI 窗口 · 3D 科幻控制台背景(轻量 WebGL)
 * 设计约束:本机常见为软件渲染(Microsoft Basic Render Driver / SwiftShader),无独显。
 * 因此背景必须极轻:pixelRatio 锁 1、少量图元、内置 FPS 看门狗自动降级、页面隐藏即暂停。
 * 依赖:同目录 ./vendor/three.module.js(已本地化,不联网、不访问 CDN)。
 * 地球贴图:纯程序化用 canvas 绘制(海洋渐变 + 大洲轮廓 + 经纬网 + 极冰),不加载任何外部图片。
 * 与 app.js 解耦:仅负责 canvas 背景,并提供 window.__bg3d.setEnabled(bool) 供手动开关。
 */
import * as THREE from './vendor/three.module.js';

(function () {
  'use strict';

  var FLAG_KEY = 'ai-fxb-3d';
  var canvas = document.getElementById('bg3d');
  if (!canvas) return;

  try { if (localStorage.getItem(FLAG_KEY) === 'off') { canvas.remove(); return; } } catch (e) {}

  var renderer, scene, camera, stars, stars2, grid, ring, ring2, ring3, earth, earthWire, glow, raf = 0, running = false;
  var degraded = false, dead = false;
  var W = 0, H = 0;
  var EARTH_POS = new THREE.Vector3(0, 0.3, -2.5);

  function isSoftwareRenderer() {
    try {
      var gl = renderer.getContext();
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      return /basic render|swiftshader|llvmpipe|software|mesa off/i.test(name);
    } catch (e) { return false; }
  }

  function makeGlowTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(140,190,255,0.95)');
    grad.addColorStop(0.28, 'rgba(90,120,255,0.4)');
    grad.addColorStop(0.65, 'rgba(124,58,237,0.14)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function makeStars(count, color, size, opacity) {
    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var r = 6 + Math.random() * 16;
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.6;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: color, size: size, sizeAttenuation: true, transparent: true, opacity: opacity, depthWrite: false }));
  }

  function makeRing(inner, outer, color, opacity, tiltX, tiltY) {
    var mesh = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 72),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, side: THREE.DoubleSide })
    );
    mesh.rotation.x = tiltX; mesh.rotation.y = tiltY || 0;
    return mesh;
  }

  // ---- 程序化地球贴图(等距圆柱投影 512x256) ----
  var CONTINENTS = [
    // 北美洲
    [[-168,65],[-160,70],[-140,70],[-125,70],[-110,68],[-95,70],[-85,65],[-80,60],[-75,55],[-65,50],[-55,50],[-65,45],[-70,42],[-75,35],[-80,30],[-82,25],[-90,28],[-97,26],[-105,22],[-110,24],[-115,30],[-122,35],[-125,42],[-124,48],[-130,55],[-140,60],[-150,60],[-165,62]],
    // 格陵兰
    [[-45,60],[-30,68],[-25,75],[-35,82],[-55,82],[-60,75],[-52,68]],
    // 南美洲
    [[-80,8],[-72,10],[-60,8],[-50,2],[-45,-5],[-38,-8],[-40,-18],[-48,-25],[-55,-32],[-62,-40],[-65,-48],[-70,-54],[-72,-45],[-72,-35],[-70,-20],[-75,-12],[-80,-5],[-78,2]],
    // 非洲
    [[-15,30],[0,35],[12,33],[25,32],[34,30],[38,20],[43,12],[50,12],[45,4],[42,-4],[40,-15],[35,-22],[30,-30],[25,-34],[18,-34],[12,-25],[10,-15],[8,-2],[2,5],[-5,5],[-10,6],[-15,12],[-17,20],[-12,25]],
    // 欧亚大陆(含中/南/东南亚)
    [[-10,36],[-8,43],[-2,48],[2,51],[5,53],[8,55],[10,58],[14,60],[20,62],[26,66],[32,68],[40,68],[50,70],[60,72],[70,72],[80,74],[95,76],[110,74],[125,72],[140,70],[155,68],[170,66],[180,66],[180,62],[170,60],[162,58],[155,55],[145,50],[140,45],[135,42],[130,40],[126,38],[122,32],[120,28],[115,22],[110,18],[105,12],[103,8],[100,10],[98,14],[95,18],[92,22],[88,24],[82,20],[78,12],[74,18],[70,24],[66,26],[62,28],[58,30],[52,28],[48,30],[44,34],[40,38],[35,36],[30,34],[25,36],[20,40],[15,40],[12,44],[8,44],[3,43],[-3,40],[-6,37]],
    // 不列颠群岛
    [[-5,50],[-3,54],[-4,58],[-2,57],[0,53],[1,51]],
    // 日本列岛
    [[130,32],[135,34],[140,36],[142,40],[145,44],[141,42],[138,37],[134,34]],
    // 马达加斯加
    [[44,-16],[48,-14],[50,-18],[48,-25],[45,-24],[43,-20]],
    // 印尼(苏门答腊/爪哇)
    [[95,5],[105,-2],[115,-5],[120,-8],[110,-8],[100,-2],[96,2]],
    // 澳大利亚
    [[114,-22],[122,-18],[130,-12],[137,-12],[142,-11],[145,-15],[150,-22],[153,-28],[150,-35],[145,-38],[138,-35],[132,-32],[125,-32],[118,-34],[114,-30],[113,-25]]
  ];

  function makeEarthTexture() {
    var w = 512, h = 256;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');

    // 海洋:深蓝渐变
    var ocean = g.createLinearGradient(0, 0, 0, h);
    ocean.addColorStop(0, '#0a2a52');
    ocean.addColorStop(0.5, '#061a38');
    ocean.addColorStop(1, '#04101f');
    g.fillStyle = ocean; g.fillRect(0, 0, w, h);

    // 经纬网(淡青)
    g.strokeStyle = 'rgba(56,189,248,0.10)'; g.lineWidth = 1;
    for (var lon = -180; lon <= 180; lon += 30) {
      var x = (lon + 180) / 360 * w;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    }
    for (var lat = -60; lat <= 60; lat += 30) {
      var y = (90 - lat) / 180 * h;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }

    // 大洲:青绿填充 + 亮青海岸线
    var land = g.createLinearGradient(0, 0, 0, h);
    land.addColorStop(0, '#0e7490');
    land.addColorStop(0.5, '#15957e');
    land.addColorStop(1, '#0e7490');
    g.lineWidth = 1.2;
    for (var i = 0; i < CONTINENTS.length; i++) {
      var poly = CONTINENTS[i];
      g.beginPath();
      for (var j = 0; j < poly.length; j++) {
        var px = (poly[j][0] + 180) / 360 * w;
        var py = (90 - poly[j][1]) / 180 * h;
        if (j === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = land; g.fill();
      g.strokeStyle = 'rgba(103,232,249,0.75)'; g.stroke();
    }

    // 极冰
    g.fillStyle = 'rgba(214,238,255,0.85)';
    g.fillRect(0, 0, w, (90 - 78) / 180 * h);          // 北极带
    g.fillRect(0, (90 + 70) / 180 * h, w, h);          // 南极带

    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 1;
    return tex;
  }

  function build(starCount) {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070f, 0.05);
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0.7, 6.5);

    // 双色星域:青色主星 + 紫色远景星,营造纵深
    stars = makeStars(starCount, 0x67e8f9, 0.06, 0.9);
    stars2 = makeStars(Math.floor(starCount * 0.5), 0xa78bfa, 0.11, 0.55);
    scene.add(stars); scene.add(stars2);

    // 地平网格
    grid = new THREE.GridHelper(44, 26, 0x1d4ed8, 0x112233);
    grid.material.transparent = true;
    grid.material.opacity = 0.16;
    grid.position.y = -2.4;
    scene.add(grid);

    // 地球:程序化贴图球体(无光照 MeshBasic,软件渲染也稳定) + 全息线框壳 + 大气辉光
    earth = new THREE.Group();
    var surface = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 48, 32),
      new THREE.MeshBasicMaterial({ map: makeEarthTexture() })
    );
    earthWire = new THREE.Mesh(
      new THREE.SphereGeometry(1.608, 28, 20),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, wireframe: true, transparent: true, opacity: 0.12 })
    );
    earth.add(surface); earth.add(earthWire);
    earth.position.copy(EARTH_POS);
    earth.rotation.z = -0.41; // 地轴倾角 ~23.5°
    scene.add(earth);

    glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0x6fa8ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(6, 6, 1);
    glow.position.copy(EARTH_POS);
    scene.add(glow);

    // 三层 HUD 环:不同半径 / 倾角,环绕地球
    ring = makeRing(2.3, 2.36, 0xa78bfa, 0.3, Math.PI / 2.4);
    ring2 = makeRing(3.0, 3.05, 0x38bdf8, 0.22, Math.PI / 2.1, 0.4);
    ring3 = makeRing(2.0, 2.04, 0x67e8f9, 0.28, Math.PI / 1.7, -0.5);
    ring.position.copy(EARTH_POS); ring2.position.copy(EARTH_POS); ring3.position.copy(EARTH_POS);
    scene.add(ring); scene.add(ring2); scene.add(ring3);
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
    stars2.rotation.y = -t * 0.013;
    earth.rotation.y = t * 0.10; // 自转
    ring.rotation.z = t * 0.05;
    ring2.rotation.z = -t * 0.07;
    ring3.rotation.z = t * 0.09;
    glow.material.opacity = 0.6 + Math.sin(t * 0.8) * 0.12;
    camera.position.x = Math.sin(t * 0.08) * 0.6;
    camera.position.y = 0.7 + Math.sin(t * 0.05) * 0.15;
    camera.lookAt(EARTH_POS);
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
    [stars, stars2].forEach(function (s) {
      if (s) s.geometry.setDrawRange(0, Math.floor(s.geometry.attributes.position.count / 2));
    });
    camera.position.set(0, 0.7, 6.5);
    camera.lookAt(EARTH_POS);
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
