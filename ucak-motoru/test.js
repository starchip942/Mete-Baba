// Doğrulama testleri:  node test.js
const M = require('./model.js');
let fail = 0;
function check(name, ok, info) { console.log((ok ? '  GEÇTİ  ' : '  KALDI  ') + name + (info ? '  [' + info + ']' : '')); if (!ok) fail++; }
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.abs(b);

console.log('Gaz özellikleri');
check('cp hava 288 K ≈ 1004 J/kg.K', near(M.cp(288.15, 0), 1004, 0.003), M.cp(288.15, 0).toFixed(1));
check('cp hava 1000 K ≈ 1141 J/kg.K', near(M.cp(1000, 0), 1141, 0.003), M.cp(1000, 0).toFixed(1));
check('γ hava 288 K ≈ 1.400', near(M.gamma(288.15, 0), 1.4, 0.002), M.gamma(288.15, 0).toFixed(4));
check('h/T tersinirliği', near(M.TfromH(M.h(1432.1, 0.025), 0.025), 1432.1, 1e-8));
const a11 = M.isa(11000, 0);
check('ISA 11 km: 216.65 K, 22.63 kPa', near(a11.T, 216.65, 1e-6) && near(a11.P, 22632, 1e-3), a11.P.toFixed(0) + ' Pa');

console.log('Tasarım noktası tutarlılığı');
const d = M.design(), s = d.spec;
const toc = { alt: s.alt, mach: s.mach, dTisa: s.dTisa };
const o = M.flow(d, 1, 1, toc, { T4: s.T4 });
check('tasarım dışı çözücü tasarım noktasını yeniden üretir (itki)', near(o.Fn, s.FnReq, 1e-6), o.Fn.toFixed(2) + ' N');
check('LP makara güç dengesi', Math.abs(o.dPL / o.pFan) < 1e-6, (o.dPL / o.pFan).toExponential(1));
check('HP makara güç dengesi', Math.abs(o.dPH / o.pHpc) < 1e-6, (o.dPH / o.pHpc).toExponential(1));
check('BPR / FPR / OPR', near(o.BPR, s.BPR, 1e-6) && near(o.FPR, s.FPR, 1e-6), o.BPR.toFixed(3) + ' / ' + o.FPR.toFixed(3) + ' / ' + o.OPR.toFixed(2));
const st = Object.fromEntries(o.st.map(x => [x.id, x]));
check('kütle korunumu: W5 = W25·(1−sızdırma) + Wf', near(st['5'].W, o.W25 * (1 - s.bBleed) + o.Wf, 1e-9));
const eIn = o.Wf * M.LHV * s.etaB;
const eOut = st['8'].W * M.h(st['8'].T, st['8'].f) + st['18'].W * M.h(st['18'].T, 0) + o.W25 * s.bBleed * M.h(st['3'].T, 0)
  - o.W2 * M.h(st['2'].T, 0) + s.pOff + (1 - s.etaM) * (o.pHpt + o.pLpt);
check('enerji korunumu (yakıt ısısı = entalpi artışı + güç çekişi + kayıp)', near(eIn, eOut, 2e-4), ((eOut / eIn - 1) * 100).toFixed(4) + ' %');

console.log('Sınıf değerleriyle karşılaştırma (yüksek baypaslı dar gövde motorları)');
const sls = M.ratings(d, { alt: 0, mach: 0, dTisa: 0 });
const tsfcLb = x => x.tsfc * 9.80665 * 3600 / 1;            // kg/(N.s) -> kg/(kgf.h) = lb/(lbf.h)
check('tırmanış sonu TSFC 0.50–0.60 lb/lbf.h', tsfcLb(o) > 0.5 && tsfcLb(o) < 0.6, tsfcLb(o).toFixed(3));
check('kalkış itkisi 110–135 kN', sls.max.Fn > 110e3 && sls.max.Fn < 135e3, (sls.max.Fn / 1e3).toFixed(1) + ' kN');
check('kalkış TSFC 0.25–0.32 lb/lbf.h', tsfcLb(sls.max) > 0.25 && tsfcLb(sls.max) < 0.32, tsfcLb(sls.max).toFixed(3));
check('kalkış özgül itki 250–300 N.s/kg', sls.max.Fn / sls.max.W2 > 250 && sls.max.Fn / sls.max.W2 < 300, (sls.max.Fn / sls.max.W2).toFixed(0));
check('fan çapı 1.7–2.1 m', d.geom.fan.Dt > 1.7 && d.geom.fan.Dt < 2.1, d.geom.fan.Dt.toFixed(3) + ' m');
check('T4 ≤ sınır, N1/N2 ≤ sınır (kalkış)', sls.max.T4 <= s.T4max + 0.5 && sls.max.NL <= s.n1Max + 1e-4 && sls.max.NH <= s.n2Max + 1e-4, 'sınırlayan: ' + sls.limiter);

console.log('Sürekli rejim zarfı');
let allOk = true, n = 0;
for (const alt of [0, 3000, 6000, 9000, 11000, 12500]) for (const mach of [0, 0.3, 0.6, 0.85]) for (const dT of [-20, 0, 20]) {
  if (alt === 0 && mach > 0.4) continue;
  if (alt >= 9000 && mach < 0.5) continue;
  const r = M.ratings(d, { alt, mach, dTisa: dT }); n++;
  if (!(r.max.converged && r.idle.converged && r.max.Fn > r.idle.Fn && isFinite(r.max.tsfc))) { allOk = false; console.log('   sorun:', alt, mach, dT, r.max.converged, r.idle.converged); }
}
check(n + ' uçuş koşulunda azami + rölanti çözümü yakınsadı', allOk);

console.log('Geçici rejim');
const fc = { alt: 0, mach: 0, dTisa: 0 }, sim = new M.Sim(d, fc, sls.idle);
let t95 = null, maxT4 = 0, maxNH = 0;
for (let i = 0; i < 1000; i++) { const q = sim.step(0.02, 1); if (!t95 && q.Fn > 0.95 * sls.max.Fn) t95 = sim.t; maxT4 = Math.max(maxT4, q.T4); maxNH = Math.max(maxNH, sim.NH); }
check('yer rölantisi → %95 kalkış itkisi < 8 s', t95 && t95 < 8, t95 && t95.toFixed(2) + ' s');
check('geçici T4 aşımı < 40 K', maxT4 < s.T4max + 40, maxT4.toFixed(0) + ' K');
check('N2 aşımı < %1', maxNH < s.n2Max + 0.01, (maxNH * 100).toFixed(2) + ' %');
check('hızlanma sonu sürekli rejime oturur', near(sim.out.Fn, sls.max.Fn, 2e-3), (sim.out.Fn / 1e3).toFixed(2) + ' kN');
for (let i = 0; i < 1000; i++) sim.step(0.02, 0);
check('yavaşlama sonu rölantiye oturur', near(sim.NH, sls.idle.NH, 5e-3), (sim.NH * 100).toFixed(2) + ' % N2');

console.log(fail ? '\n' + fail + ' test KALDI' : '\nTüm testler geçti');
process.exit(fail ? 1 : 0);
