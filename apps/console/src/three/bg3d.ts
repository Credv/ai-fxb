/* AI 窗口 · 3D 科幻控制台背景(轻量 WebGL)
 * 设计约束:本机常见为软件渲染(Microsoft Basic Render Driver / SwiftShader),无独显。
 * 因此背景必须极轻:pixelRatio 锁 1、少量图元、内置 FPS 看门狗自动降级、页面隐藏即暂停。
 * three 走 npm 依赖 + 动态 import:它是 256KB(gzip)的装饰层,不进首屏关键路径,
 * 不与正文数据抢带宽(国内到边缘节点一次往返就是 1~8 秒)。
 * 地球贴图:纯程序化用 canvas 绘制(海洋渐变 + 大洲轮廓 + 经纬网 + 极冰),不加载任何外部图片。
 */
import type * as THREE from 'three';
import { CONTINENTS, landHubs } from './earth-data';
import { setThreeFlag, threeEnabledByFlag } from '../lib/settings';

const EARTH_R = 1.6;

export interface Bg3d {
  // persist=false 用于「临时暂停」(蛛网页):不该把用户的开关写成关闭
  setEnabled(on: boolean, persist?: boolean): void;
  isDegraded(): boolean;
  destroy(): void;
}

let current: Bg3d | null = null;
let paused = false;
let pausedWasOn = true;

export function getBg3d(): Bg3d | null { return current; }

// 蛛网页要独占算力:进页时暂停背景,离开时按用户原本的开关还原
export function setBgPaused(pause: boolean): void {
  if (pause) {
    if (paused || !current) return;
    pausedWasOn = threeEnabledByFlag();
    current.setEnabled(false, false);
    paused = true;
  } else if (paused) {
    paused = false;
    current?.setEnabled(pausedWasOn, false);
  }
}

export function mountBg3d(canvas: HTMLCanvasElement): Bg3d {
  const bg = createBg3d(canvas);
  current = bg;
  return bg;
}

interface Packet { sprite: import('three').Sprite; curve: Curve; t: number; sp: number }
interface Curve { segs: number; getPoint(t: number): import('three').Vector3; getPoints(n: number): import('three').Vector3[] }

