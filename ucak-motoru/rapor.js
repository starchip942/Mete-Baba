// Tasarım raporunu modelden üretir:  node rapor.js  ->  TASARIM_RAPORU.md
const fs = require('fs'), M = require('./model.js');
const d = M.design(), s = d.spec, g = d.geom;
const f = (v, n = 0) => v.toFixed(n);
const toc = { alt: s.alt, mach: s.mach, dTisa: 0 };
const des = M.flow(d, 1, 1, toc, { T4: s.T4 });
const sls = M.ratings(d, { alt: 0, mach: 0, dTisa: 0 }), hot = M.ratings(d, { alt: 0, mach: 0, dTisa: 15 }), rT = M.ratings(d, toc);
const cr = M.steadyTarget(d, toc, 'Fn', 0.8 * rT.max.Fn, 1600, rT.max);
const lb = o => o.tsfc * 9.80665 * 3600;
const row = (n, o) => `| ${n} | ${f(o.Fn / 1e3, 1)} | ${f(o.tsfc * 1e6, 2)} | ${f(lb(o), 3)} | ${f(o.T4)} | ${f(o.st[7].T - 273.15)} | ${f(o.OPR, 1)} | ${f(o.BPR, 1)} | ${f(o.W2)} | ${f(o.NL * 100, 1)} | ${f(o.NH * 100, 1)} |`;

// hızlanma denemesi
const sim = new M.Sim(d, { alt: 0, mach: 0, dTisa: 0 }, sls.idle);
let t95 = null, maxT4 = 0;
for (let i = 0; i < 1000; i++) { const q = sim.step(0.02, 1); if (!t95 && q.Fn > 0.95 * sls.max.Fn) t95 = sim.t; maxT4 = Math.max(maxT4, q.T4); }

