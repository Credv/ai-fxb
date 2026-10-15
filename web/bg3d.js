/* AI 窗口 · 3D 科幻控制台背景(轻量 WebGL)
 * 设计约束:本机常见为软件渲染(Microsoft Basic Render Driver / SwiftShader),无独显。
 * 因此背景必须极轻:pixelRatio 锁 1、少量图元、内置 FPS 看门狗自动降级、页面隐藏即暂停。
 * 依赖:同目录 ./vendor/three.module.js(已本地化,不联网、不访问 CDN)。
 * 地球贴图:纯程序化用 canvas 绘制(海洋渐变 + 大洲轮廓 + 经纬网 + 极冰),不加载任何外部图片。
 * 与 app.js 解耦:仅负责 canvas 背景,并提供 window.__bg3d.setEnabled(bool) 供手动开关。
 */
import * as THREE from './vendor/three.module.js';
import { CONTINENTS, landHubs } from './earth-data.js';

(function () {
  'use strict';

  var FLAG_KEY = 'ai-fxb-3d';
  var canvas = document.getElementById('bg3d');
  if (!canvas) return;

  try { if (localStorage.getItem(FLAG_KEY) === 'off') { canvas.remove(); return; } } catch (e) {}

  var EARTH_R = 1.6;
  var EARTH_POS = new THREE.Vector3(0, 0.3, -2.5);

  var renderer, scene, camera, DOT;
  var earth, earthWire, net, nodes, packets = [], halo, stars, stars2, grid, ring, ring2, ring3, glow;
  var raf = 0, running = false, degraded = false, dead = false;
  var W = 0, H = 0;

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
  // 圆形柔边点精灵:星点与节点共用,避免默认方形点被放大成色块
  function makeDotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  // 远景星域:半径很大的球壳 + sizeAttenuation:false,保证永远是细碎小点,不会飘成大块
  function makeStars(count, color, px, opacity) {
    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var r = 30 + Math.random() * 55;
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({
      color: color, size: px, sizeAttenuation: false, map: DOT,
      transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending
    }));
  }

  function makeRing(inner, outer, color, opacity, tiltX, tiltY) {
    var mesh = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 72),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, side: THREE.DoubleSide })
    );
    mesh.rotation.x = tiltX; mesh.rotation.y = tiltY || 0;
    return mesh;
  }

  // ---- 程序化地球贴图(等距圆柱投影 512x256),轮廓数据见 earth-data.js ----
  function makeEarthTexture() {
    var w = 512, h = 256;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');

    var ocean = g.createLinearGradient(0, 0, 0, h);
    ocean.addColorStop(0, '#0a2a52');
    ocean.addColorStop(0.5, '#061a38');
    ocean.addColorStop(1, '#04101f');
    g.fillStyle = ocean; g.fillRect(0, 0, w, h);

    g.strokeStyle = 'rgba(56,189,248,0.10)'; g.lineWidth = 1;
    for (var lon = -180; lon <= 180; lon += 30) {
      var x = (lon + 180) / 360 * w;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    }
    for (var lat = -60; lat <= 60; lat += 30) {
      var y = (90 - lat) / 180 * h;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }

    var land = g.createLinearGradient(0, 0, 0, h);
    land.addColorStop(0, '#0c3a4a');
    land.addColorStop(0.5, '#0a2b3a');
    land.addColorStop(1, '#0c3a4a');
    g.lineWidth = 1.6;
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
      g.strokeStyle = 'rgba(125,240,255,0.95)'; g.stroke();
    }

    g.fillStyle = 'rgba(180,220,250,0.5)';
    g.fillRect(0, 0, w, (90 - 78) / 180 * h);
    g.fillRect(0, (90 + 70) / 180 * h, w, h);

    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 1;
    return tex;
  }

  // ---- 情报网络层:大洲枢纽节点 + 跨大洲链路 + 流动数据包 ----
  // 节点用真实城市定位,链路强制连接不同大洲,且每个枢纽至少有一条链路,避免"亮着却不传输"的点
  // landHubs() 已保证每个落点都在大洲轮廓内(与贴图同一份数据),不会有点悬在海面上
  var HUBS = landHubs();
  HUBS.forEach(function (h, i) {
    if (h.snapped) console.warn('[bg3d] 枢纽 #' + i + '(' + h.c + ')不在陆地上,已吸附到最近陆地,偏移 ' + h.dist.toFixed(1) + '°');
    if (h.failed) console.warn('[bg3d] 枢纽 #' + i + '(' + h.c + ')附近找不到陆地');
  });

  // 节点与弧线都贴在 SURF 上:高于球面与 1.006 的全息线框壳。point/sprite 的片元深度取中心深度,
  // 中心离球面 0.048 > 点精灵半径 0.0375,所以正面半球的节点整颗可见,不会半埋或像从地里发光
  var SURF = EARTH_R * 1.03;

  function latLonToVec3(lat, lon, r) {
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }
  // 弧线沿两点所在的大圆做球面插值,半径 = SURF + sin(pi*t)*lift;sin 在 [0,1] 非负,
  // 所以整条弧线恒在球面之外。只抬高控制点的二次贝塞尔做不到:长弦的中段会落进球体,看着像断线/在地球内部通信
  function makeArc(a, b) {
    var u = a.clone().normalize(), v = b.clone().normalize();
    var ang = Math.acos(THREE.MathUtils.clamp(u.dot(v), -1, 1));
    var axis = new THREE.Vector3().crossVectors(u, v);
    if (axis.lengthSq() < 1e-4) {           // 近似对跖:叉积退化,取任一与 u 垂直的轴
      var ref = Math.abs(u.x) < 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      axis.crossVectors(u, ref).normalize();
    } else axis.normalize();
    var lift = 0.05 + ang * 0.22, q = new THREE.Quaternion();
    function at(t) {
      q.setFromAxisAngle(axis, ang * t);
      return u.clone().applyQuaternion(q).multiplyScalar(SURF + Math.sin(Math.PI * t) * lift);
    }
    return {
      segs: Math.min(48, Math.max(14, Math.round(ang / 0.055))),
      getPoint: at,
      getPoints: function (n) {
        var out = [];
        for (var i = 0; i <= n; i++) out.push(at(i / n));
        return out;
      }
    };
  }
  function buildNetwork(extraArcs) {
    var grp = new THREE.Group();
    var pts = HUBS.map(function (h) { return latLonToVec3(h.lat, h.lon, SURF); });

    var ng = new THREE.BufferGeometry();
    var np = new Float32Array(pts.length * 3);
    for (var i = 0; i < pts.length; i++) { np[i * 3] = pts[i].x; np[i * 3 + 1] = pts[i].y; np[i * 3 + 2] = pts[i].z; }
    ng.setAttribute('position', new THREE.BufferAttribute(np, 3));
    nodes = new THREE.Points(ng, new THREE.PointsMaterial({
      color: 0xa5f3fc, size: 0.075, sizeAttenuation: true, map: DOT,
      transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    grp.add(nodes);

    var used = {};
    var dirs = pts.map(function (p) { return p.clone().normalize(); });
    function pairKey(a, b) { return a < b ? a + '_' + b : b + '_' + a; }
    // 仍要求跨大洲,但在候选里挑球面距离最近的:近似对跖的超长弧大半程在地球背面,看着像断掉
    function pickOther(i) {
      var best = -1, bestAng = Infinity;
      for (var tries = 0; tries < 12; tries++) {
        var j = (Math.random() * HUBS.length) | 0;
        if (j === i || HUBS[j].c === HUBS[i].c || used[pairKey(i, j)]) continue;
        var ang = Math.acos(THREE.MathUtils.clamp(dirs[i].dot(dirs[j]), -1, 1));
        if (ang < bestAng) { bestAng = ang; best = j; }
      }
      return best;
    }
    var curves = [];
    function link(i, j) { used[pairKey(i, j)] = 1; curves.push(makeArc(pts[i], pts[j])); }

    // 1) 每个枢纽先各连一条跨大洲链路 —— 保证没有"闲置光点"
    var order = pts.map(function (_, idx) { return idx; }).sort(function () { return Math.random() - 0.5; });
    order.forEach(function (i) { var j = pickOther(i); if (j >= 0) link(i, j); });
    // 2) 再补充若干跨大洲链路,让网络更密
    for (var k = 0; k < extraArcs; k++) {
      var a = (Math.random() * HUBS.length) | 0, b = pickOther(a);
      if (b >= 0) link(a, b);
    }

    // 所有弧线合并进一个 LineSegments,省掉大量 draw call
    var seg = [];
    curves.forEach(function (cv) {
      var ps = cv.getPoints(cv.segs);
      for (var s = 0; s < ps.length - 1; s++) seg.push(ps[s].x, ps[s].y, ps[s].z, ps[s + 1].x, ps[s + 1].y, ps[s + 1].z);
    });
    var lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      color: 0x67e8f9, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false
    })));

    curves.forEach(function (cv) {
      var pk = new THREE.Sprite(new THREE.SpriteMaterial({
        map: DOT, color: 0xd9fbff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      pk.scale.set(0.085, 0.085, 1);
      packets.push({ sprite: pk, curve: cv, t: Math.random(), sp: 0.14 + Math.random() * 0.2 });
      grp.add(pk);
    });
    return grp;
  }

  function build(starCount, extraArcs) {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070f, 0.02);
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 140);
    camera.position.set(0, 0.7, 6.5);

    stars = makeStars(starCount, 0x9fe9ff, 2, 0.85);
    stars2 = makeStars(Math.floor(starCount * 0.45), 0xb9a4ff, 2.8, 0.5);
    scene.add(stars); scene.add(stars2);

    grid = new THREE.GridHelper(44, 26, 0x1d4ed8, 0x112233);
    grid.material.transparent = true;
    grid.material.opacity = 0.14;
    grid.position.y = -2.4;
    scene.add(grid);

    // 地球本体(无光照贴图,软件渲染也稳定)+ 全息线框壳
    earth = new THREE.Group();
    earth.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 48, 32),
      new THREE.MeshBasicMaterial({ map: makeEarthTexture() })
    ));
    earthWire = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.006, 28, 20),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, wireframe: true, transparent: true, opacity: 0.11, depthWrite: false })
    );
    earth.add(earthWire);
    earth.position.copy(EARTH_POS);
    earth.rotation.z = -0.41;
    scene.add(earth);

    // 情报网络挂在地球上,一起自转;弧线/节点被球体遮挡,只显正面
    net = buildNetwork(extraArcs);
    earth.add(net);

    // 外层全息壳:缓慢反向自转,增加纵深
    halo = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.7, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.06, depthWrite: false })
    );
    halo.position.copy(EARTH_POS);
    scene.add(halo);

    glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0x6fa8ff, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(6.4, 6.4, 1);
    glow.position.copy(EARTH_POS);
    scene.add(glow);

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

  var t0 = 0, last = 0;
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    var t = (now - t0) / 1000;
    var dt = Math.min(0.05, (now - last) / 1000) || 0.016;
    last = now;

    stars.rotation.y = t * 0.012;
    stars2.rotation.y = -t * 0.008;
    earth.rotation.y = t * 0.085;
    halo.rotation.y = -t * 0.05;
    halo.rotation.x = Math.sin(t * 0.07) * 0.15;
    ring.rotation.z = t * 0.05;
    ring2.rotation.z = -t * 0.07;
    ring3.rotation.z = t * 0.09;
    for (var i = 0; i < packets.length; i++) {
      var p = packets[i];
      p.t += dt * p.sp;
      if (p.t > 1) p.t -= 1;
      p.sprite.position.copy(p.curve.getPoint(p.t));
      p.sprite.material.opacity = 0.35 + Math.sin(p.t * Math.PI) * 0.6;
    }
    glow.material.opacity = 0.55 + Math.sin(t * 0.8) * 0.1;
    camera.position.x = Math.sin(t * 0.08) * 0.5;
    camera.position.y = 0.7 + Math.sin(t * 0.05) * 0.12;
    camera.lookAt(EARTH_POS);
    renderer.render(scene, camera);
    watchdog(now);
  }

  var frames = 0, watchStart = 0, watched = false;
  function watchdog(now) {
    if (watched) return;
    if (!watchStart) { watchStart = now; return; }
    frames++;
    var dur = now - watchStart;
    if (dur >= 2500) {
      watched = true;
      var fps = frames / (dur / 1000);
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
    for (var i = 0; i < packets.length; i++) packets[i].sprite.position.copy(packets[i].curve.getPoint(0.5));
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
    running = true;
    var n = performance.now(); t0 = n; last = n;
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
    DOT = makeDotTexture();

    // 手机/平板 GPU 弱:按低配构建(星点与数据链路减半),帧率看门狗仍然兜底
    var coarse = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
    var light = coarse || window.innerWidth < 700 || isSoftwareRenderer();
    build(light ? 380 : 1000, light ? 6 : 16);
    resize();
    if (isSoftwareRenderer()) { degrade(); return; }

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