function createBg3d(canvas: HTMLCanvasElement): Bg3d {
  let THREE_: typeof THREE | null = null;
  let wantOn = threeEnabledByFlag();
  let earthPos: import('three').Vector3 | null = null;
  let renderer: import('three').WebGLRenderer | null = null;
  let scene: import('three').Scene | null = null;
  let camera: import('three').PerspectiveCamera | null = null;
  let dotTex: import('three').Texture | null = null;
  let earth: import('three').Group, earthWire: import('three').Mesh, net: import('three').Group;
  let halo: import('three').Mesh, stars: import('three').Points, stars2: import('three').Points;
  let grid: import('three').GridHelper, ring: import('three').Mesh, ring2: import('three').Mesh, ring3: import('three').Mesh;
  let glow: import('three').Sprite;
  const packets: Packet[] = [];
  let raf = 0, running = false, degraded = false, dead = false, booted = false, bootedOnce = false, disposed = false;

  if (!wantOn) canvas.style.display = 'none';

  function isSoftwareRenderer(): boolean {
    try {
      const gl = renderer!.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      return /basic render|swiftshader|llvmpipe|software|mesa off/i.test(name);
    } catch { return false; }
  }

  function makeGlowTexture(): import('three').CanvasTexture {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(140,190,255,0.95)');
    grad.addColorStop(0.28, 'rgba(90,120,255,0.4)');
    grad.addColorStop(0.65, 'rgba(124,58,237,0.14)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE_!.CanvasTexture(c);
  }

  // 圆形柔边点精灵:星点与节点共用,避免默认方形点被放大成色块
  function makeDotTexture(): import('three').CanvasTexture {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    return new THREE_!.CanvasTexture(c);
  }

  // 远景星域:半径很大的球壳 + sizeAttenuation:false,保证永远是细碎小点,不会飘成大块
  function makeStars(count: number, color: number, px: number, opacity: number): import('three').Points {
    const g = new THREE_!.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 30 + Math.random() * 55;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    g.setAttribute('position', new THREE_!.BufferAttribute(pos, 3));
    return new THREE_!.Points(g, new THREE_!.PointsMaterial({
      color, size: px, sizeAttenuation: false, map: dotTex!,
      transparent: true, opacity, depthWrite: false, blending: THREE_!.AdditiveBlending
    }));
  }

  function makeRing(inner: number, outer: number, color: number, opacity: number, tiltX: number, tiltY?: number): import('three').Mesh {
    const mesh = new THREE_!.Mesh(
      new THREE_!.RingGeometry(inner, outer, 72),
      new THREE_!.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE_!.DoubleSide })
    );
    mesh.rotation.x = tiltX; mesh.rotation.y = tiltY || 0;
    return mesh;
  }

  // ---- 程序化地球贴图(等距圆柱投影 512x256),轮廓数据见 earth-data.ts ----
  function makeEarthTexture(): import('three').CanvasTexture {
    const w = 512, h = 256;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d')!;

    const ocean = g.createLinearGradient(0, 0, 0, h);
    ocean.addColorStop(0, '#0a2a52');
    ocean.addColorStop(0.5, '#061a38');
    ocean.addColorStop(1, '#04101f');
    g.fillStyle = ocean; g.fillRect(0, 0, w, h);

    g.strokeStyle = 'rgba(56,189,248,0.10)'; g.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = (lon + 180) / 360 * w;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = (90 - lat) / 180 * h;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }

    const land = g.createLinearGradient(0, 0, 0, h);
    land.addColorStop(0, '#0c3a4a');
    land.addColorStop(0.5, '#0a2b3a');
    land.addColorStop(1, '#0c3a4a');
    g.lineWidth = 1.6;
    for (let i = 0; i < CONTINENTS.length; i++) {
      const poly = CONTINENTS[i];
      g.beginPath();
      for (let j = 0; j < poly.length; j++) {
        const px = (poly[j][0] + 180) / 360 * w;
        const py = (90 - poly[j][1]) / 180 * h;
        if (j === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = land; g.fill();
      g.strokeStyle = 'rgba(125,240,255,0.95)'; g.stroke();
    }

    g.fillStyle = 'rgba(180,220,250,0.5)';
    g.fillRect(0, 0, w, (90 - 78) / 180 * h);
    g.fillRect(0, (90 + 70) / 180 * h, w, h);

    const tex = new THREE_!.CanvasTexture(c);
    tex.anisotropy = 1;
    return tex;
  }

  // ---- 情报网络层:大洲枢纽节点 + 跨大洲链路 + 流动数据包 ----
  // 节点用真实城市定位,链路强制连接不同大洲,且每个枢纽至少有一条链路,避免"亮着却不传输"的点
  // landHubs() 已保证每个落点都在大洲轮廓内(与贴图同一份数据),不会有点悬在海面上
  const HUBS = landHubs();
  HUBS.forEach((h, i) => {
    if (h.snapped) console.warn('[bg3d] 枢纽 #' + i + '(' + h.c + ')不在陆地上,已吸附到最近陆地,偏移 ' + h.dist.toFixed(1) + '°');
    if (h.failed) console.warn('[bg3d] 枢纽 #' + i + '(' + h.c + ')附近找不到陆地');
  });

  // 节点与弧线都贴在 SURF 上:高于球面与 1.006 的全息线框壳。point/sprite 的片元深度取中心深度,
  // 中心离球面 0.048 > 点精灵半径 0.0375,所以正面半球的节点整颗可见,不会半埋或像从地里发光
  const SURF = EARTH_R * 1.03;

  function latLonToVec3(lat: number, lon: number, r: number): import('three').Vector3 {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE_!.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  // 弧线沿两点所在的大圆做球面插值,半径 = SURF + sin(pi*t)*lift;sin 在 [0,1] 非负,
  // 所以整条弧线恒在球面之外。只抬高控制点的二次贝塞尔做不到:长弦的中段会落进球体,看着像断线/在地球内部通信
  function makeArc(a: import('three').Vector3, b: import('three').Vector3): Curve {
    const u = a.clone().normalize(), v = b.clone().normalize();
    const ang = Math.acos(THREE_!.MathUtils.clamp(u.dot(v), -1, 1));
    const axis = new THREE_!.Vector3().crossVectors(u, v);
    if (axis.lengthSq() < 1e-4) {            // 近似对跖:叉积退化,取任一与 u 垂直的轴
      const ref = Math.abs(u.x) < 0.5 ? new THREE_!.Vector3(1, 0, 0) : new THREE_!.Vector3(0, 1, 0);
      axis.crossVectors(u, ref).normalize();
    } else axis.normalize();
    const lift = 0.05 + ang * 0.22, q = new THREE_!.Quaternion();
    function at(t: number): import('three').Vector3 {
      q.setFromAxisAngle(axis, ang * t);
      return u.clone().applyQuaternion(q).multiplyScalar(SURF + Math.sin(Math.PI * t) * lift);
    }
    return {
      segs: Math.min(48, Math.max(14, Math.round(ang / 0.055))),
      getPoint: at,
      getPoints(n: number) {
        const out: import('three').Vector3[] = [];
        for (let i = 0; i <= n; i++) out.push(at(i / n));
        return out;
      }
    };
  }

  function buildNetwork(extraArcs: number): import('three').Group {
    const grp = new THREE_!.Group();
    const pts = HUBS.map((h) => latLonToVec3(h.lat, h.lon, SURF));

    const ng = new THREE_!.BufferGeometry();
    const np = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) { np[i * 3] = pts[i].x; np[i * 3 + 1] = pts[i].y; np[i * 3 + 2] = pts[i].z; }
    ng.setAttribute('position', new THREE_!.BufferAttribute(np, 3));
    const nodes = new THREE_!.Points(ng, new THREE_!.PointsMaterial({
      color: 0xa5f3fc, size: 0.075, sizeAttenuation: true, map: dotTex!,
      transparent: true, opacity: 0.95, depthWrite: false, blending: THREE_!.AdditiveBlending
    }));
    grp.add(nodes);

    const used: Record<string, number> = {};
    const dirs = pts.map((p) => p.clone().normalize());
    const pairKey = (a: number, b: number) => (a < b ? a + '_' + b : b + '_' + a);
    // 仍要求跨大洲,但在候选里挑球面距离最近的:近似对跖的超长弧大半程在地球背面,看着像断掉
    function pickOther(i: number): number {
      let best = -1, bestAng = Infinity;
      for (let tries = 0; tries < 12; tries++) {
        const j = (Math.random() * HUBS.length) | 0;
        if (j === i || HUBS[j].c === HUBS[i].c || used[pairKey(i, j)]) continue;
        const ang = Math.acos(THREE_!.MathUtils.clamp(dirs[i].dot(dirs[j]), -1, 1));
        if (ang < bestAng) { bestAng = ang; best = j; }
      }
      return best;
    }
    const curves: Curve[] = [];
    function link(i: number, j: number): void { used[pairKey(i, j)] = 1; curves.push(makeArc(pts[i], pts[j])); }

    // 1) 每个枢纽先各连一条跨大洲链路 —— 保证没有"闲置光点"
    const order = pts.map((_, idx) => idx).sort(() => Math.random() - 0.5);
    order.forEach((i) => { const j = pickOther(i); if (j >= 0) link(i, j); });
    // 2) 再补充若干跨大洲链路,让网络更密
    for (let k = 0; k < extraArcs; k++) {
      const a = (Math.random() * HUBS.length) | 0, b = pickOther(a);
      if (b >= 0) link(a, b);
    }

    // 所有弧线合并进一个 LineSegments,省掉大量 draw call
    const seg: number[] = [];
    curves.forEach((cv) => {
      const ps = cv.getPoints(cv.segs);
      for (let s = 0; s < ps.length - 1; s++) seg.push(ps[s].x, ps[s].y, ps[s].z, ps[s + 1].x, ps[s + 1].y, ps[s + 1].z);
    });
    const lg = new THREE_!.BufferGeometry();
    lg.setAttribute('position', new THREE_!.Float32BufferAttribute(seg, 3));
    grp.add(new THREE_!.LineSegments(lg, new THREE_!.LineBasicMaterial({
      color: 0x67e8f9, transparent: true, opacity: 0.3, blending: THREE_!.AdditiveBlending, depthWrite: false
    })));

    curves.forEach((cv) => {
      const pk = new THREE_!.Sprite(new THREE_!.SpriteMaterial({
        map: dotTex!, color: 0xd9fbff, transparent: true, opacity: 0.95, blending: THREE_!.AdditiveBlending, depthWrite: false
      }));
      pk.scale.set(0.085, 0.085, 1);
      packets.push({ sprite: pk, curve: cv, t: Math.random(), sp: 0.14 + Math.random() * 0.2 });
      grp.add(pk);
    });
    return grp;
  }

  function build(starCount: number, extraArcs: number): void {
    scene = new THREE_!.Scene();
    scene.fog = new THREE_!.FogExp2(0x05070f, 0.02);
    camera = new THREE_!.PerspectiveCamera(60, 1, 0.1, 140);
    camera.position.set(0, 0.7, 6.5);

    stars = makeStars(starCount, 0x9fe9ff, 2, 0.85);
    stars2 = makeStars(Math.floor(starCount * 0.45), 0xb9a4ff, 2.8, 0.5);
    scene.add(stars); scene.add(stars2);

    grid = new THREE_!.GridHelper(44, 26, 0x1d4ed8, 0x112233);
    grid.material.transparent = true;
    grid.material.opacity = 0.14;
    grid.position.y = -2.4;
    scene.add(grid);

    // 地球本体(无光照贴图,软件渲染也稳定)+ 全息线框壳
    earth = new THREE_!.Group();
    earth.add(new THREE_!.Mesh(
      new THREE_!.SphereGeometry(EARTH_R, 48, 32),
      new THREE_!.MeshBasicMaterial({ map: makeEarthTexture() })
    ));
    earthWire = new THREE_!.Mesh(
      new THREE_!.SphereGeometry(EARTH_R * 1.006, 28, 20),
      new THREE_!.MeshBasicMaterial({ color: 0x67e8f9, wireframe: true, transparent: true, opacity: 0.11, depthWrite: false })
    );
    earth.add(earthWire);
    earth.position.copy(earthPos!);
    earth.rotation.z = -0.41;
    scene.add(earth);

    // 情报网络挂在地球上,一起自转;弧线/节点被球体遮挡,只显正面
    net = buildNetwork(extraArcs);
    earth.add(net);

    // 外层全息壳:缓慢反向自转,增加纵深
    halo = new THREE_!.Mesh(
      new THREE_!.SphereGeometry(EARTH_R * 1.7, 18, 12),
      new THREE_!.MeshBasicMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.06, depthWrite: false })
    );
    halo.position.copy(earthPos!);
    scene.add(halo);

    glow = new THREE_!.Sprite(new THREE_!.SpriteMaterial({ map: makeGlowTexture(), color: 0x6fa8ff, transparent: true, opacity: 0.62, blending: THREE_!.AdditiveBlending, depthWrite: false }));
    glow.scale.set(6.4, 6.4, 1);
    glow.position.copy(earthPos!);
    scene.add(glow);

    ring = makeRing(2.3, 2.36, 0xa78bfa, 0.3, Math.PI / 2.4);
    ring2 = makeRing(3.0, 3.05, 0x38bdf8, 0.22, Math.PI / 2.1, 0.4);
    ring3 = makeRing(2.0, 2.04, 0x67e8f9, 0.28, Math.PI / 1.7, -0.5);
    ring.position.copy(earthPos!); ring2.position.copy(earthPos!); ring3.position.copy(earthPos!);
    scene.add(ring); scene.add(ring2); scene.add(ring3);
  }

  function resize(): void {
    const W = window.innerWidth, H = window.innerHeight;
    renderer!.setSize(W, H, false);
    camera!.aspect = W / H; camera!.updateProjectionMatrix();
  }

  let t0 = 0, last = 0;
  function frame(now: number): void {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000) || 0.016;
    last = now;

    stars.rotation.y = t * 0.012;
    stars2.rotation.y = -t * 0.008;
    earth.rotation.y = t * 0.085;
    halo.rotation.y = -t * 0.05;
    halo.rotation.x = Math.sin(t * 0.07) * 0.15;
    ring.rotation.z = t * 0.05;
    ring2.rotation.z = -t * 0.07;
    ring3.rotation.z = t * 0.09;
    for (let i = 0; i < packets.length; i++) {
      const p = packets[i];
      p.t += dt * p.sp;
      if (p.t > 1) p.t -= 1;
      p.sprite.position.copy(p.curve.getPoint(p.t));
      p.sprite.material.opacity = 0.35 + Math.sin(p.t * Math.PI) * 0.6;
    }
    glow.material.opacity = 0.55 + Math.sin(t * 0.8) * 0.1;
    camera!.position.x = Math.sin(t * 0.08) * 0.5;
    camera!.position.y = 0.7 + Math.sin(t * 0.05) * 0.12;
    camera!.lookAt(earthPos!);
    renderer!.render(scene!, camera!);
    watchdog(now);
  }

  let frames = 0, watchStart = 0, watched = false;
  function watchdog(now: number): void {
    if (watched) return;
    if (!watchStart) { watchStart = now; return; }
    frames++;
    const dur = now - watchStart;
    if (dur >= 2500) {
      watched = true;
      const fps = frames / (dur / 1000);
      if (fps < 12) kill();
      else if (fps < 24 && !degraded) degrade();
    }
  }

  function degrade(): void {
    degraded = true;
    stop();
    [stars, stars2].forEach((s) => {
      if (s) s.geometry.setDrawRange(0, Math.floor(s.geometry.attributes.position.count / 2));
    });
    for (let i = 0; i < packets.length; i++) packets[i].sprite.position.copy(packets[i].curve.getPoint(0.5));
    camera!.position.set(0, 0.7, 6.5);
    camera!.lookAt(earthPos!);
    renderer!.render(scene!, camera!);
  }

  function kill(): void {
    dead = true; stop();
    canvas.style.display = 'none';
  }

  function start(): void {
    if (running || dead || degraded) return;
    running = true;
    const n = performance.now(); t0 = n; last = n;
    raf = requestAnimationFrame(frame);
  }
  function stop(): void {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function onResize(): void {
    resize();
    if (degraded) renderer!.render(scene!, camera!);
  }
  function onVisibility(): void {
    if (document.hidden) stop(); else if (!degraded && !dead && wantOn) start();
  }

  function init(): void {
    renderer = new THREE_!.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'default' });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    dotTex = makeDotTexture();

    // 手机/平板 GPU 弱:按低配构建(星点与数据链路减半),帧率看门狗仍然兜底
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
    const light = coarse || window.innerWidth < 700 || isSoftwareRenderer();
    build(light ? 380 : 1000, light ? 6 : 16);
    resize();
    if (isSoftwareRenderer()) { degrade(); return; }

    start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
  }

  function boot(): void {
    if (disposed || bootedOnce) return;
    bootedOnce = true;
    import('three').then((m) => {
      if (disposed || THREE_ || !wantOn) return;
      THREE_ = m;
      earthPos = new m.Vector3(0, 0.3, -2.5);
      try { init(); booted = true; } catch (e) {
        console.warn('[bg3d] init failed:', (e as Error)?.message, e);
        canvas.style.display = 'none';
      }
    }, (e) => {
      // 背景库没下来也不影响正文:留 CSS 底,静默降级
      bootedOnce = false;
      console.warn('[bg3d] three.js 载入失败,3D 背景不启用:', (e as Error)?.message);
      canvas.style.display = 'none';
    });
  }

  function scheduleBoot(): void {
    if (typeof window.requestIdleCallback === 'function') requestIdleCallback(() => { if (!disposed && wantOn) boot(); }, { timeout: 5000 });
    else setTimeout(() => { if (!disposed && wantOn) boot(); }, 1500);
  }

  // 首屏不抢带宽:正文与快照先落地,页面 load 后再把 three.js(270KB gzip)排进空闲队列
  const onLoad = () => scheduleBoot();
  if (document.readyState === 'complete') scheduleBoot();
  else window.addEventListener('load', onLoad, { once: true });

  return {
    setEnabled(on, persist = true) {
      if (persist) setThreeFlag(on);
      wantOn = on;
      if (!THREE_) { if (on) { canvas.style.display = ''; scheduleBoot(); } return; }  // 还没加载:要开就现在开,要关则本来就没跑
      if (!booted) { canvas.style.display = on ? '' : 'none'; return; }
      if (on) {
        canvas.style.display = '';
        if (!dead && !degraded) start(); else if (!dead) renderer!.render(scene!, camera!);
      } else { stop(); canvas.style.display = 'none'; }
    },
    isDegraded() { return degraded || dead; },
    destroy() {
      disposed = true;
      stop();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('load', onLoad);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer?.dispose();
      if (current === this) current = null;
    }
  };
}
