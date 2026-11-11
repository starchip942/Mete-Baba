/*
 * MB-120 Toros — 3B motor görünümü (three.js r128).
 * Geometri, model.js'in hesapladığı fan çapı ve kademe sayılarından üretilir.
 * Üç görünüm: 0 uçuş hali (kaportalar kapalı), 1 kaportalar açık (donanımlı motor), 2 kesit.
 * Kullanım: var v = Engine3D(hostElement, design.geom); v.update(state, dt, lit);
 */
(function (root) {
  'use strict';
  function Engine3D(host, g) {
    var T = root.THREE, PI = Math.PI;
    var R = g.fan.Dt / 2, LX = 3.6 * R;                    // fan uç yarıçapı ve eksenel ölçek (m)
    var Q0 = 1.5 * PI + 0.12, Q1 = 0.75;                   // kesitte çıkarılan dilim: Q0 → 2π → Q1 (üst-ön)
    var renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);
    var scene = new T.Scene(); scene.background = new T.Color(0x0b0f14);
    scene.fog = new T.Fog(0x0b0f14, 10, 26);
    var camera = new T.PerspectiveCamera(30, 2, 0.1, 60);

    // ---- ortam aydınlatması: stüdyo ışık kutuları olan küçük bir sahneden üretilen yansıma haritası
    (function () {
      var es = new T.Scene(), geo = new T.SphereGeometry(20, 32, 16), col = [], p = geo.attributes.position, i;
      for (i = 0; i < p.count; i++) { var t = (p.getY(i) / 20 + 1) / 2, c = 0.03 + 0.42 * Math.pow(t, 1.6); col.push(c * 0.92, c * 0.97, c * 1.08); }
      geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      es.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
      [[0, 9, 4, 10, 0.4, 5, 3.2], [-8, 4, 8, 0.4, 5, 6, 2.2], [9, 3, -6, 0.4, 6, 8, 1.4], [0, -6, 0, 14, 0.3, 14, 0.25], [2, 1, 12, 8, 3, 0.4, 1.2]].forEach(function (b) {
        var m = new T.Mesh(new T.BoxGeometry(b[3], b[4], b[5]), new T.MeshBasicMaterial({ color: new T.Color(b[6], b[6], b[6]) }));
        m.position.set(b[0], b[1], b[2]); es.add(m);
      });
      var pm = new T.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
    })();
    var key = new T.DirectionalLight(0xffffff, 0.8); key.position.set(-3, 5, 6); scene.add(key);
    var fill = new T.DirectionalLight(0xbfd4ff, 0.35); fill.position.set(2, -2, 5); scene.add(fill);
    scene.add(new T.HemisphereLight(0x9fb4c8, 0x1a1d22, 0.35));

    // ---- malzemeler
    function std(color, metal, rough, extra) {
      var o = { color: color, metalness: metal, roughness: rough, side: T.DoubleSide }, k;
      for (k in extra || {}) o[k] = extra[k];
      return new T.MeshStandardMaterial(o);
    }
    // kaporta paneli dokusu: panel çizgileri ve perçin sıraları
    var panelTex = (function () {
      var c = document.createElement('canvas'); c.width = 1024; c.height = 512; var x = c.getContext('2d'), i, j;
      x.fillStyle = '#e3e7ea'; x.fillRect(0, 0, 1024, 512);
      x.strokeStyle = 'rgba(70,80,90,.55)'; x.lineWidth = 1.5;
      for (i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 128 + 20, 0); x.lineTo(i * 128 + 20, 512); x.stroke(); }
      [70, 150, 300, 420].forEach(function (y) { x.beginPath(); x.moveTo(0, y); x.lineTo(1024, y); x.stroke(); });
      x.fillStyle = 'rgba(60,70,80,.5)';
      for (i = 0; i < 8; i++) for (j = 0; j < 512; j += 9) { x.fillRect(i * 128 + 14, j, 1.6, 1.6); x.fillRect(i * 128 + 25, j, 1.6, 1.6); }
      var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
    })();
    var mNacelle = std(0xffffff, 0.2, 0.34, { map: panelTex }), mLip = std(0xc9ced4, 1.0, 0.16), mCowl = std(0xb9c0c7, 0.75, 0.36), mCase = std(0x8f979f, 0.9, 0.42);
    var mFanCase = std(0x9aa2aa, 0.85, 0.4), mKevlar = std(0xb39a58, 0.05, 0.85), mLiner2 = std(0x6e747b, 0.3, 0.9);
    var mHub = std(0x4a525b, 0.9, 0.42), mSpinner = std(0x20242a, 0.6, 0.3), mSection = std(0xc2410c, 0.1, 0.6);
    var mFan = std(0x2a2f36, 0.75, 0.3, { transparent: true }), mOgv = std(0x9aa3ad, 0.9, 0.35), mStrut = std(0x7c858e, 0.9, 0.4);
    var mComp = std(0xb4bcc4, 0.95, 0.28), mStat = std(0x747c85, 0.9, 0.4), mHpcR = std(0x9b9a8c, 0.95, 0.34);
    var mHpt = std(0x5b5650, 0.9, 0.45, { emissive: 0x000000 }), mLpt = std(0x6a665f, 0.9, 0.45, { emissive: 0x000000 });
    var mLiner = std(0x55504a, 0.8, 0.5, { emissive: 0x000000 });
    var mSteel = std(0xc3c7cb, 1.0, 0.22), mHarness = std(0x1b1c1f, 0.1, 0.8), mFire = std(0x8a3b2a, 0.1, 0.75), mBlanket = std(0xa58f58, 0.6, 0.55);
    var mBox = std(0x626a73, 0.6, 0.5), mDark = std(0x2b2f35, 0.7, 0.45), mBlue = std(0x2f5fa8, 0.8, 0.35), mGold = std(0xb8923a, 0.9, 0.35), mOil = std(0x7d8791, 0.85, 0.35);
    var mWing = std(0xd5dadf, 0.3, 0.4), mPylon = std(0xcdd2d7, 0.35, 0.4);

    var eng = new T.Group(); eng.rotation.z = -PI / 2; eng.position.x = -0.5 * LX; scene.add(eng);
    var lp = new T.Group(), hp = new T.Group(); eng.add(lp); eng.add(hp);
    var shells = [], ext = [], labels = [];
    function V(a) { return a.map(function (q) { return new T.Vector2(q[1] * R, q[0] * LX); }); }
    function C(x, r, phi) { return new T.Vector3(r * R * Math.sin(phi), x * LX, r * R * Math.cos(phi)); }
    function inCut(phi) { phi = ((phi % (2 * PI)) + 2 * PI) % (2 * PI); return phi > Q0 || phi < Q1; }

    // kapalı profilden dönel gövde; kesit modunda üst-ön dilim çıkarılır ve kesit yüzeyleri kapatılır
    function shell(loop, mat, kind) {
      var pts = V(loop.concat([loop[0]]));
      var full = new T.Mesh(new T.LatheGeometry(pts, 96), mat); eng.add(full);
      var grp = new T.Group(); grp.add(new T.Mesh(new T.LatheGeometry(pts, 72, Q1, Q0 - Q1), mat));
      var sg = new T.ShapeGeometry(new T.Shape(V(loop)));
      [Q1, Q0].forEach(function (phi) { var c = new T.Mesh(sg, mSection); c.rotation.y = phi - PI / 2; grp.add(c); });
      eng.add(grp); shells.push({ full: full, cut: grp, kind: kind });
    }
    // bir çizgiden ince cidarlı kabuk profili üretir
    function wall(line, th) {
      var out = line.slice(), i, n = line.length;
      for (i = n - 1; i >= 0; i--) out.push([line[i][0], line[i][1] - th]);
      return out;
    }
    var CASE = [[0.20, 0.535], [0.34, 0.455], [0.38, 0.315], [0.55, 0.315], [0.56, 0.36], [0.64, 0.36], [0.66, 0.345], [0.70, 0.365], [0.73, 0.415], [0.89, 0.475], [0.98, 0.385]];
    function rc(x) {                                        // çekirdek gövde dış yarıçapı
      for (var i = 1; i < CASE.length; i++) if (x <= CASE[i][0]) { var a = CASE[i - 1], b = CASE[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
      return CASE[CASE.length - 1][1];
    }
    shell([[0.035, 1.0], [0.13, 1.0], [0.13, 1.208], [0.08, 1.185], [0.02, 1.13], [0.0, 1.07], [0.008, 1.025]], mNacelle, 'inlet');
    shell([[0.13, 1.0], [0.14, 1.0], [0.62, 0.93], [0.628, 0.95], [0.52, 1.10], [0.38, 1.18], [0.20, 1.21], [0.13, 1.208]], mNacelle, 'cowl');
    shell(wall([[0.185, 0.575], [0.20, 0.60], [0.45, 0.61], [0.62, 0.59], [0.80, 0.56], [0.90, 0.50], [0.98, 0.40]], 0.014), mCowl, 'cowl');
    shell(wall(CASE, 0.016), mCase, 'case');
    shell(wall([[0.125, 1.04], [0.335, 1.04]], 0.035), mFanCase, 'case');
    shell(wall([[0.137, 1.052], [0.20, 1.052]], 0.012), mKevlar, 'case');              // kanat tutma (containment) sargısı
    shell(wall([[0.20, 0.535], [0.185, 0.555], [0.20, 0.585]], 0.012), mCase, 'case');   // ayırıcı dudağı
    eng.add(new T.Mesh(new T.LatheGeometry(V([[0.045, 1.0005], [0.125, 0.9995]]), 96), mLiner2));                                          // giriş akustik astarı
    eng.add(new T.Mesh(new T.LatheGeometry(V([[0.036, 1.002], [0.008, 1.027], [-0.001, 1.07], [0.02, 1.132], [0.05, 1.165]]), 96), mLip)); // giriş dudağı
    // iç gövde (diskler, yatak yuvaları, kuyruk konisi)
    eng.add(new T.Mesh(new T.LatheGeometry(V([[0.14, 0.0], [0.14, 0.30], [0.20, 0.34], [0.34, 0.30], [0.38, 0.16], [0.55, 0.25], [0.555, 0.20], [0.64, 0.24], [0.73, 0.28], [0.89, 0.26], [0.98, 0.10], [1.06, 0.0]]), 72), mHub));
    lp.add(new T.Mesh(new T.LatheGeometry(V([[0.052, 0.0], [0.062, 0.06], [0.085, 0.15], [0.112, 0.235], [0.142, 0.30]]), 48), mSpinner));
    (function () {                                          // burun konisi spirali (dönüşü yerden görmek için)
      var p = [], i; for (i = 0; i <= 60; i++) { var t = i / 60, x = 0.062 + 0.07 * t, r = 0.06 + 0.215 * t; p.push(C(x, r + 0.004, t * 2.6 * PI)); }
      lp.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(p), 80, 0.008 * R, 5), new T.MeshBasicMaterial({ color: 0xf2f2f2 })));
    })();

    // ---- fan kanatları: burulmalı, geniş veterli
    var NB = 18;
    (function () {
      var ns = 14, nc = 5, pos = [], idx = [], i, j, k;
      for (i = 0; i <= ns; i++) {
        var t = i / ns, r = (0.30 + 0.695 * t) * R, chord = (0.085 + 0.035 * t) * LX, beta = (22 + 42 * t) * PI / 180;
        var y0 = (0.168 + 0.012 * t * t) * LX, lean = -0.10 * t * t;
        for (j = 0; j <= nc; j++) {
          var s = j / nc - 0.5, camber = 0.05 * chord * (1 - 4 * s * s);
          var dy = s * chord * Math.cos(beta), dx = s * chord * Math.sin(beta) + camber * Math.cos(beta), phi = dx / r + lean;
          pos.push(r * Math.sin(phi), y0 + dy, r * Math.cos(phi));
        }
      }
      for (i = 0; i < ns; i++) for (j = 0; j < nc; j++) { var a = i * (nc + 1) + j, b = a + 1, c = a + nc + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      for (k = 0; k < NB; k++) { var m = new T.Mesh(geo, mFan); m.rotation.y = k * 2 * PI / NB; lp.add(m); }
    })();
    var blur = new T.Mesh(new T.RingGeometry(0.31 * R, 0.995 * R, 64), new T.MeshBasicMaterial({ color: 0x3a4048, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
    blur.rotation.x = -PI / 2; blur.position.y = 0.172 * LX; eng.add(blur);

    // ---- kanat profili: kamburlu, burulmalı birim kanat (açıklık z, veter y)
    function bladeGeo(camber, twist) {
      var ns = 4, np = 12, pos = [], idx = [], i, j;
      for (i = 0; i <= ns; i++) {
        var z = i / ns - 0.5, tw = twist * z, cs = Math.cos(tw), sn = Math.sin(tw);
        for (j = 0; j < np; j++) {
          var a = j / np * 2 * PI, c = 0.5 + 0.5 * Math.cos(a), th = 0.10 * Math.sin(a) * Math.pow(c, 0.5) * (1 - 0.6 * c) * 2.2;
          var x = camber * 4 * c * (1 - c) + th, y = c - 0.5;
          pos.push(x * cs - y * sn, x * sn + y * cs, z);
        }
      }
      for (i = 0; i < ns; i++) for (j = 0; j < np; j++) { var p = i * np + j, q = i * np + (j + 1) % np; idx.push(p, q, p + np, q, q + np, p + np); }
      for (j = 1; j < np - 1; j++) idx.push(ns * np, ns * np + j, ns * np + j + 1);
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
    }
    var gComp = bladeGeo(0.10, 0.5), gTurb = bladeGeo(0.32, 0.25), gVane = bladeGeo(0.14, 0.0);
    var dummy = new T.Object3D(), qa = new T.Quaternion(), qb = new T.Quaternion(), AY = new T.Vector3(0, 1, 0), AZ = new T.Vector3(0, 0, 1), AX = new T.Vector3(1, 0, 0);
    function row(parent, geo, mat, x, ri, ro, chord, stagger, count) {
      var im = new T.InstancedMesh(geo, mat, count), rm = (ri + ro) / 2, i;
      for (i = 0; i < count; i++) {
        var phi = i * 2 * PI / count;
        dummy.position.copy(C(x, rm, phi));
        qa.setFromAxisAngle(AY, phi); qb.setFromAxisAngle(AZ, stagger); dummy.quaternion.copy(qa).multiply(qb);
        dummy.scale.set(chord, chord, (ro - ri) * R * 0.97);
        dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      }
      parent.add(im);
    }
    function stages(spool, matR, matS, xa, xb, ria, rib, roa, rob, n, turbine) {
      for (var i = 0; i < n; i++) [0.27, 0.75].forEach(function (u, k) {
        var f = (i + u) / n, x = xa + (xb - xa) * f, ri = ria + (rib - ria) * f, ro = roa + (rob - roa) * f;
        var rotor = turbine ? k === 1 : k === 0, chord = (xb - xa) / n * 0.40 * LX, rm = (ri + ro) / 2 * R;
        var cnt = Math.max(22, Math.min(84, Math.round(2 * PI * rm / (chord * 0.8))));
        row(rotor ? spool : eng, turbine ? gTurb : gComp, rotor ? matR : matS, x, ri, ro, chord, (rotor ? 1 : -1) * (turbine ? -0.8 : 0.62), cnt);
        if (rotor) {                                        // disk kenarı (platform)
          var d = new T.Mesh(new T.CylinderGeometry(ri * R * 1.005, ri * R * 1.005, chord * 0.9, 48, 1, true), matR); d.position.y = x * LX; spool.add(d);
        }
      });
    }
    row(eng, gVane, mOgv, 0.285, 0.605, 0.975, 0.05 * LX, -0.2, 46);                         // fan çıkış kılavuz kanatları
    row(eng, gVane, mStrut, 0.345, 0.47, 0.60, 0.035 * LX, 0, 10);                           // fan çerçevesi dikmeleri
    stages(lp, mComp, mStat, 0.215, 0.335, 0.34, 0.30, 0.52, 0.44, g.nBoost, false);         // booster
    stages(hp, mHpcR, mStat, 0.385, 0.548, 0.16, 0.25, 0.30, 0.30, g.nHpc, false);           // HPC
    stages(hp, mHpt, mHpt, 0.645, 0.698, 0.24, 0.25, 0.32, 0.35, g.nHpt, true);              // HPT
    stages(lp, mLpt, mLpt, 0.735, 0.888, 0.28, 0.26, 0.40, 0.46, g.nLpt, true);              // LPT
    row(eng, gVane, mLpt, 0.92, 0.22, 0.44, 0.04 * LX, 0, 12);                               // türbin arka çerçevesi

    // ---- yanma odası: astar + alev
    eng.add(new T.Mesh(new T.LatheGeometry(V([[0.56, 0.215], [0.575, 0.235], [0.635, 0.25]]), 64), mLiner));
    var flame = new T.Mesh(new T.LatheGeometry(V([[0.565, 0.25], [0.585, 0.31], [0.615, 0.315], [0.638, 0.295], [0.638, 0.265], [0.60, 0.25], [0.565, 0.25]]), 64),
      new T.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    eng.add(flame);
    var flameLight = new T.PointLight(0xff8a3a, 0, 2.2 * R); flameLight.position.copy(C(0.6, 0.5, 5.6)); eng.add(flameLight);
    var plume = (function () {
      var n = 24, pts = [], i;
      for (i = 0; i <= n; i++) { var t = i / n; pts.push(new T.Vector2((0.36 - 0.14 * t) * R, (0.985 + 0.6 * t) * LX)); }
      var geo = new T.LatheGeometry(pts, 40), col = [], p = geo.attributes.position;
      for (i = 0; i < p.count; i++) { var f = 1 - (p.getY(i) / LX - 0.985) / 0.6; f = Math.max(0, f); col.push(f * f, f * f, f * f); }
      geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      var m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xff9a55, vertexColors: true, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      eng.add(m); return m;
    })();

    // =====================================================================================
    // Dış donanım: borular, kablo demetleri, aksesuarlar. Kesit modunda çıkarılan dilime
    // giren parçalar gizlenir (userData.q).
    // =====================================================================================
    function addExt(mesh, q) { mesh.userData.q = !!q; eng.add(mesh); ext.push(mesh); return mesh; }
    function pipe(pts, rad, mat) {                          // pts: [x, r, phi] silindirik koordinatlar
      var q = false, v = pts.map(function (p) { if (inCut(p[2])) q = true; return C(p[0], p[1], p[2]); });
      return addExt(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(v, false, 'catmullrom', 0.4), Math.max(12, pts.length * 7), rad * R, 6), mat), q);
    }
    function arc(x, r, p0, p1, rad, mat) { var n = Math.max(3, Math.ceil(Math.abs(p1 - p0) / 0.22)), pts = [], i; for (i = 0; i <= n; i++) pts.push([x, r, p0 + (p1 - p0) * i / n]); return pipe(pts, rad, mat); }
    function ring(x, r, rad, mat) { arc(x, r, Q1 + 0.02, Q0 - 0.02, rad, mat); arc(x, r, Q0 - 0.02, 2 * PI + Q1 + 0.02, rad, mat); }
    function boxAt(x, r, phi, st, sa, sr, mat) {            // teğetsel, eksenel, radyal boyutlar (R / LX birimi)
      var m = new T.Mesh(new T.BoxGeometry(st * R, sa * LX, sr * R), mat); m.position.copy(C(x, r, phi)); m.rotation.y = phi; return addExt(m, inCut(phi));
    }
    function cylAt(x, r, phi, rad, len, axis, mat) {        // axis: 'a' eksenel, 'r' radyal, 't' teğetsel
      var m = new T.Mesh(new T.CylinderGeometry(rad * R, rad * R, len, 20), mat); m.position.copy(C(x, r, phi));
      qa.setFromAxisAngle(AY, phi); if (axis === 'r') qa.multiply(qb.setFromAxisAngle(AX, PI / 2)); if (axis === 't') qa.multiply(qb.setFromAxisAngle(AZ, PI / 2));
      m.quaternion.copy(qa); return addExt(m, inCut(phi));
    }
    function many(n, fn) {                                  // çevresel dizilim; dilime girenler ayrı örneklenir
      for (var i = 0; i < n; i++) fn(i * 2 * PI / n + 0.07, i);
    }
    function label(name, x, r, phi, modes) { labels.push({ name: name, p: C(x, r, phi), modes: modes }); }

    // --- flanşlar
    [0.125, 0.20, 0.335].forEach(function (x) { ring(x, 1.05, 0.012, mFanCase); });
    [0.34, 0.38, 0.455, 0.55, 0.64, 0.70, 0.73, 0.89].forEach(function (x) { ring(x, rc(x) + 0.012, 0.011, mCase); });
    many(60, function (phi) { cylAt(0.335, 1.062, phi, 0.006, 0.02 * LX, 'a', mSteel); });         // fan gövdesi flanş cıvataları
    many(40, function (phi) { cylAt(0.55, rc(0.55) + 0.022, phi, 0.005, 0.016 * LX, 'a', mSteel); });
    many(40, function (phi) { cylAt(0.73, rc(0.73) + 0.022, phi, 0.005, 0.016 * LX, 'a', mSteel); });

    // --- aksesuar dişli kutusu (fan gövdesi altında) ve aksesuarlar
    var DN = PI / 2;                                        // alt taraf
    [-0.36, -0.18, 0, 0.18, 0.36].forEach(function (o) { boxAt(0.255, 1.135, DN + o, 0.24, 0.05, 0.15, mBox); });
    cylAt(0.21, 1.15, DN - 0.36, 0.062, 0.085 * LX, 'a', mSteel);     // hava türbinli marş motoru
    cylAt(0.305, 1.16, DN + 0.36, 0.075, 0.075 * LX, 'a', mDark);     // entegre tahrikli jeneratör (IDG)
    cylAt(0.205, 1.15, DN + 0.02, 0.05, 0.06 * LX, 'a', mBlue);       // hidrolik pompa
    boxAt(0.31, 1.15, DN - 0.12, 0.17, 0.05, 0.12, mGold);            // yakıt pompası + ölçme ünitesi (FMU)
    cylAt(0.205, 1.14, DN + 0.3, 0.035, 0.045 * LX, 'a', mOil);       // yağ pompası
    cylAt(0.31, 1.14, DN - 0.33, 0.04, 0.04 * LX, 'a', mOil);         // yağ/yakıt ısı değiştirici
    pipe([[0.275, 1.06, DN], [0.31, 0.9, DN], [0.34, 0.62, DN]], 0.022, mStrut);                    // radyal tahrik mili muhafazası
    pipe([[0.21, 1.15, DN - 0.42], [0.19, 1.13, DN - 0.7], [0.21, 1.10, DN - 1.1], [0.30, 1.10, DN - 1.45], [0.40, 1.02, DN - 1.52]], 0.035, mSteel); // marş hava kanalı
    // --- yağ tankı, FADEC, ateşleme kutuları
    cylAt(0.265, 1.13, 0.35 + PI, 0.075, 0.10 * LX, 'a', mOil);
    [0.215, 0.315].forEach(function (x) { var s = new T.Mesh(new T.SphereGeometry(0.075 * R, 18, 12), mOil); s.position.copy(C(x, 1.13, 0.35 + PI)); addExt(s, false); });
    cylAt(0.20, 1.215, 0.35 + PI, 0.022, 0.03 * R, 'r', mGold);       // dolum kapağı
    boxAt(0.255, 1.105, 5.75, 0.36, 0.085, 0.10, mDark);              // FADEC (EEC)
    many(6, function (phi, i) { cylAt(0.208 + 0.0, 1.10, 5.60 + i * 0.06, 0.016, 0.016 * LX, 'a', mSteel); });
    boxAt(0.24, 1.09, 2.9, 0.20, 0.05, 0.07, mBox); boxAt(0.30, 1.09, 2.9, 0.20, 0.05, 0.07, mBox);  // ateşleme uyarıcıları
    boxAt(0.17, 1.085, 4.1, 0.16, 0.04, 0.06, mBox);                  // titreşim / hız algılayıcı kutusu

    // --- fan gövdesi kablo demetleri ve hatları
    [[0.218, 5.9, 8.9, 0.011], [0.232, 5.9, 7.6, 0.009], [0.292, 2.9, 5.6, 0.011], [0.305, 3.2, 5.6, 0.008], [0.165, 4.1, 5.6, 0.008], [0.178, 1.2, 4.0, 0.009], [0.322, 0.2, 2.6, 0.010]].forEach(function (h) {
      arc(h[0], 1.068, h[1], h[2], h[3], mHarness);
      for (var p = h[1] + 0.2; p < h[2]; p += 0.45) boxAt(h[0], 1.066, p, 0.03, 0.012, 0.03, mSteel);  // kelepçeler
    });
    arc(0.15, 1.075, 0.6, 3.6, 0.014, mSteel); arc(0.326, 1.08, 1.9, 4.6, 0.018, mOil);                // yağ dönüş / havalandırma hatları
    pipe([[0.265, 1.13, 0.9 + PI], [0.275, 1.10, 2.6], [0.27, 1.10, 2.1], [0.26, 1.12, DN + 0.3]], 0.018, mOil);

    // --- VSV (değişken stator) halkaları, kolları ve eyleyicileri
    [0.392, 0.412, 0.432, 0.452].forEach(function (x, k) {
      ring(x, 0.352, 0.007, mSteel);
      many(36, function (phi) { boxAt(x - 0.006, 0.338, phi, 0.008, 0.016, 0.02, mSteel); });
    });
    [0.5, 0.5 + PI].forEach(function (phi) {
      cylAt(0.47, 0.40, phi, 0.022, 0.07 * LX, 'a', mBlue); cylAt(0.425, 0.40, phi, 0.008, 0.07 * LX, 'a', mSteel);
      pipe([[0.39, 0.36, phi], [0.39, 0.40, phi], [0.455, 0.40, phi]], 0.008, mSteel);
    });
    // --- tahliye (bleed) valfleri ve kanalları
    [[5.2, 4.75], [2.2, 4.55], [1.0, 4.9 - 2 * PI]].forEach(function (b, k) {
      cylAt(0.50, 0.36, b[0], 0.04, 0.07 * R, 'r', mSteel);
      pipe([[0.50, 0.40, b[0]], [0.505, 0.47, b[0] + (b[1] - b[0]) * 0.25], [0.50, 0.53, b[0] + (b[1] - b[0]) * 0.7], [0.47, 0.55, b[1]], [0.40, 0.57, b[1]]], k ? 0.03 : 0.036, k ? mSteel : mBlanket);
    });
    // --- yakıt manifoldu, enjektörler, besleme hattı
    ring(0.566, 0.43, 0.011, mSteel); ring(0.578, 0.445, 0.009, mSteel);
    many(20, function (phi, i) {
      cylAt(0.592, 0.385, phi, 0.014, 0.06 * R, 'r', mGold);
      pipe([[0.572, i % 2 ? 0.445 : 0.43, phi - 0.03], [0.585, 0.455, phi], [0.592, 0.42, phi]], 0.005, mSteel);
    });
    pipe([[0.31, 1.10, DN - 0.12], [0.335, 0.9, DN - 0.1], [0.345, 0.62, DN - 0.1], [0.40, 0.50, DN - 0.15], [0.50, 0.47, DN - 0.2], [0.566, 0.43, DN - 0.2]], 0.012, mFire);
    pipe([[0.31, 1.10, DN - 0.05], [0.338, 0.9, DN + 0.08], [0.35, 0.62, DN + 0.1], [0.42, 0.52, DN + 0.2], [0.52, 0.49, DN + 0.3], [0.578, 0.445, DN + 0.3]], 0.010, mFire);
    // --- ateşleme bujileri ve kabloları
    [[5.5, 5.75], [2.6, 2.9]].forEach(function (ig) {
      cylAt(0.612, 0.40, ig[0], 0.014, 0.09 * R, 'r', mSteel);
      pipe([[0.612, 0.45, ig[0]], [0.58, 0.50, ig[0] + 0.1], [0.45, 0.56, ig[0] + 0.15], [0.36, 0.60, ig[1]], [0.33, 0.85, ig[1]], [0.30, 1.06, ig[1]]], 0.008, mFire);
    });
    // --- türbin aktif boşluk kontrolü (ACC) manifoldları
    [0.652, 0.668, 0.684].forEach(function (x) { ring(x, rc(x) + 0.045, 0.012, mSteel); });
    [0.75, 0.775, 0.80, 0.825, 0.85, 0.875].forEach(function (x) { ring(x, rc(x) + 0.03, 0.007, mSteel); });
    [0.3, 2.4, 4.4].forEach(function (phi) { pipe([[0.652, rc(0.652) + 0.05, phi], [0.70, rc(0.70) + 0.075, phi], [0.80, rc(0.80) + 0.055, phi], [0.875, rc(0.875) + 0.04, phi]], 0.012, mSteel); });
    pipe([[0.36, 0.60, 4.3], [0.45, 0.55, 4.35], [0.58, 0.50, 4.4], [0.652, rc(0.652) + 0.06, 4.4]], 0.026, mSteel);
    cylAt(0.60, 0.50, 4.4, 0.036, 0.06 * LX, 'a', mBlue);             // ACC valfi
    // --- EGT ölçüm halkası ve problar
    ring(0.715, rc(0.715) + 0.05, 0.006, mHarness);
    many(8, function (phi) { cylAt(0.715, rc(0.715) + 0.02, phi, 0.008, 0.06 * R, 'r', mSteel); });
    // --- yağ besleme / dönüş hatları (arka yatak yuvasına)
    [DN - 0.25, DN + 0.25].forEach(function (phi, k) {
      pipe([[0.30, 1.08, phi], [0.335, 0.88, phi], [0.35, 0.62, phi], [0.42, 0.55, phi], [0.60, 0.47, phi], [0.72, 0.50, phi], [0.86, 0.53, phi], [0.915, 0.47, phi]], 0.010, k ? mOil : mSteel);
    });
    // --- çekirdek üzerinde eksenel kablo demetleri ve hatlar
    [[0.9, mHarness, 0.008], [1.9, mHarness, 0.007], [2.75, mHarness, 0.009], [3.5, mHarness, 0.007], [4.05, mSteel, 0.006], [4.62, mHarness, 0.010], [5.35, mHarness, 0.008], [6.0, mSteel, 0.006], [0.2, mHarness, 0.007], [3.1, mSteel, 0.006]].forEach(function (h, k) {
      var pts = [], x, w = 0.12 + 0.05 * (k % 3);
      for (x = 0.36; x <= 0.90; x += 0.045) pts.push([x, rc(x) + 0.055 + 0.012 * Math.sin(k + x * 30), h[0] + w * Math.sin(x * (9 + k) + k)]);
      pipe(pts, h[2], h[1]);
      for (x = 0.40; x < 0.90; x += 0.11) boxAt(x, rc(x) + 0.04, h[0] + w * Math.sin(x * (9 + k) + k), 0.022, 0.008, 0.035, mSteel);
    });
    // --- motor askıları: ön askı, arka askı, itki çubukları
    var UP = 1.5 * PI;
    boxAt(0.335, 1.10, UP, 0.30, 0.03, 0.14, mDark); boxAt(0.72, rc(0.72) + 0.10, UP, 0.26, 0.03, 0.16, mDark);
    [-0.11, 0.11].forEach(function (o) { pipe([[0.345, 0.62, UP + o * 2.2], [0.53, 0.58, UP + o * 1.5], [0.71, rc(0.71) + 0.13, UP + o]], 0.016, mSteel); });

    // ---- dış donanımı malzeme başına tek geometriye birleştir (yüzlerce çizim çağrısı yerine ~30)
    (function () {
      var groups = {}, merged = [];
      ext.forEach(function (m) {
        m.updateMatrix(); var gg = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); gg.applyMatrix4(m.matrix);
        var k = m.material.uuid + (m.userData.q ? 'q' : 'k'); (groups[k] = groups[k] || { mat: m.material, q: m.userData.q, list: [] }).list.push(gg);
        eng.remove(m); m.geometry.dispose();
      });
      Object.keys(groups).forEach(function (k) {
        var gr = groups[k], n = 0, o = 0; gr.list.forEach(function (x) { n += x.attributes.position.count; });
        var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
        gr.list.forEach(function (x) { pos.set(x.attributes.position.array, o); nor.set(x.attributes.normal.array, o); o += x.attributes.position.count * 3; x.dispose(); });
        var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
        var mesh = new T.Mesh(geo, gr.mat); mesh.userData.q = gr.q; eng.add(mesh); merged.push(mesh);
      });
      ext = merged;
    })();

    // ---- pilon ve kanat (motorun uçağa bağlandığı yer)
    (function () {
      var a = function (x) { return (x - 0.5) * LX; }, sh = new T.Shape();
      [[0.27, 1.19], [0.40, 1.66], [1.28, 1.66], [1.22, 1.36], [0.98, 0.92], [0.80, 0.80], [0.66, 1.0], [0.62, 1.06], [0.40, 1.19]].forEach(function (p, i) { sh[i ? 'lineTo' : 'moveTo'](a(p[0]), p[1] * R); });
      var py = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.24 * R, bevelEnabled: true, bevelSize: 0.03 * R, bevelThickness: 0.03 * R, bevelSegments: 3 }), mPylon);
      py.position.z = -0.12 * R; scene.add(py);
      var w = new T.Shape(), i, n = 28, ch = 4.4, th = 0.5;
      for (i = 0; i <= n; i++) { var t = i / n; w[i ? 'lineTo' : 'moveTo'](t * ch, th * 2.6 * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t * t * t - 0.1036 * t * t * t * t) * 0.9); }
      for (i = n; i >= 0; i--) { var u = i / n; w.lineTo(u * ch, -th * 1.3 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u * u * u - 0.1036 * u * u * u * u)); }
      var wing = new T.Mesh(new T.ExtrudeGeometry(w, { depth: 9, bevelEnabled: false, curveSegments: 4 }), mWing);
      wing.position.set(a(0.74), 1.84 * R, -4.5); wing.rotation.y = 0; scene.add(wing);
      wing.geometry.translate(0, 0, 0); wing.rotation.z = -0.03;
    })();
    var grid = new T.GridHelper(30, 30, 0x2a3440, 0x1a222b); grid.position.y = -1.75 * R; scene.add(grid);

    // ---- etiketler (HTML, sahne noktalarına izdüşürülür)
    label('Fan', 0.17, 0.75, 6.0, [2]); label('Booster', 0.27, 0.50, 6.0, [2]); label('Yüksek basınç kompresörü', 0.46, 0.32, 6.0, [2]);
    label('Yanma odası', 0.60, 0.36, 6.0, [2]); label('HP türbin', 0.67, 0.36, 6.0, [2]); label('LP türbin', 0.81, 0.46, 6.0, [2]);
    label('FADEC', 0.255, 1.16, 5.75, [1]); label('Aksesuar dişli kutusu', 0.255, 1.22, DN - 0.2, [1, 2]); label('Marş motoru', 0.20, 1.22, DN - 0.4, [1]);
    label('VSV halkaları', 0.42, 0.37, 5.9, [1]); label('Yakıt manifoldu', 0.572, 0.46, 5.9, [1]); label('Tahliye kanalı', 0.50, 0.55, 5.0, [1]);
    label('Türbin boşluk kontrolü', 0.80, rc(0.80) + 0.06, 5.9, [1]); label('Yağ tankı', 0.265, 1.2, 0.35 + PI, [1]); label('Pilon', 0.9, 1.5, UP, [0, 1, 2]);
    var lbHost = document.createElement('div'); lbHost.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'; host.style.position = 'relative'; host.appendChild(lbHost);
    labels.forEach(function (l) {
      var e = document.createElement('div');
      e.style.cssText = 'position:absolute;transform:translate(8px,-50%);font:11px "IBM Plex Mono",ui-monospace,monospace;color:#e6ecf2;background:rgba(11,15,20,.72);border:1px solid #2b3745;border-left:2px solid #ffa63d;padding:1px 6px;white-space:nowrap';
      e.textContent = l.name; lbHost.appendChild(e); l.el = e;
    });
    var showLabels = true, tmp = new T.Vector3();

    // ---- kamera
    var cam = { az: -0.8, el: 0.28, taz: -0.8, tel: 0.28, d: 8, zoom: 1 };
    var VIEWS = { kesit: [-0.8, 0.28], on: [-1.3, 0.1], yan: [0, 0.1], arka: [2.25, 0.2], alt: [-0.5, -0.22] };
    function resize() {
      var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      cam.d = 6.9 * Math.max(1, 1.75 / camera.aspect);
    }
    resize(); if (root.ResizeObserver) new ResizeObserver(resize).observe(host); else root.addEventListener('resize', resize);
    var drag = null, el = renderer.domElement; el.style.touchAction = 'pan-y'; el.style.cursor = 'grab';
    el.addEventListener('pointerdown', function (e) { drag = [e.clientX, e.clientY]; try { el.setPointerCapture(e.pointerId); } catch (x) {} });
    el.addEventListener('pointermove', function (e) {
      if (!drag) return;
      cam.taz -= (e.clientX - drag[0]) * 0.007; if (e.pointerType !== 'touch') cam.tel = Math.max(-0.45, Math.min(1.2, cam.tel + (e.clientY - drag[1]) * 0.005));
      drag = [e.clientX, e.clientY];
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { el.addEventListener(n, function () { drag = null; }); });

    var mode = 2, angL = 0, angH = 0;
    function setMode(m) {
      mode = m;
      shells.forEach(function (s) {
        var hide = m === 1 && s.kind === 'cowl';
        s.full.visible = !hide && m !== 2; s.cut.visible = !hide && m === 2;
      });
      ext.forEach(function (e) { e.visible = m === 1 || (m === 2 && !e.userData.q); });
    }
    setMode(2);
    function glow(mat, Tk, gain) {                          // akkor ışıma: ~800 K altında görünmez
      var k = Math.max(0, Math.min(1, (Tk - 800) / 800)); k = k * k * gain;
      mat.emissive.setRGB(1.0 * k, (0.16 + 0.45 * k) * k, 0.03 * k);
    }
    function update(o, dt, lit) {
      var rpsL = o.NL * g.rpmL / 60, rpsH = o.NH * g.rpmH / 60;
      // gerçek devirde kanatlar ekran yenilemesinde seçilemez; görsel hız doygunlaştırılır, fark bulanıklıkla verilir
      angL += dt * 2 * PI * 1.6 * Math.tanh(rpsL / 9); angH -= dt * 2 * PI * 0.35 * Math.tanh(rpsH / 60);
      lp.rotation.y = angL; hp.rotation.y = angH;
      var b = Math.max(0, Math.min(1, (o.NL - 0.12) / 0.5));
      blur.material.opacity = 0.5 * b; mFan.opacity = 1 - 0.55 * b;
      var T4 = o.st[5].T, T45 = o.st[7].T, T5 = o.st[8].T;
      glow(mHpt, T45 * 0.5 + T4 * 0.35, 1.0); glow(mLpt, (T45 + T5) / 2 * 0.92, 0.8); glow(mLiner, T4 * 0.62, 0.8);
      var f = lit ? Math.max(0, Math.min(1, (T4 - 600) / 1000)) : 0, fl = 0.9 + 0.1 * Math.sin(angL * 7.3) * Math.sin(angH * 3.1);
      flame.material.opacity = (0.12 + 0.3 * f) * (lit ? 1 : 0) * fl;
      flame.material.color.setRGB(1, 0.34 + 0.3 * f, 0.05 + 0.25 * f * f);
      flameLight.intensity = lit ? (0.3 + 0.9 * f) * fl : 0;
      plume.material.opacity = Math.max(0, Math.min(0.13, (o.st[9].T - 520) / 3500)) * (lit ? 1 : 0);
      plume.material.color.setRGB(1, 0.5 + 0.15 * f, 0.22 + 0.2 * f);
      cam.az += (cam.taz - cam.az) * Math.min(1, dt * 6 + 0.02); cam.el += (cam.tel - cam.el) * Math.min(1, dt * 6 + 0.02);
      var d = cam.d * cam.zoom;
      camera.position.set(d * Math.sin(cam.az) * Math.cos(cam.el), d * Math.sin(cam.el) + 0.15, d * Math.cos(cam.az) * Math.cos(cam.el));
      camera.lookAt(0.1, 0.12, 0);
      renderer.render(scene, camera);
      var w = host.clientWidth, h = host.clientHeight;
      labels.forEach(function (l) {
        var on = showLabels && l.modes.indexOf(mode) >= 0;
        if (on) { tmp.copy(l.p); eng.localToWorld(tmp); tmp.project(camera); on = tmp.z < 1 && Math.abs(tmp.x) < 0.98 && Math.abs(tmp.y) < 0.95; }
        l.el.style.display = on ? '' : 'none';
        if (on) { l.el.style.left = ((tmp.x + 1) / 2 * w).toFixed(1) + 'px'; l.el.style.top = ((1 - tmp.y) / 2 * h).toFixed(1) + 'px'; }
      });
    }
    return {
      update: update, setMode: setMode, mode: function () { return mode; },
      setLabels: function (v) { showLabels = v; }, zoom: function (k) { cam.zoom = Math.max(0.45, Math.min(1.5, cam.zoom * k)); },
      setView: function (n) { var v = VIEWS[n]; if (v) { cam.taz = v[0]; cam.tel = v[1]; } }
    };
  }
  root.Engine3D = Engine3D;
})(typeof self !== 'undefined' ? self : this);
