/*
 * MB-120 "Toros" — iki makaralı, ayrık akışlı, yüksek baypas oranlı turbofan
 * Ön tasarım ve performans modeli (0-B, bileşen tabanlı).
 *
 * Kapsam:
 *   - ISA atmosfer, sıcaklığa bağlı gaz özellikleri (hava + kerosen yanma ürünleri)
 *   - Tasarım noktası çevrim analizi (soğutma havası, kayıplar, güç çekişi dahil)
 *   - Tasarım dışı (off-design) eşleşme: sabit türbin kapasitesi + sabit lüle alanı
 *   - Makara dinamiği ile geçici rejim (transient) simülasyonu ve yakıt kontrolü
 *   - Ortalama-hat ön boyutlandırma (çaplar, devirler, kademe sayıları)
 *
 * Aynı dosya hem Node (test/rapor) hem tarayıcı (simülatör) tarafından kullanılır.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EngineModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- Gaz modeli
  // cp polinomları: Walsh & Fletcher, "Gas Turbine Performance" (kJ/kg.K, TZ = T/1000)
  var A = [0.992313, 0.236688, -1.852148, 6.083152, -8.893933, 7.097112, -3.234725, 0.794571, -0.081873];
  var B = [-0.718874, 8.747481, -15.863157, 17.254096, -10.233795, 3.081778, -0.361112, -0.003919];
  var R = 287.05;        // J/kg.K
  var TREF = 298.15;     // K, entalpi referansı
  var LHV = 43.1e6;      // J/kg, Jet-A alt ısıl değeri
  var G0 = 9.80665;

  function xOf(f) { return f / (1 + f); }
  function cp(T, f) {
    var z = T / 1000, a = 0, b = 0, i;
    for (i = A.length - 1; i >= 0; i--) a = a * z + A[i];
    if (f > 0) { for (i = B.length - 1; i >= 0; i--) b = b * z + B[i]; }
    return 1000 * (a + xOf(f) * b);
  }
  function hRaw(T, f) {            // ∫cp dT (J/kg), sabit hariç
    var z = T / 1000, a = 0, b = 0, i;
    for (i = A.length - 1; i >= 0; i--) a = a * z + A[i] / (i + 1);
    if (f > 0) { for (i = B.length - 1; i >= 0; i--) b = b * z + B[i] / (i + 1); }
    return 1e6 * z * (a + xOf(f) * b);
  }
  function h(T, f) { return hRaw(T, f) - hRaw(TREF, f); }
  function phi(T, f) {             // ∫cp/T dT (J/kg.K)
    var z = T / 1000, a = 0, b = 0, i;
    for (i = A.length - 1; i >= 1; i--) a = a * z + A[i] / i;
    a = a * z + A[0] * Math.log(z);
    if (f > 0) {
      for (i = B.length - 1; i >= 1; i--) b = b * z + B[i] / i;
      b = b * z + B[0] * Math.log(z);
    }
    return 1000 * (a + xOf(f) * b);
  }
  function gamma(T, f) { var c = cp(T, f); return c / (c - R); }
  function TfromH(hv, f, Tg) {
    var T = Tg || 800, i, d;
    for (i = 0; i < 40; i++) { d = (h(T, f) - hv) / cp(T, f); T -= d; if (Math.abs(d) < 1e-7) break; }
    return T;
  }
  function TfromPhi(pv, f, Tg) {
    var T = Tg || 800, i, d;
    for (i = 0; i < 40; i++) { d = (phi(T, f) - pv) * T / cp(T, f); T -= d; if (Math.abs(d) < 1e-7) break; }
    return T;
  }
  function entropy(T, P, f) { return phi(T, f) - phi(288.15, 0) - R * Math.log(P / 101325); }

  // ---------------------------------------------------------------- Atmosfer
  function isa(alt, dT) {
    var T, P;
    if (alt <= 11000) { T = 288.15 - 0.0065 * alt; P = 101325 * Math.pow(T / 288.15, 5.25588); }
    else { T = 216.65; P = 22632.06 * Math.exp(-G0 * (alt - 11000) / (R * 216.65)); }
    return { T: T + (dT || 0), P: P };
  }

  // ---------------------------------------------------------------- Yardımcılar
  function bisect(fn, lo, hi, n) {
    var flo = fn(lo), fhi = fn(hi), i, mid, fm;
    if (flo > 0) return lo;
    if (fhi < 0) return hi;
    for (i = 0; i < (n || 40); i++) {
      mid = 0.5 * (lo + hi); fm = fn(mid);
      if (fm > 0) hi = mid; else lo = mid;
      if (hi - lo < 1e-9 * (1 + Math.abs(mid))) break;
    }
    return 0.5 * (lo + hi);
  }

  // Yakınsak lüle: verilen toplam koşul ve ortam basıncı için birim alan debisi, hız, statik koşullar
  function nozzle(Pt, Tt, f, Pamb) {
    var ht = h(Tt, f), pt = phi(Tt, f);
    var pr = Math.max(Pt / Pamb, 1.0000001);
    var Ts = TfromPhi(pt - R * Math.log(pr), f, Tt * 0.9);
    var V = Math.sqrt(Math.max(2 * (ht - h(Ts, f)), 0));
    var a = Math.sqrt(gamma(Ts, f) * R * Ts);
    var Ps = Pamb, choked = false;
    if (V > a) {                    // boğulmuş: boğazda M = 1
      choked = true;
      Ts = bisect(function (T) { return gamma(T, f) * R * T - 2 * (ht - h(T, f)); }, Tt * 0.7, Tt, 50);
      V = Math.sqrt(gamma(Ts, f) * R * Ts);
      Ps = Pt * Math.exp((phi(Ts, f) - pt) / R);
    }
    return { V: V, Ts: Ts, Ps: Ps, choked: choked, flux: Ps / (R * Ts) * V, M: choked ? 1 : V / a };
  }

  // Kompresör: verilen özgül iş ve izentropik verim -> çıkış
  function compress(Tin, Pin, dh, eta) {
    var h1 = h(Tin, 0), T2 = TfromH(h1 + dh, 0, Tin + dh / 1005);
    var T2s = TfromH(h1 + eta * dh, 0, Tin + eta * dh / 1005);
    return { T: T2, P: Pin * Math.exp((phi(T2s, 0) - phi(Tin, 0)) / R) };
  }
  // Tasarım: verilen basınç oranı ve politropik verim -> iş ve izentropik verim
  function compressDesign(Tin, PR, etaP) {
    var T2 = TfromPhi(phi(Tin, 0) + R * Math.log(PR) / etaP, 0, Tin * Math.pow(PR, 0.3));
    var T2s = TfromPhi(phi(Tin, 0) + R * Math.log(PR), 0, Tin * Math.pow(PR, 0.28));
    var dh = h(T2, 0) - h(Tin, 0);
    return { T: T2, dh: dh, eta: (h(T2s, 0) - h(Tin, 0)) / dh };
  }
  // Türbin: verilen genişleme oranı ve izentropik verim -> çıkış
  function expand(Tin, f, ER, eta) {
    var Ts = TfromPhi(phi(Tin, f) - R * Math.log(ER), f, Tin * Math.pow(ER, -0.22));
    var hin = h(Tin, f), hout = hin - eta * (hin - h(Ts, f));
    return { T: TfromH(hout, f, Ts), dh: hin - hout };
  }
  // İki akışın karışımı (kütle ve enerji korunumu, bileşim dahil)
  function mix(W1, T1, f1, W2, T2, f2) {
    var W = W1 + W2;
    var x = (W1 * xOf(f1) + W2 * xOf(f2)) / W, f = x / (1 - x);
    var hm = (W1 * hRaw(T1, f1) + W2 * hRaw(T2, f2)) / W;
    // hRaw bileşimde doğrusal olduğundan karışım entalpisi doğrudan hedeflenir
    var T = (W1 * T1 + W2 * T2) / W, i, d;
    for (i = 0; i < 40; i++) { d = (hRaw(T, f) - hm) / cp(T, f); T -= d; if (Math.abs(d) < 1e-7) break; }
    return { W: W, T: T, f: f };
  }
  // Yanma odası: verilen T3, T4 için yakıt/hava oranı
  function burnerFAR(T3, T4, etaB) {
    var f = 0.02, i, h3 = h(T3, 0);
    for (i = 0; i < 30; i++) {
      var fn = (h(T4, f) - h3) / (etaB * LHV - h(T4, f));
      if (Math.abs(fn - f) < 1e-10) { f = fn; break; }
      f = fn;
    }
    return f;
  }

  // ---------------------------------------------------------------- Tasarım girdileri
  var SPEC = {
    name: 'MB-120 Toros',
    // Tasarım noktası: tırmanış sonu (Top of Climb)
    alt: 10668, mach: 0.78, dTisa: 0,
    FnReq: 26500,          // N, tırmanış sonu net itki gereksinimi
    BPR: 10.0,
    FPR: 1.50,             // fan dış (baypas) basınç oranı
    LPR: 2.60,             // fan kökü + booster toplam basınç oranı
    HPR: 16.5,             // HPC basınç oranı
    T4: 1720,              // K, tasarım noktası yanma odası çıkış sıcaklığı
    T4max: 1850,           // K, kalkış sınırı
    etaPfan: 0.925, etaPlpc: 0.905, etaPhpc: 0.905, etaPhpt: 0.885, etaPlpt: 0.915,
    etaB: 0.9995, etaM: 0.995,
    piInlet: 0.997, piBypass: 0.985, piIcd: 0.985, piB: 0.955, piItd: 0.99, piTail: 0.99,
    cvNozzle: 0.995,
    bNgv: 0.09, bRot: 0.06, bBleed: 0.01,   // HPC çıkışından, çekirdek debisinin kesri
    pOff: 60e3,            // W, HP makaradan güç çekişi
    // Mekanik
    utipFan: 395, htFan: 0.30, mFan: 0.62,        // m/s, göbek/uç, eksenel Mach
    utipHpc: 450, htHpc: 0.56, mHpc: 0.48,
    iL: 95, iH: 9.5,       // kg.m², makara kutupsal atalet momentleri
    kEtaFan: 0.30, kEtaLpc: 0.35, kEtaHpc: 0.40,  // hız dışı verim düşümü katsayıları
    n1Max: 1.04, n2Max: 1.035,
    smDes: 0.25, smExp: 1.42, smMin: 0.05,  // HPC tasarım pompaj payı ve pompaj hattı üssü
    kp: 5.0, ki: 5.0        // N1 denetleyici kazançları (azami yakıt debisine göre ölçekli)
  };

  // ---------------------------------------------------------------- Tasarım noktası
  function design(specIn) {
    var s = {}, k;
    for (k in SPEC) s[k] = SPEC[k];
    if (specIn) for (k in specIn) s[k] = specIn[k];

    var amb = isa(s.alt, s.dTisa);
    var V0 = s.mach * Math.sqrt(gamma(amb.T, 0) * R * amb.T);
    var Tt0 = TfromH(h(amb.T, 0) + V0 * V0 / 2, 0, amb.T * 1.1);
    var Pt0 = amb.P * Math.exp((phi(Tt0, 0) - phi(amb.T, 0)) / R);
    var Tt2 = Tt0, Pt2 = Pt0 * s.piInlet;

    // birim çekirdek debisi (W25 = 1) ile hesap, sonra itkiye göre ölçekleme
    var fan = compressDesign(Tt2, s.FPR, s.etaPfan);
    var lpc = compressDesign(Tt2, s.LPR, s.etaPlpc);
    var Pt13 = Pt2 * s.FPR, Pt18 = Pt13 * s.piBypass;
    var Pt25 = Pt2 * s.LPR * s.piIcd;
    var hpc = compressDesign(lpc.T, s.HPR, s.etaPhpc);
    var Pt3 = Pt25 * s.HPR, Tt3 = hpc.T;
    var Pt4 = Pt3 * s.piB;
    var f4 = burnerFAR(Tt3, s.T4, s.etaB);
    var wb = 1 - s.bNgv - s.bRot - s.bBleed;         // yanma odası havası
    var wf = f4 * wb, w4 = wb + wf;
    var m41 = mix(w4, s.T4, f4, s.bNgv, Tt3, 0);

    function turbDesign(W, Tin, f, dhReq, etaP) {
      var Tout = TfromH(h(Tin, f) - dhReq, f, Tin - dhReq / 1150);
      var ER = Math.exp((phi(Tin, f) - phi(Tout, f)) / (etaP * R));
      var Ts = TfromPhi(phi(Tin, f) - R * Math.log(ER), f, Tout);
      return { T: Tout, ER: ER, eta: dhReq / (h(Tin, f) - h(Ts, f)) };
    }

    // itki W ile doğrusal; güç çekişi nedeniyle küçük bir sabit-nokta yinelemesi
    var W25 = 20, out, it;
    for (it = 0; it < 30; it++) {
      var dhH = (hpc.dh + s.pOff / W25) / s.etaM / m41.W;
      var hpt = turbDesign(m41.W, m41.T, m41.f, dhH, s.etaPhpt);
      var Pt44 = Pt4 / hpt.ER;
      var m45 = mix(m41.W, hpt.T, m41.f, s.bRot, Tt3, 0);
      var Pt45 = Pt44 * s.piItd;
      var dhL = (s.BPR * fan.dh + lpc.dh) / s.etaM / m45.W;
      var lpt = turbDesign(m45.W, m45.T, m45.f, dhL, s.etaPlpt);
      var Pt5 = Pt45 / lpt.ER, Pt8 = Pt5 * s.piTail;
      var n8 = nozzle(Pt8, lpt.T, m45.f, amb.P), n18 = nozzle(Pt18, fan.T, 0, amb.P);
      var fSpec = s.BPR * (s.cvNozzle * n18.V + (n18.Ps - amb.P) / n18.flux)
        + m45.W * (s.cvNozzle * n8.V + (n8.Ps - amb.P) / n8.flux) - (1 + s.BPR) * V0;
      var Wn = s.FnReq / fSpec;
      out = { hpt: hpt, lpt: lpt, m45: m45, Pt45: Pt45, n8: n8, n18: n18 };
      if (Math.abs(Wn - W25) < 1e-9 * Wn) { W25 = Wn; break; }
      W25 = Wn;
    }

    var d = { spec: s };
    d.dhFan = fan.dh; d.dhLpc = lpc.dh; d.dhHpc = hpc.dh;
    d.etaFan = fan.eta; d.etaLpc = lpc.eta; d.etaHpc = hpc.eta;
    d.etaHpt = out.hpt.eta; d.etaLpt = out.lpt.eta;
    d.kHpt = W25 * w4 * Math.sqrt(s.T4) / Pt4;
    d.kLpt = W25 * out.m45.W * Math.sqrt(out.m45.T) / out.Pt45;
    d.A8 = W25 * out.m45.W / out.n8.flux;
    d.A18 = W25 * s.BPR / out.n18.flux;
    d.Tt2 = Tt2; d.Tt25 = lpc.T;
    d.W25 = W25; d.W2 = W25 * (1 + s.BPR);

    // ---- ortalama-hat ön boyutlandırma
    function annulus(W, Tt, Pt, M, ht) {
      var Ts = bisect(function (T) { return M * M * gamma(T, 0) * R * T - 2 * (h(Tt, 0) - h(T, 0)); }, Tt * 0.6, Tt, 60);
      var Ps = Pt * Math.exp((phi(Ts, 0) - phi(Tt, 0)) / R);
      var V = M * Math.sqrt(gamma(Ts, 0) * R * Ts);
      var area = W / (Ps / (R * Ts) * V);
      var Dt = Math.sqrt(4 * area / (Math.PI * (1 - ht * ht)));
      return { area: area, Dt: Dt, Dh: Dt * ht };
    }
    var g = {};
    g.fan = annulus(d.W2, Tt2, Pt2, s.mFan, s.htFan);
    g.rpmL = s.utipFan / (Math.PI * g.fan.Dt) * 60;
    g.hpc = annulus(W25, lpc.T, Pt25, s.mHpc, s.htHpc);
    g.rpmH = s.utipHpc / (Math.PI * g.hpc.Dt) * 60;
    var umHpc = s.utipHpc * (1 + s.htHpc) / 2 * 1.04;       // ortalama yarıçap arkaya doğru hafif artar
    g.nHpc = Math.ceil(hpc.dh / (0.38 * umHpc * umHpc));
    var rmBoost = g.fan.Dt * 0.5 * 0.46, umBoost = rmBoost * g.rpmL * Math.PI / 30;
    var dhBoost = lpc.dh - 0.80 * fan.dh;                   // fan kökü, dış akım işinin ~%80'ini verir
    g.nBoost = Math.ceil(dhBoost / (0.50 * umBoost * umBoost));
    var rmHpt = g.hpc.Dt * 0.5 * 1.10, umHpt = rmHpt * g.rpmH * Math.PI / 30;
    g.nHpt = Math.ceil(((hpc.dh + s.pOff / W25) / s.etaM / m41.W) / (2.0 * umHpt * umHpt));
    var rmLpt = g.fan.Dt * 0.5 * 0.50, umLpt = rmLpt * g.rpmL * Math.PI / 30;
    g.nLpt = Math.ceil(((s.BPR * fan.dh + lpc.dh) / s.etaM / out.m45.W) / (2.2 * umLpt * umLpt));
    g.rmHpt = rmHpt; g.rmLpt = rmLpt; g.umHpt = umHpt; g.umLpt = umLpt;
    g.A8 = d.A8; g.A18 = d.A18;
    g.length = g.fan.Dt * 1.72;
    d.geom = g;
    d.omegaL = g.rpmL * Math.PI / 30; d.omegaH = g.rpmH * Math.PI / 30;
    // HPC pompaj (surge) hattı: jenerik harita yaklaşımı. Tasarım noktasında %25 pay,
    // düşük düzeltilmiş debide daralan pay. Üs, değişken stator kanatları ve tahliye valfinin
    // düşük hızda sağladığı ek payı içerecek şekilde seçilmiştir.
    d.wcHpcDes = W25 * Math.sqrt(lpc.T / 288.15) / (Pt25 / 101325);
    d.prSurgeDes = s.HPR * (1 + s.smDes);
    return d;
  }

  function surgePR(d, wc) { return 1 + (d.prSurgeDes - 1) * Math.pow(Math.max(wc, 1e-6) / d.wcHpcDes, d.spec.smExp); }

  // ---------------------------------------------------------------- Akış çözümü
  // Verilen makara hızları (tasarıma göre bağıl) ve T4 ya da yakıt debisi için tüm istasyonlar.
  // Sürekli rejimde iki makaranın güç dengesizliği (dPL, dPH) sıfırdır.
  function flow(d, NL, NH, fc, ctl) {
    var s = d.spec;
    var amb = isa(fc.alt, fc.dTisa);
    var a0 = Math.sqrt(gamma(amb.T, 0) * R * amb.T), V0 = fc.mach * a0;
    var Tt2 = TfromH(h(amb.T, 0) + V0 * V0 / 2, 0, amb.T * 1.05);
    var Pt2 = amb.P * Math.exp((phi(Tt2, 0) - phi(amb.T, 0)) / R) * s.piInlet;

    var ncL = NL / Math.sqrt(Tt2 / d.Tt2);
    var eFan = d.etaFan * (1 - s.kEtaFan * (1 - ncL) * (1 - ncL));
    var eLpc = d.etaLpc * (1 - s.kEtaLpc * (1 - ncL) * (1 - ncL));
    var c13 = compress(Tt2, Pt2, d.dhFan * NL * NL, eFan);
    var c25 = compress(Tt2, Pt2, d.dhLpc * NL * NL, eLpc);
    var Pt18 = c13.P * s.piBypass, Pt25 = c25.P * s.piIcd;
    var ncH = NH / Math.sqrt(c25.T / d.Tt25);
    var eHpc = d.etaHpc * (1 - s.kEtaHpc * (1 - ncH) * (1 - ncH));
    var c3 = compress(c25.T, Pt25, d.dhHpc * NH * NH, eHpc);
    var Tt3 = c3.T, Pt3 = c3.P, Pt4 = Pt3 * s.piB;
    var wb = 1 - s.bNgv - s.bRot - s.bBleed;

    // HPT kılavuz kanat boğazı boğulmuş: W4·√T4/P4 = sabit -> çekirdek debisi
    function core(T4) {
      var f = burnerFAR(Tt3, T4, s.etaB);
      var W4 = d.kHpt * Pt4 / Math.sqrt(T4);
      var Wb = W4 / (1 + f);
      return { f: f, W4: W4, W25: Wb / wb, Wf: f * Wb };
    }
    var T4, c;
    if (ctl.T4 != null) { T4 = ctl.T4; c = core(T4); }
    else {
      T4 = bisect(function (T) { return core(T).Wf - ctl.Wf; }, Tt3 + 30, 2600, 45);
      c = core(T4);
    }
    var W25 = c.W25;
    var m41 = mix(c.W4, T4, c.f, s.bNgv * W25, Tt3, 0);

    // LPT kılavuz kanat kapasitesi HPT genişleme oranını belirler
    var e44, m45, Pt45;
    var erH = bisect(function (er) {
      e44 = expand(m41.T, m41.f, er, d.etaHpt);
      m45 = mix(m41.W, e44.T, m41.f, s.bRot * W25, Tt3, 0);
      Pt45 = Pt4 / er * s.piItd;
      return m45.W * Math.sqrt(m45.T) / Pt45 - d.kLpt;
    }, 1.02, 14, 45);
    e44 = expand(m41.T, m41.f, erH, d.etaHpt);
    m45 = mix(m41.W, e44.T, m41.f, s.bRot * W25, Tt3, 0);
    Pt45 = Pt4 / erH * s.piItd;

    // Çekirdek lülesi sürekliliği LPT genişleme oranını belirler
    var e5, n8, Pt8;
    var erMax = Math.max(Pt45 * s.piTail / amb.P, 1.001);
    var erL = bisect(function (er) {
      e5 = expand(m45.T, m45.f, er, d.etaLpt);
      Pt8 = Pt45 / er * s.piTail;
      n8 = nozzle(Pt8, e5.T, m45.f, amb.P);
      return m45.W - n8.flux * d.A8;
    }, 1.0, erMax, 45);
    e5 = expand(m45.T, m45.f, erL, d.etaLpt);
    Pt8 = Pt45 / erL * s.piTail;
    n8 = nozzle(Pt8, e5.T, m45.f, amb.P);

    var n18 = nozzle(Pt18, c13.T, 0, amb.P);
    var W18 = n18.flux * d.A18, W2 = W18 + W25;

    var h2 = h(Tt2, 0), h25 = h(c25.T, 0);
    var pFan = W18 * (h(c13.T, 0) - h2) + W25 * (h25 - h2);
    var pHpc = W25 * (h(Tt3, 0) - h25);
    var pHpt = m41.W * e44.dh, pLpt = m45.W * e5.dh;
    var F18 = W18 * n18.V * s.cvNozzle + (n18.Ps - amb.P) * d.A18;
    var F8 = m45.W * n8.V * s.cvNozzle + (n8.Ps - amb.P) * d.A8;
    var Fn = F18 + F8 - W2 * V0;
    // verimler için tam genleşmiş eşdeğer jet hızları (brüt itki / debi)
    var keJet = 0.5 * (F18 * F18 / W18 + F8 * F8 / m45.W);

    return {
      NL: NL, NH: NH, ncL: ncL, ncH: ncH, T4: T4, Wf: c.Wf, far: c.f,
      W2: W2, W25: W25, W18: W18, BPR: W18 / W25,
      FPR: c13.P / Pt2, LPR: c25.P / Pt2, HPR: Pt3 / Pt25, OPR: Pt3 / Pt2,
      erH: erH, erL: erL,
      dPL: pLpt * s.etaM - pFan, dPH: pHpt * s.etaM - pHpc - s.pOff,
      pFan: pFan, pHpc: pHpc, pHpt: pHpt, pLpt: pLpt,
      Fn: Fn, Fg: F18 + F8, F18: F18, F8: F8, V0: V0,
      tsfc: c.Wf / Fn,                               // kg/(N.s)
      V8: n8.V, V18: n18.V, choked8: n8.choked, choked18: n18.choked,
      wcHpc: W25 * Math.sqrt(c25.T / 288.15) / (Pt25 / 101325),
      wcFan: W2 * Math.sqrt(Tt2 / 288.15) / (Pt2 / 101325),
      wfP3: c.Wf / Pt3,
      smHpc: surgePR(d, W25 * Math.sqrt(c25.T / 288.15) / (Pt25 / 101325)) / (Pt3 / Pt25) - 1,
      amb: amb,
      etaTh: (keJet - 0.5 * W2 * V0 * V0) / (c.Wf * LHV),
      etaProp: Fn * V0 / Math.max(keJet - 0.5 * W2 * V0 * V0, 1e-9),
      st: [
        { id: '0', ad: 'Serbest akım', T: amb.T, P: amb.P, W: W2, f: 0 },
        { id: '2', ad: 'Fan girişi', T: Tt2, P: Pt2, W: W2, f: 0 },
        { id: '13', ad: 'Fan çıkışı (baypas)', T: c13.T, P: c13.P, W: W18, f: 0 },
        { id: '25', ad: 'HPC girişi', T: c25.T, P: Pt25, W: W25, f: 0 },
        { id: '3', ad: 'HPC çıkışı', T: Tt3, P: Pt3, W: W25, f: 0 },
        { id: '4', ad: 'Yanma odası çıkışı', T: T4, P: Pt4, W: c.W4, f: c.f },
        { id: '41', ad: 'HPT rotor girişi', T: m41.T, P: Pt4, W: m41.W, f: m41.f },
        { id: '45', ad: 'LPT girişi', T: m45.T, P: Pt45, W: m45.W, f: m45.f },
        { id: '5', ad: 'LPT çıkışı', T: e5.T, P: Pt45 / erL, W: m45.W, f: m45.f },
        { id: '8', ad: 'Çekirdek lülesi', T: e5.T, P: Pt8, W: m45.W, f: m45.f },
        { id: '18', ad: 'Baypas lülesi', T: c13.T, P: Pt18, W: W18, f: 0 }
      ]
    };
  }

  // ---------------------------------------------------------------- Sürekli rejim
  // Verilen T4 için güç dengesini sağlayan (NL, NH): sönümlü Newton
  function steadyT4(d, fc, T4, guess) {
    var x = guess ? [guess.NL, guess.NH] : [1, 1], it, r, i;
    function res(v) { var o = flow(d, v[0], v[1], fc, { T4: T4 }); return [o.dPL / o.pFan, o.dPH / o.pHpc, o]; }
    for (it = 0; it < 40; it++) {
      r = res(x);
      if (Math.abs(r[0]) + Math.abs(r[1]) < 2e-7) break;
      var e = 1e-4, ra = res([x[0] + e, x[1]]), rb = res([x[0], x[1] + e]);
      var j11 = (ra[0] - r[0]) / e, j21 = (ra[1] - r[1]) / e, j12 = (rb[0] - r[0]) / e, j22 = (rb[1] - r[1]) / e;
      var det = j11 * j22 - j12 * j21;
      var dx = [(-r[0] * j22 + r[1] * j12) / det, (-r[1] * j11 + r[0] * j21) / det];
      var sc = Math.min(1, 0.08 / Math.max(Math.abs(dx[0]), Math.abs(dx[1]), 1e-12));
      for (i = 0; i < 2; i++) x[i] = Math.min(1.3, Math.max(0.15, x[i] + sc * dx[i]));
    }
    r = res(x);
    r[2].converged = Math.abs(r[0]) + Math.abs(r[1]) < 1e-5;
    return r[2];
  }
  // Bir çıktı (ör. NL, NH, Fn) hedefine göre T4 arama (sekant)
  function steadyTarget(d, fc, key, target, T4guess, guess) {
    var t0 = T4guess || 1500, o0 = steadyT4(d, fc, t0, guess);
    var t1 = t0 + (o0[key] < target ? 40 : -40), o1 = steadyT4(d, fc, t1, o0), i;
    for (i = 0; i < 30; i++) {
      if (Math.abs(o1[key] - target) < 1e-6 * Math.abs(target) + 1e-9) break;
      var sl = (o1[key] - o0[key]) / (t1 - t0);
      if (!isFinite(sl) || sl === 0) break;
      var tn = t1 + Math.max(-120, Math.min(120, (target - o1[key]) / sl));
      tn = Math.max(700, Math.min(2100, tn));
      t0 = t1; o0 = o1; t1 = tn; o1 = steadyT4(d, fc, t1, o0);
    }
    return o1;
  }
  // Uçuş koşulunda azami anma (T4, N1, N2 sınırlarının en kısıtlayıcısı) ve rölanti
  function ratings(d, fc) {
    var s = d.spec;
    var mx = steadyT4(d, fc, s.T4max), lim = 'T4';
    if (mx.ncL > 1.0) { mx = steadyTarget(d, fc, 'ncL', 1.0, mx.T4 - 60, mx); lim = 'N1 (düzeltilmiş)'; }
    if (mx.NL > s.n1Max) { mx = steadyTarget(d, fc, 'NL', s.n1Max, mx.T4 - 40, mx); lim = 'N1'; }
    if (mx.NH > s.n2Max) { mx = steadyTarget(d, fc, 'NH', s.n2Max, mx.T4 - 40, mx); lim = 'N2'; }
    var nhIdle = 0.70 + 0.10 * Math.min(fc.alt, 11000) / 11000;
    var id = steadyTarget(d, fc, 'NH', nhIdle, 1150, { NL: 0.45, NH: nhIdle });
    return { max: mx, idle: id, limiter: lim };
  }

  // ---------------------------------------------------------------- Geçici rejim
  // Durum: makara hızları + yakıt debisi. Kontrol: N1 talebine PI denetim,
  // Wf/P3 hızlanma-yavaşlama çizelgeleri, T4 ve N2 üst sınırları.
  // Rölanti altı (çalıştırma, durdurma, rüzgâr değirmeni) için ayrı bir yarı-ampirik model kullanılır;
  // çünkü harita tabanlı olmayan çevrim çözücüsü rölanti altında geçerli değildir.
  function Sim(d, fc, start) {
    this.d = d; this.fc = fc; this.t = 0; this.limiter = '';
    this.master = true;            // motor ana şalteri (yakıt + ateşleme)
    this.protect = true;           // hızlanma çizelgesi ve T4 sınırlayıcısı etkin
    this.surgeT = 0; this.surgeCount = 0; this.surgeNow = false;
    this.setFlight(fc);
    if (start) { this.mode = 'run'; this.NL = start.NL; this.NH = start.NH; this.Wf = start.Wf; this.integ = start.Wf; this.out = start; this.egt = start.st[7].T; }
    else { this.mode = 'sub'; this.master = false; this.NL = 0; this.NH = 0; this.Wf = 0; this.integ = 0; this.lit = false; this.litT = 0; this.egt = this.rt.idle.st[1].T; this.out = this.subOut(); }
  }
  Sim.prototype.setFlight = function (fc) {
    this.fc = fc;
    this.rt = ratings(this.d, fc);
    // hızlanma/yavaşlama çizelgeleri: sürekli rejim Wf/P3 değerinin üstünde/altında pay
    this.ruMax = this.rt.max.wfP3 * 1.17;
    this.ruMin = this.rt.idle.wfP3 * 0.62;
  };
  Sim.prototype.n1Demand = function (pla) {
    var a = this.rt.idle.NL, b = this.rt.max.NL;
    return a + (b - a) * Math.max(0, Math.min(1, pla));
  };
  Sim.prototype.phase = function () {
    if (this.mode === 'run') return this.surgeT > 0 ? 'POMPAJ' : 'ÇALIŞIYOR';
    if (this.master) return this.lit ? 'ÇALIŞTIRMA · ateşleme' : (this.NH < 0.2 ? 'ÇALIŞTIRMA · marş' : 'ÇALIŞTIRMA · yakıt');
    return this.NH > 0.02 || this.NL > 0.02 ? (this.fc.mach > 0.1 && this.NH < 0.25 ? 'RÜZGÂR DEĞİRMENİ' : 'DURUYOR · yavaşlama') : 'KAPALI';
  };
  // Rölanti altı çıktılar: rölanti noktasından hız oranına göre ölçeklenir
  Sim.prototype.subOut = function () {
    var id = this.rt.idle, r = this.NH / id.NH, rl = this.NL / id.NL, o = {}, k;
    for (k in id) o[k] = id[k];
    var T2 = id.st[1].T, P2 = id.st[1].P, hotK = (this.egt - T2) / (id.st[7].T - T2);
    var pk = Math.pow(Math.max(r, 0), 2.5), tk = r * r;
    o.st = id.st.map(function (x, i) {
      var hot = i >= 5 && i <= 9, cold = i === 3 || i === 4;
      return { id: x.id, ad: x.ad, f: hot ? x.f : 0,
        T: i < 2 ? x.T : T2 + (x.T - T2) * (hot ? hotK : (i === 2 || i === 10 ? rl * rl : tk)),
        P: i < 1 ? x.P : P2 + (x.P - P2) * (i === 2 || i === 10 ? rl * rl : pk),
        W: x.W * (cold || hot ? Math.max(r, 0) : Math.max(rl, 0)) };
    });
    o.NL = this.NL; o.NH = this.NH; o.Wf = this.Wf; o.T4 = o.st[5].T;
    o.W2 = id.W2 * Math.max(rl, 0); o.W25 = id.W25 * Math.max(r, 0); o.W18 = o.W2 - o.W25;
    o.BPR = o.W25 > 1e-6 ? o.W18 / o.W25 : id.BPR;
    o.OPR = o.st[4].P / P2; o.HPR = o.st[4].P / o.st[3].P; o.FPR = o.st[2].P / P2;
    o.wcHpc = id.wcHpc * Math.pow(Math.max(r, 1e-3), 1.2);
    o.smHpc = surgePR(this.d, o.wcHpc) / o.HPR - 1;
    o.Fn = this.lit ? id.Fn * rl * rl : 0.6 * id.Fn * rl * rl - 0.12 * o.W2 * id.V0;   // sönükken: soğuk fan itkisi − rüzgâr değirmeni sürüklemesi
    o.tsfc = o.Fn > 1 ? o.Wf / o.Fn : NaN;
    o.V8 = id.V8 * Math.max(r, 0); o.V18 = id.V18 * Math.max(rl, 0);
    o.sub = true;
    return o;
  };
  Sim.prototype.stepSub = function (dt) {
    var id = this.rt.idle, m = this.fc.mach;
    var nhW = 0.17 * Math.min(1, m / 0.8), nlW = 0.36 * Math.min(1, m / 0.8);   // rüzgâr değirmeni hızları
    var dn = -(0.035 + 0.25 * this.NH) * (this.NH - nhW);                       // aerodinamik + yatak sürüklemesi
    var starter = this.master && this.NH < 0.5;
    if (starter) dn += 0.045 * (1 - this.NH / 0.6);                             // hava türbinli marş motoru
    if (this.master && !this.lit && this.NH >= 0.2) { this.litT += dt; if (this.litT > 1.5) this.lit = true; }
    if (!this.master) { this.lit = false; this.litT = 0; }
    if (this.lit) dn = Math.max(dn, 0) + 0.012 + 0.03 * (this.NH - 0.2) / 0.5;  // yanma kaynaklı hızlanma
    this.NH = Math.max(0, this.NH + dn * dt);
    var nlT = Math.max(id.NL * Math.pow(this.NH / id.NH, 2.2), nlW), tau = this.lit ? 2.5 : 7;
    this.NL += (nlT - this.NL) * dt / tau;
    var r = this.NH / id.NH, T2 = id.st[1].T;
    this.Wf = this.lit ? id.Wf * (0.45 + 0.55 * Math.pow(r, 1.5)) : 0;
    // EGT: ateşlemede zirve yapar (zengin karışım, düşük hava debisi), rölantide yerine oturur
    var bump = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (r - 0.28) / 0.72))));
    var tgt = this.lit ? id.st[7].T + 240 * bump : T2 + (id.st[3].T - T2) * r * r;
    this.egt += (tgt - this.egt) * dt / (this.lit ? (tgt > this.egt ? 1.6 : 9) : 3);
    this.limiter = starter ? 'Marş motoru devrede' : '';
    if (this.lit && this.NH >= id.NH) {                                         // rölantiye ulaşıldı: çevrim modeline devret
      this.mode = 'run'; this.NH = id.NH; this.NL = id.NL; this.Wf = id.Wf; this.integ = id.Wf; this.out = id; this.egt = id.st[7].T;
      return this.out;
    }
    this.out = this.subOut();
    return this.out;
  };
  Sim.prototype.step = function (dt, pla) {
    this.t += dt; this.surgeNow = false;
    if (this.mode !== 'run') return this.stepSub(dt);
    if (!this.master) { this.mode = 'sub'; this.lit = false; this.litT = 0; this.egt = this.out.st[7].T; return this.stepSub(dt); }
    var d = this.d, s = d.spec, o = this.out;
    var dem = this.n1Demand(pla), err = dem - this.NL;
    var wfRef = this.rt.max.Wf;
    // PI denetim, sınırlayıcılara karşı integral sarması önlemeli (anti-windup)
    var KP = s.kp, KI = s.ki;
    this.integ += KI * err * wfRef * dt;
    var wf = this.integ + KP * err * wfRef;
    this.limiter = '';
    var hi = this.ruMax * o.st[4].P, lo = this.ruMin * o.st[4].P;
    if (this.protect) {
      if (wf > hi) { wf = hi; this.limiter = 'Hızlanma çizelgesi (Wf/P3)'; }
      // pompaj payı koruması: bu adımda payı smMin altına düşürmeyecek en yüksek yakıt debisi
      var selfP = this, nl = this.NL, nh = this.NH;
      var smAt = function (w) { return flow(d, nl, nh, selfP.fc, { Wf: w }).smHpc; };
      if (wf > this.Wf && smAt(wf) < s.smMin) {
        var a = Math.min(this.Wf, wf), b = wf, i;
        if (smAt(a) < s.smMin) wf = a;
        else { for (i = 0; i < 7; i++) { var m = 0.5 * (a + b); if (smAt(m) < s.smMin) b = m; else a = m; } wf = a; }
        this.limiter = 'Hızlanma çizelgesi (pompaj payı)';
      }
      if (o.T4 > s.T4max + 12 && wf > this.Wf) { wf = this.Wf - 0.5 * wfRef * dt; this.limiter = 'T4 sınırı'; }
    } else {
      wf = Math.min(wf, this.Wf + 1.5 * wfRef * dt, 1.5 * wfRef);              // ölçme valfi hızı ve pompa kapasitesi
    }
    if (this.NH > s.n2Max + 0.004 && wf > this.Wf) { wf = this.Wf - 0.5 * wfRef * dt; this.limiter = 'N2 sınırı'; }
    if (wf < lo) { wf = lo; this.limiter = 'Yavaşlama çizelgesi (Wf/P3)'; }
    // pompaj: çalışma noktası pompaj hattını geçerse akış çöker; denetim yakıtı kısarak toparlar
    var rec = this.rt.idle.wfP3 * o.st[4].P;
    if (this.surgeT > 0) { this.surgeT -= dt; wf = rec; this.limiter = 'POMPAJ · toparlanma'; }
    else if (o.smHpc < 0) { this.surgeT = 0.6; this.surgeCount++; this.surgeNow = true; wf = rec; this.limiter = 'POMPAJ · toparlanma'; }
    if (this.limiter) this.integ = wf - KP * err * wfRef;
    this.Wf = wf;
    // makara dinamiği: I·ω·dω/dt = ΔP (Heun / RK2)
    var self = this;
    function deriv(nl, nh) {
      var f = flow(d, nl, nh, self.fc, { Wf: self.Wf });
      return [f.dPL / (s.iL * d.omegaL * d.omegaL * nl), f.dPH / (s.iH * d.omegaH * d.omegaH * nh), f];
    }
    var k1 = deriv(this.NL, this.NH);
    var k2 = deriv(Math.max(0.1, this.NL + dt * k1[0]), Math.max(0.1, this.NH + dt * k1[1]));
    this.NL = Math.max(0.1, this.NL + 0.5 * dt * (k1[0] + k2[0]));
    this.NH = Math.max(0.1, this.NH + 0.5 * dt * (k1[1] + k2[1]));
    this.out = flow(d, this.NL, this.NH, this.fc, { Wf: this.Wf });
    this.egt = this.out.st[7].T;
    if (this.NH < 0.5 || !isFinite(this.out.Fn)) { this.mode = 'sub'; this.lit = false; this.litT = 0; this.limiter = 'Alev sönmesi'; }
    return this.out;
  };

  return {
    SPEC: SPEC, R: R, LHV: LHV,
    cp: cp, h: h, phi: phi, gamma: gamma, entropy: entropy, TfromH: TfromH,
    isa: isa, nozzle: nozzle, burnerFAR: burnerFAR,
    surgePR: surgePR, design: design, flow: flow, steadyT4: steadyT4, steadyTarget: steadyTarget, ratings: ratings, Sim: Sim
  };
});
