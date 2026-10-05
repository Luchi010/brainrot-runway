'use strict';
// 3D空間（Three.js r128）: ランウェイ・ゲート・歩いてくるキャラ・所持キャラ展示
const World3D = (() => {
  const host = document.getElementById('game-container');
  const GATE_Z = -34, END_Z = 6.5, SPEED = 5; // 約7秒でゲート→手前まで歩く
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const cv = renderer.domElement;
  cv.id = 'scene3d';
  host.insertBefore(cv, host.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090914);
  scene.fog = new THREE.Fog(0x090914, 16, 50);
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  cam.position.set(0, 4.3, 9.5);
  cam.lookAt(0, 1.5, -9);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x332244, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(3, 10, 6);
  scene.add(sun);

  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o || {}));
  const box = (w, h, d, m, x, y, z) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    scene.add(o);
    return o;
  };
  const neonMats = [];
  const neon = (c) => { const m = mat(c, { emissive: c, emissiveIntensity: 1 }); neonMats.push(m); return m; };

  // 床・赤いカーペット・金のフチ・ネオンライン
  box(14, 0.2, 64, mat(0x15151f), 0, -0.12, -20);
  box(5, 0.22, 64, mat(0xd32f2f), 0, -0.1, -20);
  [-1, 1].forEach(s => {
    box(0.2, 0.28, 64, mat(0xffc107, { metalness: 0.6, roughness: 0.3 }), s * 2.6, -0.05, -20);
    box(0.08, 0.3, 64, neon(s < 0 ? 0x00e5ff : 0xff2bd6), s * 2.8, -0.04, -20);
  });
  // 壁と柱（灰色の壁にネオン）
  [-1, 1].forEach(s => {
    box(0.6, 6, 64, mat(0x9e9e9e), s * 3.5, 3, -20);
    for (let z = -32; z <= 4; z += 6) {
      box(0.3, 6.4, 0.3, mat(0x616161), s * 3.3, 3.2, z);
      box(0.2, 0.2, 0.2, neon(s < 0 ? 0x00e5ff : 0xff2bd6), s * 3.3, 6.5, z);
    }
  });
  // ゲート（奥の壁）
  box(7, 7, 1, mat(0x757575), 0, 3.5, GATE_Z - 3);
  box(2.8, 3.4, 0.6, mat(0x000000), 0, 1.7, GATE_Z - 2.5);
  box(3.2, 0.25, 0.7, neon(0xffeb3b), 0, 3.5, GATE_Z - 2.5);
  [-1, 1].forEach(s => box(0.25, 3.4, 0.7, neon(0xffeb3b), s * 1.5, 1.7, GATE_Z - 2.5));
  const gateTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const x = c.getContext('2d'); x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#ffeb3b'; x.shadowBlur = 18; x.fillStyle = '#ffeb3b'; x.fillText('GATE', 128, 50);
    return new THREE.CanvasTexture(c);
  })();
  const gate = new THREE.Sprite(new THREE.SpriteMaterial({ map: gateTex, transparent: true }));
  gate.scale.set(3, 1.1, 1); gate.position.set(0, 4.3, GATE_Z - 1.8);
  scene.add(gate);

  // ふわふわ漂う光の粒
  const PN = 70, ppos = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) { ppos[i * 3] = (Math.random() - 0.5) * 6; ppos[i * 3 + 1] = Math.random() * 5; ppos[i * 3 + 2] = -36 + Math.random() * 44; }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  scene.add(new THREE.Points(pgeo, new THREE.PointsMaterial({ color: 0x66ffff, size: 0.09, transparent: true, opacity: 0.8 })));

  // ---- キャラ（画像を重ねた厚みのある板 / 画像なしは球体） ----
  const loader = new THREE.TextureLoader();
  const texCache = {};
  const toColor = (c) => { try { return new THREE.Color(c); } catch (e) { return new THREE.Color(0xffffff); } };

  function labelSprite(name, nameColor, sub) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 144;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.85)'; x.strokeStyle = '#fff'; x.lineWidth = 5;
    x.beginPath(); x.rect(4, 4, 504, 136); x.fill(); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 46px sans-serif'; x.fillStyle = nameColor; x.fillText(name, 256, 48, 480);
    x.font = 'bold 36px sans-serif'; x.fillStyle = '#fff'; x.fillText(sub, 256, 100, 480);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    s.scale.set(3.6, 1.01, 1);
    return s;
  }

  function buildFigure(o, withLabel) {
    const g = new THREE.Group();
    const tint = toColor('#ffffff').lerp(toColor(o.color), o.color === '#fff' || o.color === '#ffffff' ? 0 : 0.45);
    const glow = toColor(o.color);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.18, 28), mat(0x222233, { emissive: glow, emissiveIntensity: 0.55 }));
    ped.position.y = 0.09; g.add(ped);
    const body = new THREE.Group(); body.position.y = 0.2; g.add(body);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 18), mat(glow, { emissive: glow, emissiveIntensity: 0.25 }));
    ball.position.y = 0.95; body.add(ball);
    if (o.imgSrc) {
      const apply = (tex) => {
        if (!tex.image) return;
        body.remove(ball);
        const h = 2.4, w = Math.min(3.2, h * tex.image.width / tex.image.height);
        for (let k = 0; k < 6; k++) { // 後ろの層ほど暗くして厚みを出す
          const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: k < 5 ? new THREE.Color(0x444455) : tint });
          const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
          p.position.set(0, h / 2, -0.07 * (5 - k)); body.add(p);
        }
      };
      if (texCache[o.imgSrc]) { if (texCache[o.imgSrc].image) apply(texCache[o.imgSrc]); }
      else texCache[o.imgSrc] = loader.load(o.imgSrc, apply, undefined, () => {});
    }
    if (withLabel) { const s = labelSprite(o.name, o.rarityColor, o.sub); s.position.y = 3.5; g.add(s); }
    g.userData = { ped, body, glow, rainbow: !!o.rainbow };
    return g;
  }

  // ---- 歩いてくるキャラ ----
  const runners = [];
  function addRunner(o) {
    const fig = buildFigure(o, true);
    const root = new THREE.Group(); root.add(fig);
    root.position.set(0, 0, GATE_Z); root.scale.setScalar(0.8);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4.2, 1.5), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 2; root.add(hit);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.18), new THREE.MeshBasicMaterial({ color: 0x00e676 }));
    bar.position.set(0, 4.3, 0); bar.visible = false; root.add(bar);
    scene.add(root);
    const ent = { root, fig, hit, bar, spawn: o.spawnTime, seed: Math.random() * 6, holdAt: 0, dying: 0, onDown: null, onUp: null };
    ent.setHolding = (on) => { ent.holdAt = on ? performance.now() : 0; bar.visible = on; };
    ent.remove = () => { ent.dying = performance.now(); ent.setHolding(false); };
    runners.push(ent);
    return ent;
  }
  function disposeEnt(e) { scene.remove(e.root); }
  function clearRunners() { runners.splice(0).forEach(disposeEnt); }

  // ---- 所持キャラの展示（壁際の台座） ----
  let displays = [];
  function setStocks(stocks) {
    displays.forEach(d => scene.remove(d)); displays = [];
    stocks.forEach((s, i) => {
      if (!s) return;
      const src = s.char.runtimeImage || s.char.image;
      const f = buildFigure({ imgSrc: src, color: s.mutation.color || '#fff', rainbow: /rainbow/.test(s.mutation.cssClass || '') }, false);
      f.scale.setScalar(0.45);
      f.position.set((i % 2 ? 1 : -1) * 2.65, 0, -1.5 - Math.floor(i / 2) * 3.2);
      scene.add(f); displays.push(f);
    });
  }

  // ---- タッチ操作（キャラを長押しで購入） ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pressed = null, lastEv = null;
  function pick(e) {
    const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(runners.map(r => r.hit))[0];
    return h ? runners.find(r => r.hit === h.object) : null;
  }
  function release() { if (pressed) { const p = pressed; pressed = null; p.onUp && p.onUp(); } }
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); lastEv = e; const t = pick(e); if (t && !t.dying && t.onDown) { pressed = t; t.onDown(); } });
  cv.addEventListener('pointermove', (e) => { lastEv = e; if (pressed && pick(e) !== pressed) release(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => cv.addEventListener(n, release));

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cv.style.width = '100%'; cv.style.height = '100%';
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  let lastT = performance.now();
  function update(now) {
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    const t = now / 1000;
    neonMats.forEach((m, i) => { m.emissiveIntensity = 0.7 + 0.5 * Math.sin(t * 3 + i); });
    const pa = pgeo.attributes.position;
    for (let i = 0; i < PN; i++) { let y = pa.getY(i) + dt * 0.35; if (y > 5.5) y = 0; pa.setY(i, y); }
    pa.needsUpdate = true;

    if (pressed && lastEv && pick(lastEv) !== pressed) release();
    for (let i = runners.length - 1; i >= 0; i--) {
      const e = runners[i];
      if (e.dying) { // 購入演出：ふくらんで消える
        const k = (now - e.dying) / 220;
        if (k >= 1) { disposeEnt(e); runners.splice(i, 1); continue; }
        e.root.scale.setScalar(0.8 * (1 + k * 0.6)); continue;
      }
      const z = GATE_Z + SPEED * (now - e.spawn) / 1000;
      if (z > END_Z) { disposeEnt(e); runners.splice(i, 1); if (pressed === e) release(); continue; }
      e.root.position.z = z;
      e.fig.position.y = Math.abs(Math.sin(t * 5 + e.seed)) * 0.15; // 歩くバウンド
      e.fig.rotation.y = Math.sin(t * 1.8 + e.seed) * 0.35;
      if (e.holdAt) {
        const p = Math.min(1, (now - e.holdAt) / 1000);
        e.bar.scale.x = Math.max(0.001, p); e.bar.position.x = -1.2 * (1 - p);
        e.root.scale.setScalar(0.8 * (1 + 0.06 * Math.sin(t * 25)));
      } else e.root.scale.setScalar(0.8);
    }
    const hue = (t * 0.25) % 1;
    const spin = (f, i) => {
      f.userData.body.rotation.y = Math.sin(t * 1.5 + i) * 0.3;
      if (f.userData.rainbow) f.userData.ped.material.emissive.setHSL(hue, 1, 0.5);
    };
    runners.forEach((e, i) => { if (!e.dying) { const u = e.fig.userData; if (u.rainbow) u.ped.material.emissive.setHSL(hue, 1, 0.5); } });
    displays.forEach(spin);
    renderer.render(scene, cam);
  }

  return { update, addRunner, clearRunners, setStocks, resize };
})();
