'use strict';
// 3D空間（Three.js r128）: 広いランウェイ部屋 / Roblox風プレイヤー / 自由移動 + 視点操作 / 近づいて長押し購入
const World3D = (() => {
  const host = document.getElementById('game-container');
  const GATE_Z = -34, END_Z = 12, SPEED = 3;       // キャラの歩行（約15秒でゲート→手前）
  const HALF_W = 12, Z_BACK = -37, Z_FRONT = 24;   // 部屋のサイズ
  const RANGE = 4.5;                               // 購入できる距離
  const MOVE_SPEED = 7, JUMP_V = 9.5, GRAVITY = 26;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const cv = renderer.domElement;
  cv.id = 'scene3d';
  host.insertBefore(cv, host.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090914);
  scene.fog = new THREE.Fog(0x090914, 30, 85);
  const cam = new THREE.PerspectiveCamera(65, 1, 0.1, 150);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x332244, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(6, 14, 8);
  scene.add(sun);

  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o || {}));
  const box = (w, h, d, m, x, y, z, parent) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    (parent || scene).add(o);
    return o;
  };
  const neonMats = [];
  const neon = (c) => { const m = mat(c, { emissive: c, emissiveIntensity: 1 }); neonMats.push(m); return m; };

  // ---- 部屋 ----
  const LEN = Z_FRONT - Z_BACK, CZ = (Z_FRONT + Z_BACK) / 2;
  const floorTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#1c1c2c'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#14141f'; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(HALF_W * 2 / 4, LEN / 4);
    return t;
  })();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, LEN), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, CZ); scene.add(floor);
  box(6, 0.06, LEN, mat(0xd32f2f), 0, 0.03, CZ);                        // 赤いカーペット
  [-1, 1].forEach(s => {
    box(0.2, 0.1, LEN, mat(0xffc107, { metalness: 0.6, roughness: 0.3 }), s * 3.1, 0.05, CZ);
    box(0.08, 0.12, LEN, neon(s < 0 ? 0x00e5ff : 0xff2bd6), s * 3.35, 0.06, CZ);
    box(0.6, 7, LEN, mat(0x9e9e9e), s * (HALF_W + 0.3), 3.5, CZ);       // 左右の壁
    for (let z = Z_BACK + 3; z <= Z_FRONT - 2; z += 6) {
      box(0.3, 7.2, 0.3, mat(0x616161), s * (HALF_W - 0.2), 3.6, z);
      box(0.22, 0.22, 0.22, neon(s < 0 ? 0x00e5ff : 0xff2bd6), s * (HALF_W - 0.2), 7.3, z);
    }
  });
  // 奥の壁とゲート／手前の壁
  box(HALF_W * 2 + 1.2, 8, 1, mat(0x757575), 0, 4, Z_BACK - 0.5);
  box(3.4, 4, 0.5, mat(0x000000), 0, 2, Z_BACK + 0.05);
  box(3.9, 0.25, 0.6, neon(0xffeb3b), 0, 4.1, Z_BACK + 0.1);
  [-1, 1].forEach(s => box(0.25, 4, 0.6, neon(0xffeb3b), s * 1.8, 2, Z_BACK + 0.1));
  box(HALF_W * 2 + 1.2, 8, 1, mat(0x555560), 0, 4, Z_FRONT + 0.5);

  function textSprite(text, color, sub, w, h) {
    const c = document.createElement('canvas'); c.width = 512; c.height = sub ? 144 : 84;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.85)'; x.strokeStyle = '#fff'; x.lineWidth = 5;
    x.beginPath(); x.rect(4, 4, 504, c.height - 8); x.fill(); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 46px sans-serif'; x.fillStyle = color; x.fillText(text, 256, sub ? 48 : 44, 480);
    if (sub) { x.font = 'bold 36px sans-serif'; x.fillStyle = '#fff'; x.fillText(sub, 256, 100, 480); }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.renderOrder = 10;
    s.scale.set(w || 3.6, h || (sub ? 1.01 : 0.6), 1);
    return s;
  }
  const gate = textSprite('GATE', '#ffeb3b', null, 3, 0.8);
  gate.position.set(0, 5.2, Z_BACK + 0.6); scene.add(gate);

  const PN = 110, ppos = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) { ppos[i * 3] = (Math.random() - 0.5) * 22; ppos[i * 3 + 1] = Math.random() * 6; ppos[i * 3 + 2] = Z_BACK + Math.random() * LEN; }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  scene.add(new THREE.Points(pgeo, new THREE.PointsMaterial({ color: 0x66ffff, size: 0.1, transparent: true, opacity: 0.8 })));

  // ---- Roblox風プレイヤー ----
  const lm = (c) => new THREE.MeshLambertMaterial({ color: c });
  const faceTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#f2c744'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#111';
    x.beginPath(); x.ellipse(44, 50, 8, 13, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(84, 50, 8, 13, 0, 0, 7); x.fill();
    x.lineWidth = 7; x.lineCap = 'round'; x.strokeStyle = '#111';
    x.beginPath(); x.arc(64, 66, 30, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
    return new THREE.CanvasTexture(c);
  })();
  const player = new THREE.Group();
  const avatar = new THREE.Group(); player.add(avatar);
  const skin = lm(0xf2c744), shirt = lm(0x1e88e5), pants = lm(0x43a047);
  box(1, 1, 0.5, shirt, 0, 1.5, 0, avatar);
  const headMats = [skin, skin, skin, skin, new THREE.MeshLambertMaterial({ map: faceTex }), skin];
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), headMats);
  head.position.set(0, 2.36, 0); avatar.add(head);
  const limb = (mt, px, py) => {
    const piv = new THREE.Group(); piv.position.set(px, py, 0); avatar.add(piv);
    box(0.5, 1, 0.5, mt, 0, -0.5, 0, piv);
    return piv;
  };
  const armL = limb(skin, -0.76, 2), armR = limb(skin, 0.76, 2);
  const legL = limb(pants, -0.25, 1), legR = limb(pants, 0.25, 1);
  player.scale.setScalar(1.15);
  player.position.set(0, 0, 12);
  avatar.rotation.y = Math.PI;
  scene.add(player);
  let nameSprite = null;
  function setName(n) {
    if (nameSprite) { player.remove(nameSprite); nameSprite.material.map.dispose(); }
    nameSprite = textSprite(n || 'ゲスト', '#ffeb3b', null, 2.6, 0.42);
    nameSprite.position.y = 3.35; player.add(nameSprite);
  }
  setName('ゲスト');

  // ---- キャラ（画像を重ねた厚みのある板 / 画像なしは球体） ----
  const loader = new THREE.TextureLoader();
  const texCache = {};
  const toColor = (c) => { try { return new THREE.Color(c); } catch (e) { return new THREE.Color(0xffffff); } };

  function buildFigure(o, withLabel) {
    const g = new THREE.Group();
    const white = o.color === '#fff' || o.color === '#ffffff';
    const tint = toColor('#ffffff').lerp(toColor(o.color), white ? 0 : 0.45);
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
        for (let k = 0; k < 6; k++) {
          const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: k < 5 ? new THREE.Color(0x444455) : tint });
          const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
          p.position.set(0, h / 2, -0.07 * (5 - k)); body.add(p);
        }
      };
      if (texCache[o.imgSrc]) { if (texCache[o.imgSrc].image) apply(texCache[o.imgSrc]); }
      else texCache[o.imgSrc] = loader.load(o.imgSrc, apply, undefined, () => {});
    }
    if (withLabel) { const s = textSprite(o.name, o.rarityColor || '#fff', o.sub); s.position.y = 3.5; g.add(s); }
    g.userData = { ped, body, rainbow: !!o.rainbow };
    return g;
  }

  // ---- 歩いてくるキャラ ----
  const runners = [];
  let hintShown = false;
  function addRunner(o) {
    const fig = buildFigure(o, true);
    const root = new THREE.Group(); root.add(fig);
    // キャラクターはランウェイ中央からまっすぐ手前へ進む
    root.position.set(0, 0, GATE_Z); root.scale.setScalar(0.8);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4.2, 1.5), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 2; root.add(hit);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.18), new THREE.MeshBasicMaterial({ color: 0x00e676, depthTest: false }));
    bar.position.set(0, 4.3, 0); bar.visible = false; bar.renderOrder = 11; root.add(bar);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.6, 40), new THREE.MeshBasicMaterial({ color: 0xffeb3b, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.visible = false; root.add(ring);
    scene.add(root);
    const ent = { root, fig, hit, bar, ring, name: o.name, spawn: o.spawnTime, seed: Math.random() * 6, holdAt: 0, dying: 0, onDown: null, onUp: null };
    ent.setHolding = (on) => { ent.holdAt = on ? performance.now() : 0; bar.visible = on; };
    ent.remove = () => { ent.dying = performance.now(); ent.setHolding(false); ring.visible = false; };
    runners.push(ent);
    if (!hintShown) { hintShown = true; toast('左をドラッグ:移動 / 右をドラッグ:視点\nキャラに近づいて「長押しで購入」', 6000); }
    return ent;
  }
  const disposeEnt = (e) => scene.remove(e.root);
  function clearRunners() { release(); runners.splice(0).forEach(disposeEnt); }

  // ---- 所持キャラの展示（左右のスペースに並べる） ----
  let displays = [];
  function setStocks(stocks) {
    displays.forEach(d => scene.remove(d)); displays = [];
    stocks.forEach((s, i) => {
      if (!s) return;
      const src = s.char.runtimeImage || s.char.image;
      const mn = s.mutation.name !== 'ノーマル' ? `[${s.mutation.name}]` : '';
      const f = buildFigure({
        imgSrc: src, color: s.mutation.color || '#fff', rainbow: /rainbow/.test(s.mutation.cssClass || ''),
        name: mn + s.char.name, sub: `+${Math.floor(s.char.income * s.mutation.mult)}/s`
      }, true);
      const left = i % 2 === 0;
      f.scale.setScalar(0.8);
      f.position.set(left ? -8.2 : 8.2, 0, 6 - Math.floor(i / 2) * 5.5);
      f.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
      scene.add(f); displays.push(f);
    });
  }

  // ---- HUD（ジョイスティック・ボタン・ヒント） ----
  const el = (css, html) => { const d = document.createElement('div'); d.style.cssText = css; if (html) d.innerHTML = html; host.appendChild(d); return d; };
  const joyBase = el('position:absolute;width:110px;height:110px;margin:-55px 0 0 -55px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.4);z-index:8;display:none;pointer-events:none');
  const joyKnob = el('position:absolute;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;background:rgba(255,255,255,.55);z-index:8;display:none;pointer-events:none');
  const btnCss = 'position:absolute;z-index:8;color:#fff;font-weight:bold;text-align:center;touch-action:none;user-select:none;-webkit-user-select:none;';
  const buyBtn = el(btnCss + 'display:none;');
  const jumpBtn = el(btnCss + 'right:14px;width:62px;height:62px;border-radius:50%;background:rgba(30,136,229,.35);border:2px solid rgba(255,255,255,.72);box-shadow:0 2px 10px rgba(0,0,0,.35);font-size:12px;display:flex;align-items:center;justify-content:center', 'ジャンプ');
  const toastEl = el('position:absolute;z-index:9;left:10px;top:14px;max-width:58%;padding:8px 12px;border-radius:8px;background:rgba(0,0,0,.8);border:2px solid #ffeb3b;color:#fff;font-size:12px;font-weight:bold;white-space:pre-line;display:none;pointer-events:none');
  const controlHint = el('position:absolute;z-index:7;left:10px;bottom:12px;max-width:68%;padding:6px 9px;border-radius:7px;background:rgba(0,0,0,.62);border:1px solid rgba(255,235,59,.75);color:#fff;font-size:10px;line-height:1.45;white-space:pre-line;pointer-events:none', 'PC: WASD / 矢印で移動・ドラッグで視点\nスマホ: 左ドラッグで移動・右ドラッグで視点');
  let toastTimer = 0;
  function toast(msg, ms) {
    toastEl.textContent = msg; toastEl.style.display = 'block';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, ms || 1800);
  }
  const panel = document.getElementById('bottom-panel');
  let lastBottom = -1;

  // ---- 入力 ----
  let yaw = 0, pitch = 0.35, camDist = 7.5, jumpReq = false;
  let joy = null, pressed = null;
  const looks = new Map();
  const keys = {};
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const inRange = (e) => Math.hypot(e.root.position.x - player.position.x, e.root.position.z - player.position.z) <= RANGE;
  function pick(e) {
    const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(runners.filter(r => !r.dying).map(r => r.hit))[0];
    return h ? runners.find(r => r.hit === h.object) : null;
  }
  function press(t) { if (!pressed && t && !t.dying && t.onDown) { pressed = t; t.onDown(); } }
  function release() { if (pressed) { const p = pressed; pressed = null; p.onUp && p.onUp(); } }
  cv.style.touchAction = 'none';
  const hostPos = (e) => { const r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r]; };

  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    const t = pick(e);
    if (t) {
      if (inRange(t)) { looks.set(e.pointerId, { role: 'hold' }); press(t); return; }
      toast('もっと近づいて長押しで購入！');
    }
    const [x, y, r] = hostPos(e);
    if (e.pointerType !== 'mouse' && x < r.width * 0.5 && !joy) {
      joy = { id: e.pointerId, ox: x, oy: y, x: 0, y: 0 };
      joyBase.style.cssText += `;display:block;left:${x}px;top:${y}px`;
      joyKnob.style.cssText += `;display:block;left:${x}px;top:${y}px`;
    } else {
      looks.set(e.pointerId, { role: 'look', lx: e.clientX, ly: e.clientY });
    }
  });
  cv.addEventListener('pointermove', (e) => {
    if (joy && joy.id === e.pointerId) {
      const [x, y] = hostPos(e);
      let dx = x - joy.ox, dy = y - joy.oy; const d = Math.hypot(dx, dy), R = 55;
      if (d > R) { dx *= R / d; dy *= R / d; }
      joy.x = dx / R; joy.y = dy / R;
      joyKnob.style.left = (joy.ox + dx) + 'px'; joyKnob.style.top = (joy.oy + dy) + 'px';
      return;
    }
    const l = looks.get(e.pointerId);
    if (l && l.role === 'look') {
      yaw -= (e.clientX - l.lx) * 0.006;
      pitch = Math.max(-0.05, Math.min(1.2, pitch + (e.clientY - l.ly) * 0.005));
      l.lx = e.clientX; l.ly = e.clientY;
    }
  });
  const up = (e) => {
    if (joy && joy.id === e.pointerId) { joy = null; joyBase.style.display = 'none'; joyKnob.style.display = 'none'; }
    const l = looks.get(e.pointerId);
    if (l) { if (l.role === 'hold') release(); looks.delete(e.pointerId); }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'mouse') up(e); });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    camDist = clamp(camDist + e.deltaY * 0.006, 5.2, 11);
  }, { passive: false });

  // 「長押しで購入」ボタン（一番近いキャラ）
  let nearest = null;
  buyBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); try { buyBtn.setPointerCapture(e.pointerId); } catch (_) {} press(nearest); });
  ['pointerup', 'pointercancel'].forEach(n => buyBtn.addEventListener(n, release));
  jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); jumpReq = true; });

  const typing = (e) => /INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || '');
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    const k = e.key.toLowerCase(); keys[k] = true;
    if (k === ' ') { jumpReq = true; e.preventDefault(); }
    if (k.startsWith('arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cv.style.width = '100%'; cv.style.height = '100%';
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  // ---- 更新 ----
  let lastT = performance.now(), phase = 0, vy = 0, faceRot = Math.PI, armUp = 0, nearestId = null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function update(now) {
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    const t = now / 1000;
    neonMats.forEach((m, i) => { m.emissiveIntensity = 0.7 + 0.5 * Math.sin(t * 3 + i); });
    const pa = pgeo.attributes.position;
    for (let i = 0; i < PN; i++) { let y = pa.getY(i) + dt * 0.35; if (y > 6.5) y = 0; pa.setY(i, y); }
    pa.needsUpdate = true;

    // プレイヤーの移動（カメラの向き基準）
    let ix = 0, iy = 0;
    if (joy) { ix = joy.x; iy = joy.y; }
    else {
      ix = ((keys['d'] || keys['arrowright']) ? 1 : 0) - ((keys['a'] || keys['arrowleft']) ? 1 : 0);
      iy = ((keys['s'] || keys['arrowdown']) ? 1 : 0) - ((keys['w'] || keys['arrowup']) ? 1 : 0);
    }
    const len = Math.hypot(ix, iy);
    let amt = 0;
    if (len > 0.12) {
      amt = Math.min(1, len);
      const nx = ix / len, ny = iy / len;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const mx = rx * nx - fx * ny, mz = rz * nx - fz * ny;
      player.position.x = clamp(player.position.x + mx * MOVE_SPEED * amt * dt, -10.8, 10.8);
      player.position.z = clamp(player.position.z + mz * MOVE_SPEED * amt * dt, Z_BACK + 4, Z_FRONT - 3);
      const d = Math.atan2(Math.sin(Math.atan2(mx, mz) - faceRot), Math.cos(Math.atan2(mx, mz) - faceRot));
      faceRot += d * Math.min(1, dt * 12);
      avatar.rotation.y = faceRot;
    }
    const onGround = player.position.y <= 0.001 && vy <= 0;
    if (jumpReq && onGround) vy = JUMP_V;
    jumpReq = false;
    player.position.y += vy * dt; vy -= GRAVITY * dt;
    if (player.position.y <= 0) { player.position.y = 0; vy = 0; }
    const air = player.position.y > 0.02;
    phase += dt * (6 + 5 * amt);
    const sw = air ? 0 : Math.sin(phase) * 0.9 * amt;
    legL.rotation.x = sw; legR.rotation.x = -sw;
    armUp += ((air ? 1 : 0) - armUp) * Math.min(1, dt * 14);
    armL.rotation.x = -sw * (1 - armUp) - 2.9 * armUp;
    armR.rotation.x = sw * (1 - armUp) - 2.9 * armUp;
    avatar.position.y = air ? 0 : Math.abs(Math.sin(phase)) * 0.06 * amt;

    // カメラ（プレイヤーの後ろを周回）
    const tx = player.position.x, ty = player.position.y + 2.2, tz = player.position.z, D = camDist, cp = Math.cos(pitch);
    cam.position.set(
      clamp(tx + Math.sin(yaw) * cp * D, -(HALF_W - 0.7), HALF_W - 0.7),
      Math.max(0.6, ty + Math.sin(pitch) * D),
      clamp(tz + Math.cos(yaw) * cp * D, Z_BACK + 0.7, Z_FRONT - 0.7));
    cam.lookAt(tx, ty, tz);

    // キャラの更新
    nearest = null; let best = 1e9;
    for (let i = runners.length - 1; i >= 0; i--) {
      const e = runners[i];
      if (e.dying) {
        const k = (now - e.dying) / 220;
        if (k >= 1) { disposeEnt(e); runners.splice(i, 1); continue; }
        e.root.scale.setScalar(0.8 * (1 + k * 0.6)); continue;
      }
      const z = GATE_Z + SPEED * (now - e.spawn) / 1000;
      if (z > END_Z) { if (pressed === e) release(); disposeEnt(e); runners.splice(i, 1); continue; }
      e.root.position.z = z;
      e.fig.position.y = Math.abs(Math.sin(t * 5 + e.seed)) * 0.15;
      e.fig.rotation.y = Math.sin(t * 1.8 + e.seed) * 0.35;
      e.ring.visible = false;
      const d = Math.hypot(e.root.position.x - player.position.x, z - player.position.z);
      if (d <= RANGE && d < best) { best = d; nearest = e; }
      if (e.holdAt) {
        const p = Math.min(1, (now - e.holdAt) / 1000);
        e.bar.scale.x = Math.max(0.001, p); e.bar.position.x = -1.2 * (1 - p);
        e.root.scale.setScalar(0.8 * (1 + 0.06 * Math.sin(t * 25)));
      } else e.root.scale.setScalar(0.8);
    }
    if (pressed && !inRange(pressed)) { release(); toast('離れすぎ！近づいて長押し'); }
    if (nearest) nearest.ring.visible = true;
    const nid = nearest ? nearest.spawn : null;
    if (nid !== nearestId) nearestId = nid;
    // 購入UIは出さず、3Dキャラクター本体の長押しだけで購入する
    buyBtn.style.display = 'none';

    // ボタンをストックパネルの上に配置
    if (panel) {
      const b = Math.round(host.getBoundingClientRect().bottom - panel.getBoundingClientRect().top + 14);
      if (b !== lastBottom && b > 0) { lastBottom = b; buyBtn.style.bottom = b + 'px'; jumpBtn.style.bottom = b + 'px'; }
    }

    const hue = (t * 0.25) % 1;
    runners.forEach((e) => { if (!e.dying && e.fig.userData.rainbow) e.fig.userData.ped.material.emissive.setHSL(hue, 1, 0.5); });
    displays.forEach((f, i) => {
      f.userData.body.rotation.y = Math.sin(t * 1.5 + i) * 0.3;
      if (f.userData.rainbow) f.userData.ped.material.emissive.setHSL(hue, 1, 0.5);
    });
    renderer.render(scene, cam);
  }

  return { update, addRunner, clearRunners, setStocks, setName, resize };
})();
