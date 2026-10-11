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
  var HUBS = [
    { c: 'NA', lat: 37.77, lon: -122.42 },  // 旧金山
    { c: 'NA', lat: 40.71, lon: -74.0 },    // 纽约
    { c: 'NA', lat: 43.65, lon: -79.38 },   // 多伦多
    { c: 'NA', lat: 30.27, lon: -97.74 },   // 奥斯汀
    { c: 'NA', lat: 19.43, lon: -99.13 },   // 墨西哥城
    { c: 'SA', lat: -23.55, lon: -46.63 },  // 圣保罗
    { c: 'SA', lat: -34.6, lon: -58.38 },   // 布宜诺斯艾利斯
    { c: 'SA', lat: 4.71, lon: -74.07 },    // 波哥大
    { c: 'EU', lat: 51.5, lon: -0.13 },     // 伦敦
    { c: 'EU', lat: 48.86, lon: 2.35 },     // 巴黎
    { c: 'EU', lat: 52.52, lon: 13.4 },     // 柏林
    { c: 'EU', lat: 59.33, lon: 18.07 },    // 斯德哥尔摩
    { c: 'EU', lat: 40.42, lon: -3.7 },     // 马德里
    { c: 'AF', lat: 30.04, lon: 31.24 },    // 开罗
    { c: 'AF', lat: 6.52, lon: 3.38 },      // 拉各斯
    { c: 'AF', lat: -1.29, lon: 36.82 },    // 内罗毕
    { c: 'AF', lat: -26.2, lon: 28.05 },    // 约翰内斯堡
    { c: 'AF', lat: -33.92, lon: 18.42 },   // 开普敦
    { c: 'AS', lat: 39.9, lon: 116.4 },     // 北京
    { c: 'AS', lat: 31.23, lon: 121.47 },   // 上海
    { c: 'AS', lat: 22.54, lon: 114.06 },   // 深圳
    { c: 'AS', lat: 35.68, lon: 139.69 },   // 东京
    { c: 'AS', lat: 1.35, lon: 103.82 },    // 新加坡
    { c: 'AS', lat: 12.97, lon: 77.59 },    // 班加罗尔
    { c: 'AS', lat: 19.08, lon: 72.88 },    // 孟买
    { c: 'AS', lat: 37.57, lon: 126.98 },   // 首尔
    { c: 'AS', lat: 25.2, lon: 55.27 },     // 迪拜
    { c: 'AS', lat: -6.2, lon: 106.85 },    // 雅加达
    { c: 'OC', lat: -33.87, lon: 151.21 },  // 悉尼
    { c: 'OC', lat: -37.81, lon: 144.96 },  // 墨尔本
    { c: 'OC', lat: -36.85, lon: 174.76 }   // 奥克兰
  ];

  function latLonToVec3(lat, lon, r) {
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }
  function makeCurve(a, b) {
    var mid = a.clone().add(b).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(EARTH_R + 0.22 + a.distanceTo(b) * 0.26);
    return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
  }
  function buildNetwork(extraArcs) {
    var grp = new THREE.Group();
    var pts = HUBS.map(function (h) { return latLonToVec3(h.lat, h.lon, EARTH_R * 1.012); });

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
    function pairKey(a, b) { return a < b ? a + '_' + b : b + '_' + a; }
    function pickOther(i) {
      for (var tries = 0; tries < 60; tries++) {
        var j = (Math.random() * HUBS.length) | 0;
        if (j !== i && HUBS[j].c !== HUBS[i].c && !used[pairKey(i, j)]) return j;
      }
      return -1;
    }
    var curves = [];
    function link(i, j) { used[pairKey(i, j)] = 1; curves.push(makeCurve(pts[i], pts[j])); }

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
      var ps = cv.getPoints(30);
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

    var soft = isSoftwareRenderer();
    build(soft ? 420 : 1000, soft ? 5 : 16);
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