const md = `# ${s.name} — Turbofan Ön Tasarım Raporu

> Bu dosya \`node rapor.js\` ile modelden üretilir; sayılar elle yazılmamıştır.

## 1. Gereksinim ve mimari

Dar gövdeli (150–180 koltuk) yolcu uçağı için 120 kN sınıfı itki. Mimari: iki makaralı, ayrık akışlı,
doğrudan tahrikli yüksek baypas oranlı turbofan. Kademe düzeni: 1 fan + ${g.nBoost} booster / ${g.nHpc} HPC / halka yanma odası / ${g.nHpt} HPT / ${g.nLpt} LPT.

Tasarım noktası tırmanış sonudur (${s.alt} m, Mach ${s.mach}, ISA); bu nokta düzeltilmiş debinin ve
düzeltilmiş hızın en yüksek olduğu, dolayısıyla fan çapını ve çekirdek boyutunu belirleyen koşuldur.

## 2. Tasarım noktası çevrimi

| Parametre | Değer |
|---|---|
| Net itki gereksinimi | ${f(s.FnReq / 1e3, 1)} kN |
| Baypas oranı | ${f(s.BPR, 1)} |
| Fan (baypas) / LPC / HPC basınç oranı | ${f(s.FPR, 2)} / ${f(s.LPR, 2)} / ${f(s.HPR, 1)} |
| Toplam basınç oranı | ${f(des.OPR, 1)} |
| Yanma odası çıkış sıcaklığı T4 | ${s.T4} K (kalkış sınırı ${s.T4max} K) |
| Hava debisi | ${f(des.W2, 1)} kg/s (düzeltilmiş ${f(des.wcFan)} kg/s) |
| Politropik verim: fan / LPC / HPC / HPT / LPT | ${s.etaPfan} / ${s.etaPlpc} / ${s.etaPhpc} / ${s.etaPhpt} / ${s.etaPlpt} |
| İzentropik verim: fan / LPC / HPC / HPT / LPT | ${f(d.etaFan, 3)} / ${f(d.etaLpc, 3)} / ${f(d.etaHpc, 3)} / ${f(d.etaHpt, 3)} / ${f(d.etaLpt, 3)} |
| Soğutma havası (NGV / rotor) + sızdırma | %${s.bNgv * 100} / %${s.bRot * 100} + %${s.bBleed * 100} (çekirdek debisinin) |
| Basınç kayıpları: giriş / baypas / yanma odası | %${f((1 - s.piInlet) * 100, 1)} / %${f((1 - s.piBypass) * 100, 1)} / %${f((1 - s.piB) * 100, 1)} |
| HP makaradan güç çekişi | ${s.pOff / 1e3} kW |
| Özgül yakıt tüketimi (TSFC) | ${f(des.tsfc * 1e6, 2)} mg/N·s (${f(lb(des), 3)} lb/lbf·sa) |
| Isıl / itki verimi | %${f(des.etaTh * 100, 1)} / %${f(des.etaProp * 100, 1)} |
| Lüle çıkış hızı: baypas / çekirdek | ${f(des.V18)} / ${f(des.V8)} m/s |

### İstasyon tablosu (tasarım noktası)

| İstasyon | Tt (K) | Pt (kPa) | Debi (kg/s) |
|---|---|---|---|
${des.st.map(x => `| ${x.id} · ${x.ad} | ${f(x.T, 1)} | ${f(x.P / 1e3, 2)} | ${f(x.W, 2)} |`).join('\n')}

## 3. Anma noktaları (sürekli rejim, tasarım dışı çözüm)

| Koşul | İtki kN | TSFC mg/N·s | TSFC lb/lbf·sa | T4 K | EGT °C | OPR | BPR | Debi kg/s | N1 % | N2 % |
|---|---|---|---|---|---|---|---|---|---|---|
${row('Kalkış, deniz seviyesi, ISA', sls.max)}
${row('Kalkış, deniz seviyesi, ISA+15', hot.max)}
${row('Tırmanış sonu, 10 668 m, M 0,78', rT.max)}
${row('Seyir, 10 668 m, M 0,78 (%80 itki)', cr)}
${row('Yer rölantisi', sls.idle)}

Kalkışta azami anmayı sınırlayan büyüklük: ${sls.limiter} (sınırlar: T4 ≤ ${s.T4max} K, N1 ≤ %${s.n1Max * 100}, N2 ≤ %${f(s.n2Max * 100, 1)}).

## 4. Ön boyutlandırma (ortalama hat)

| Büyüklük | Değer |
|---|---|
| Fan uç çapı / göbek çapı | ${f(g.fan.Dt, 3)} / ${f(g.fan.Dh, 3)} m (göbek/uç ${s.htFan}, eksenel Mach ${s.mFan}) |
| Fan uç hızı / %100 N1 | ${s.utipFan} m/s / ${f(g.rpmL)} d/dk |
| HPC giriş uç çapı | ${f(g.hpc.Dt, 3)} m (göbek/uç ${s.htHpc}) |
| HPC uç hızı / %100 N2 | ${s.utipHpc} m/s / ${f(g.rpmH)} d/dk |
| HPT / LPT ortalama yarıçap | ${f(g.rmHpt, 3)} / ${f(g.rmLpt, 3)} m |
| HPT / LPT ortalama kanat hızı | ${f(g.umHpt)} / ${f(g.umLpt)} m/s |
| Lüle boğaz alanı: baypas / çekirdek | ${f(g.A18, 3)} / ${f(g.A8, 3)} m² |
| Yaklaşık motor boyu | ${f(g.length, 2)} m |
| Makara kutupsal ataleti: LP / HP | ${s.iL} / ${s.iH} kg·m² (varsayım) |

Kademe sayıları kademe yükleme sınırlarından bulunur (ψ = Δh/U²): HPC 0,38, booster 0,50, HPT 2,0, LPT 2,2.

## 5. Geçici rejim

Yer rölantisinden tam gaza ani gaz kolu hareketi (deniz seviyesi, durağan):
%95 kalkış itkisine ulaşma süresi **${f(t95, 1)} s**, en yüksek geçici T4 **${f(maxT4)} K**.
Yakıt denetimi: N1 hatasına PI denetleyici, pompaj payını en az %${s.smMin * 100} tutan hızlanma çizelgesi, Wf/P3 yavaşlama çizelgesi, T4 ve N2 üst sınırlayıcıları.

HPC pompaj hattı jenerik bir eğridir (tasarım noktasında %${s.smDes * 100} pay). Korumalar kapatılırsa ani gaz hareketi pompaja yol açar; denetim yakıtı kısarak toparlar.

Çalıştırma ve durdurma rölanti altı yarı ampirik modelle benzetilir: marş motoru N2'yi yaklaşık %20'ye çıkarır, ateşleme sonrası EGT zirve yapar, motor rölantiye oturur; durdurmada makaralar sürüklemeyle yavaşlar, uçuşta rüzgâr değirmeni hızında kalır.

## 6. Yöntem

- Gaz özellikleri: hava ve kerosen yanma ürünleri için sıcaklığa bağlı cp polinomları (Walsh & Fletcher, *Gas Turbine Performance*); entalpi ve entropi fonksiyonu analitik integral.
- Tasarım dışı eşleşme: HPT ve LPT kılavuz kanat boğazları boğulmuş kabul edilir (W√T/P sabit), lüleler sabit alanlı yakınsaktır (boğulma denetimli), makara hızları iki güç dengesinden Newton yöntemiyle çözülür.
- Kompresör işi mekanik hızın karesiyle ölçeklenir (sabit iş katsayısı); verim düzeltilmiş hız sapmasının karesiyle düşer.
- Geçici rejim: I·ω·dω/dt = P_türbin − P_kompresör − P_çekiş; Heun yöntemi, 20 ms adım.
- Doğrulama: \`node test.js\` (kütle/enerji korunumu, tasarım noktasının tasarım dışı çözücüyle yeniden üretimi, 48 koşulda yakınsama, geçici rejim ölçütleri).

## 7. Sınırlar

- Ölçülmüş kompresör/türbin haritası yoktur; pompaj hattı jenerik bir eğridir, döner durma ve düşük hızdaki gerçek davranış hesaplanmaz. Rölanti civarı ve rölanti altı sonuçlar yaklaşık değerdir.
- Kanat profili tasarımı, CFD, yapısal/ısıl/titreşim analizi, malzeme seçimi, ağırlık, gürültü ve emisyon kapsam dışıdır.
- Verimler, kayıplar, soğutma havası oranları ve ataletler bu sınıf için tipik kabul edilen varsayımlardır; deney verisiyle kalibre edilmemiştir.
- Karşılaştırma, bu motor sınıfı için yayımlanmış tipik aralıklarla yapılmıştır (fan çapı 1,7–2,1 m, seyir TSFC 0,50–0,60 lb/lbf·sa); belirli bir motorun verisiyle birebir doğrulama değildir.
- Sonuç: bu çalışma kavramsal/ön tasarım düzeyindedir, sertifikalandırılabilir bir motor tasarımı değildir.
`;
fs.writeFileSync(__dirname + '/TASARIM_RAPORU.md', md);
console.log('TASARIM_RAPORU.md yazıldı');
