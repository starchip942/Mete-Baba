/*
 * MB-120 Toros — 3B motor görünümü (three.js r128).
 * Geometri, model.js'in hesapladığı fan çapı ve kademe sayılarından üretilir.
 * Kullanım: var v = Engine3D(hostElement, design.geom); v.update(state, dt);
 */
(function (root) {
  'use strict';
  function Engine3D(host, g) {
    var T = root.THREE;
    var R = g.fan.Dt / 2, LX = 3.6 * R;                    // fan uç yarıçapı ve eksenel ölçek (m)
    var renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);
    var scene = new T.Scene(); scene.background = new T.Color(0x0b0f14);
    scene.fog = new T.Fog(0x0b0f14, 9, 22);
    var camera = new T.PerspectiveCamera(30, 2, 0.1, 60);

    // ---- ortam aydınlatması: stüdyo ışık kutuları olan küçük bir sahneden üretilen yansıma haritası
    (function () {
      var es = new T.Scene(), geo = new T.SphereGeometry(20, 32, 16), col = [], p = geo.attributes.position, i;
      for (i = 0; i < p.count; i++) { var t = (p.getY(i) / 20 + 1) / 2, c = 0.03 + 0.42 * Math.pow(t, 1.6); col.push(c * 0.92, c * 0.97, c * 1.08); }
      geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      es.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
      [[0, 9, 4, 10, 0.4, 5, 3.2], [-8, 4, 8, 0.4, 5, 6, 2.2], [9, 3, -6, 0.4, 6, 8, 1.4], [0, -6, 0, 14, 0.3, 14, 0.25]].forEach(function (b) {
        var m = new T.Mesh(new T.BoxGeometry(b[3], b[4], b[5]), new T.MeshBasicMaterial({ color: new T.Color(b[6], b[6], b[6]) }));
        m.position.set(b[0], b[1], b[2]); es.add(m);
      });
      var pm = new T.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
    })();
    var key = new T.DirectionalLight(0xffffff, 0.9); key.position.set(-3, 6, 5); scene.add(key);
    scene.add(new T.HemisphereLight(0x9fb4c8, 0x1a1d22, 0.35));

    // ---- malzemeler
    function std(color, metal, rough, extra) {
      var o = { color: color, metalness: metal, roughness: rough, side: T.DoubleSide }, k;
      for (k in extra || {}) o[k] = extra[k];
      return new T.MeshStandardMaterial(o);
    }
    var mNacelle = std(0xdfe4e8, 0.25, 0.32), mLip = std(0xc9ced4, 1.0, 0.16), mCowl = std(0x8d969f, 0.85, 0.38);
    var mHub = std(0x4a525b, 0.9, 0.42), mSpinner = std(0x20242a, 0.6, 0.3), mSection = std(0xc2410c, 0.1, 0.6);
    var mFan = std(0x2a2f36, 0.75, 0.3, { transparent: true }), mOgv = std(0x9aa3ad, 0.9, 0.35);
    var mComp = std(0xa9b2bb, 0.95, 0.3), mHpcR = std(0x8b8f86, 0.95, 0.36);
    var mHpt = std(0x5b5650, 0.9, 0.45, { emissive: 0x000000 }), mLpt = std(0x6a665f, 0.9, 0.45, { emissive: 0x000000 });
    var mLiner = std(0x55504a, 0.8, 0.5, { emissive: 0x000000 });

    var eng = new T.Group(); eng.rotation.z = -Math.PI / 2; eng.position.x = -0.5 * LX; scene.add(eng);
    var lp = new T.Group(), hp = new T.Group(); eng.add(lp); eng.add(hp);
    var cutParts = [], fullParts = [];
    function V(a) { return a.map(function (q) { return new T.Vector2(q[1] * R, q[0] * LX); }); }
    // kapalı profilden dönel gövde; kesit modunda çeyrek dilim çıkarılır ve kesit yüzeyleri kapatılır
    function shell(loop, mat) {
      var pts = V(loop.concat([loop[0]]));
      var full = new T.Mesh(new T.LatheGeometry(pts, 96), mat); eng.add(full); fullParts.push(full);
      var grp = new T.Group(); grp.add(new T.Mesh(new T.LatheGeometry(pts, 72, 0, 1.5 * Math.PI), mat));
      var sh = new T.Shape(V(loop)), sg = new T.ShapeGeometry(sh);
      [0, 1.5 * Math.PI].forEach(function (phi) { var c = new T.Mesh(sg, mSection); c.rotation.y = phi - Math.PI / 2; grp.add(c); });
      eng.add(grp); cutParts.push(grp);
    }
    shell([[0.035, 1.0], [0.14, 1.0], [0.62, 0.93], [0.628, 0.95], [0.52, 1.10], [0.38, 1.18], [0.20, 1.21], [0.08, 1.185], [0.02, 1.13], [0.0, 1.07], [0.008, 1.025]], mNacelle);
    shell([[0.185, 0.56], [0.20, 0.60], [0.45, 0.61], [0.62, 0.59], [0.80, 0.56], [0.90, 0.50], [0.98, 0.385], [0.98, 0.37], [0.89, 0.46], [0.73, 0.40], [0.70, 0.35], [0.64, 0.32],
      [0.60, 0.345], [0.555, 0.34], [0.38, 0.30], [0.34, 0.44], [0.20, 0.52]], mCowl);
    // giriş dudağı (parlak metal halka)
    eng.add(new T.Mesh(new T.LatheGeometry(V([[0.036, 1.002], [0.008, 1.027], [-0.001, 1.07], [0.02, 1.132], [0.05, 1.165]]), 96), mLip));
    // iç gövde (diskler, yatak yuvaları, kuyruk konisi)
    eng.add(new T.Mesh(new T.LatheGeometry(V([[0.14, 0.0], [0.14, 0.30], [0.20, 0.34], [0.34, 0.30], [0.38, 0.16], [0.55, 0.25], [0.555, 0.20], [0.64, 0.24], [0.73, 0.28], [0.89, 0.26], [0.98, 0.10], [1.06, 0.0]]), 72), mHub));
    lp.add(new T.Mesh(new T.LatheGeometry(V([[0.052, 0.0], [0.062, 0.06], [0.085, 0.15], [0.112, 0.235], [0.142, 0.30]]), 48), mSpinner));

    // ---- fan kanatları: burulmalı, geniş veterli
    var NB = 18;
    (function () {
      var ns = 14, nc = 5, pos = [], idx = [], i, j, k;
      for (i = 0; i <= ns; i++) {
        var t = i / ns, r = (0.30 + 0.695 * t) * R, chord = (0.085 + 0.035 * t) * LX, beta = (22 + 42 * t) * Math.PI / 180;
        var y0 = (0.168 + 0.012 * t * t) * LX, lean = -0.10 * t * t;
        for (j = 0; j <= nc; j++) {
          var s = j / nc - 0.5, camber = 0.05 * chord * (1 - 4 * s * s);
          var dy = s * chord * Math.cos(beta), dx = s * chord * Math.sin(beta) + camber * Math.cos(beta), phi = dx / r + lean;
          pos.push(r * Math.sin(phi), y0 + dy, r * Math.cos(phi));
        }
      }
      for (i = 0; i < ns; i++) for (j = 0; j < nc; j++) { var a = i * (nc + 1) + j, b = a + 1, c = a + nc + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      for (k = 0; k < NB; k++) { var m = new T.Mesh(geo, mFan); m.rotation.y = k * 2 * Math.PI / NB; lp.add(m); }
    })();
    // dönüş bulanıklığı diski
    var blur = new T.Mesh(new T.RingGeometry(0.31 * R, 0.995 * R, 64), new T.MeshBasicMaterial({ color: 0x3a4048, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
    blur.rotation.x = -Math.PI / 2; blur.position.y = 0.172 * LX; eng.add(blur);

    // ---- kanat sıraları (InstancedMesh)
    var box = new T.BoxGeometry(1, 1, 1), dummy = new T.Object3D(), qa = new T.Quaternion(), qb = new T.Quaternion(), AY = new T.Vector3(0, 1, 0), AZ = new T.Vector3(0, 0, 1);
    function row(parent, mat, x, ri, ro, chord, stagger, count) {
      var im = new T.InstancedMesh(box, mat, count), rm = (ri + ro) / 2 * R, i;
      for (i = 0; i < count; i++) {
        var phi = i * 2 * Math.PI / count;
        dummy.position.set(rm * Math.sin(phi), x * LX, rm * Math.cos(phi));
        qa.setFromAxisAngle(AY, phi); qb.setFromAxisAngle(AZ, stagger); dummy.quaternion.copy(qa).multiply(qb);
        dummy.scale.set(Math.max(0.004, chord * 0.09), chord, (ro - ri) * R * 0.97);
        dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      }
      parent.add(im);
    }
    function stages(spool, matR, matS, xa, xb, ria, rib, roa, rob, n, turbine) {
      for (var i = 0; i < n; i++) [0.27, 0.75].forEach(function (u, k) {
        var f = (i + u) / n, x = xa + (xb - xa) * f, ri = ria + (rib - ria) * f, ro = roa + (rob - roa) * f;
        var rotor = turbine ? k === 1 : k === 0, chord = (xb - xa) / n * 0.36 * LX, rm = (ri + ro) / 2 * R;
        var cnt = Math.max(24, Math.min(96, Math.round(2 * Math.PI * rm / (chord * 0.75))));
        row(rotor ? spool : eng, rotor ? matR : matS, x, ri, ro, chord, (rotor ? 1 : -1) * (turbine ? -0.75 : 0.6), cnt);
      });
    }
    row(eng, mOgv, 0.285, 0.605, 0.975, 0.045 * LX, -0.18, 46);                            // fan çıkış kılavuz kanatları
    stages(lp, mComp, mOgv, 0.215, 0.335, 0.34, 0.30, 0.52, 0.44, g.nBoost, false);        // booster
    stages(hp, mHpcR, mComp, 0.385, 0.548, 0.16, 0.25, 0.30, 0.30, g.nHpc, false);         // HPC
    stages(hp, mHpt, mHpt, 0.645, 0.698, 0.24, 0.25, 0.32, 0.35, g.nHpt, true);            // HPT
    stages(lp, mLpt, mLpt, 0.735, 0.888, 0.28, 0.26, 0.40, 0.46, g.nLpt, true);            // LPT

    // ---- yanma odası: astar + alev
    eng.add(new T.Mesh(new T.LatheGeometry(V([[0.56, 0.215], [0.575, 0.235], [0.635, 0.25]]), 64), mLiner));
    var flame = new T.Mesh(new T.LatheGeometry(V([[0.565, 0.25], [0.585, 0.31], [0.615, 0.315], [0.638, 0.295], [0.638, 0.265], [0.60, 0.25], [0.565, 0.25]]), 64),
      new T.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    eng.add(flame);
    var flameLight = new T.PointLight(0xff8a3a, 0, 2.2 * R); flameLight.position.set(0.3 * R, 0.6 * LX, 0.3 * R); eng.add(flameLight);

    // ---- egzoz: sıcak çekirdek jeti (eklemeli, uzunluk boyunca sönen)
    var plume = (function () {
      var n = 24, pts = [], i;
      for (i = 0; i <= n; i++) { var t = i / n; pts.push(new T.Vector2((0.36 - 0.14 * t) * R, (0.985 + 0.6 * t) * LX)); }
      var geo = new T.LatheGeometry(pts, 40), col = [], p = geo.attributes.position;
      for (i = 0; i < p.count; i++) { var f = 1 - (p.getY(i) / LX - 0.985) / 0.6; f = Math.max(0, f); col.push(f * f, f * f, f * f); }
      geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      var m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xff9a55, vertexColors: true, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      eng.add(m); return m;
    })();

    // ---- zemin ızgarası (ölçek için 1 m aralık)
    var grid = new T.GridHelper(24, 24, 0x2a3440, 0x1a222b); grid.position.y = -1.5 * R; scene.add(grid);

    // ---- kamera
    var cam = { az: -0.72, el: 0.3, taz: -0.72, tel: 0.3, d: 7.2 };
    var VIEWS = { kesit: [-0.72, 0.3], on: [-1.25, 0.12], yan: [0, 0.16], arka: [2.2, 0.22] };
    function resize() {
      var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      cam.d = 7.0 * Math.max(1, 1.9 / camera.aspect);
    }
    resize(); if (root.ResizeObserver) new ResizeObserver(resize).observe(host); else root.addEventListener('resize', resize);
    var drag = null, el = renderer.domElement; el.style.touchAction = 'pan-y'; el.style.cursor = 'grab';
    el.addEventListener('pointerdown', function (e) { drag = [e.clientX, e.clientY]; try { el.setPointerCapture(e.pointerId); } catch (x) {} });
    el.addEventListener('pointermove', function (e) {
      if (!drag) return;
      cam.taz -= (e.clientX - drag[0]) * 0.007; if (e.pointerType !== 'touch') cam.tel = Math.max(-0.25, Math.min(1.2, cam.tel + (e.clientY - drag[1]) * 0.005));
      drag = [e.clientX, e.clientY];
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { el.addEventListener(n, function () { drag = null; }); });

    var cut = true, angL = 0, angH = 0;
    function setCut(v) { cut = v; cutParts.forEach(function (p) { p.visible = v; }); fullParts.forEach(function (p) { p.visible = !v; }); }
    setCut(true);
    function glow(mat, Tk, gain) {                          // akkor ışıma: ~800 K altında görünmez
      var k = Math.max(0, Math.min(1, (Tk - 800) / 800)); k = k * k * gain;
      mat.emissive.setRGB(1.0 * k, (0.16 + 0.45 * k) * k, 0.03 * k);
    }
    function update(o, dt, lit) {
      var rpsL = o.NL * g.rpmL / 60, rpsH = o.NH * g.rpmH / 60;
      // gerçek devirde kanatlar ekran yenilemesinde seçilemez; görsel hız doygunlaştırılır, fark bulanıklıkla verilir
      angL += dt * 2 * Math.PI * 1.6 * Math.tanh(rpsL / 9); angH -= dt * 2 * Math.PI * 0.35 * Math.tanh(rpsH / 60);
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
      cam.az += (cam.taz - cam.az) * Math.min(1, dt * 6); cam.el += (cam.tel - cam.el) * Math.min(1, dt * 6);
      camera.position.set(cam.d * Math.sin(cam.az) * Math.cos(cam.el), cam.d * Math.sin(cam.el) + 0.05, cam.d * Math.cos(cam.az) * Math.cos(cam.el));
      camera.lookAt(0.05, -0.08, 0);
      renderer.render(scene, camera);
    }
    return { update: update, setCut: setCut, isCut: function () { return cut; }, setView: function (n) { var v = VIEWS[n]; if (v) { cam.taz = v[0]; cam.tel = v[1]; } } };
  }
  root.Engine3D = Engine3D;
})(typeof self !== 'undefined' ? self : this);
