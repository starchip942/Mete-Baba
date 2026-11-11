# MB-120 Toros — Turbofan Ön Tasarım Raporu

> Bu dosya `node rapor.js` ile modelden üretilir; sayılar elle yazılmamıştır.

## 1. Gereksinim ve mimari

Dar gövdeli (150–180 koltuk) yolcu uçağı için 120 kN sınıfı itki. Mimari: iki makaralı, ayrık akışlı,
doğrudan tahrikli yüksek baypas oranlı turbofan. Kademe düzeni: 1 fan + 4 booster / 10 HPC / halka yanma odası / 2 HPT / 5 LPT.

Tasarım noktası tırmanış sonudur (10668 m, Mach 0.78, ISA); bu nokta düzeltilmiş debinin ve
düzeltilmiş hızın en yüksek olduğu, dolayısıyla fan çapını ve çekirdek boyutunu belirleyen koşuldur.

## 2. Tasarım noktası çevrimi

| Parametre | Değer |
|---|---|
| Net itki gereksinimi | 26.5 kN |
| Baypas oranı | 10.0 |
| Fan (baypas) / LPC / HPC basınç oranı | 1.50 / 2.60 / 16.5 |
| Toplam basınç oranı | 42.3 |
| Yanma odası çıkış sıcaklığı T4 | 1720 K (kalkış sınırı 1850 K) |
| Hava debisi | 192.2 kg/s (düzeltilmiş 506 kg/s) |
| Politropik verim: fan / LPC / HPC / HPT / LPT | 0.925 / 0.905 / 0.905 / 0.885 / 0.915 |
| İzentropik verim: fan / LPC / HPC / HPT / LPT | 0.921 / 0.892 / 0.865 / 0.900 / 0.929 |
| Soğutma havası (NGV / rotor) + sızdırma | %9 / %6 + %1 (çekirdek debisinin) |
| Basınç kayıpları: giriş / baypas / yanma odası | %0.3 / %1.5 / %4.5 |
| HP makaradan güç çekişi | 60 kW |
| Özgül yakıt tüketimi (TSFC) | 15.72 mg/N·s (0.555 lb/lbf·sa) |
| Isıl / itki verimi | %50.5 / %67.6 |
| Lüle çıkış hızı: baypas / çekirdek | 305 / 537 m/s |

### İstasyon tablosu (tasarım noktası)

| İstasyon | Tt (K) | Pt (kPa) | Debi (kg/s) |
|---|---|---|---|
| 0 · Serbest akım | 218.8 | 23.84 | 192.19 |
| 2 · Fan girişi | 245.5 | 35.54 | 192.19 |
| 13 · Fan çıkışı (baypas) | 278.4 | 53.31 | 174.72 |
| 25 · HPC girişi | 332.1 | 91.02 | 17.47 |
| 3 · HPC çıkışı | 782.3 | 1501.86 | 17.47 |
| 4 · Yanma odası çıkışı | 1720.0 | 1434.27 | 15.09 |
| 41 · HPT rotor girişi | 1639.3 | 1434.27 | 16.67 |
| 45 · LPT girişi | 1218.5 | 360.92 | 17.71 |
| 5 · LPT çıkışı | 873.2 | 79.51 | 17.71 |
| 8 · Çekirdek lülesi | 873.2 | 78.71 | 17.71 |
| 18 · Baypas lülesi | 278.4 | 52.51 | 174.72 |

## 3. Anma noktaları (sürekli rejim, tasarım dışı çözüm)

| Koşul | İtki kN | TSFC mg/N·s | TSFC lb/lbf·sa | T4 K | EGT °C | OPR | BPR | Debi kg/s | N1 % | N2 % |
|---|---|---|---|---|---|---|---|---|---|---|
| Kalkış, deniz seviyesi, ISA | 120.9 | 8.18 | 0.289 | 1830 | 1030 | 34.3 | 10.4 | 446 | 101.8 | 103.5 |
| Kalkış, deniz seviyesi, ISA+15 | 106.9 | 8.09 | 0.286 | 1831 | 1032 | 30.3 | 10.9 | 411 | 99.5 | 103.5 |
| Tırmanış sonu, 10 668 m, M 0,78 | 26.5 | 15.72 | 0.555 | 1720 | 945 | 42.3 | 10.0 | 192 | 100.0 | 100.0 |
| Seyir, 10 668 m, M 0,78 (%80 itki) | 21.2 | 15.44 | 0.545 | 1614 | 867 | 35.2 | 11.1 | 182 | 92.7 | 96.6 |
| Yer rölantisi | 7.4 | 10.72 | 0.379 | 879 | 337 | 6.2 | 10.0 | 114 | 36.1 | 70.0 |

Kalkışta azami anmayı sınırlayan büyüklük: N2 (sınırlar: T4 ≤ 1850 K, N1 ≤ %104, N2 ≤ %103.5).

## 4. Ön boyutlandırma (ortalama hat)

| Büyüklük | Değer |
|---|---|
| Fan uç çapı / göbek çapı | 1.849 / 0.555 m (göbek/uç 0.3, eksenel Mach 0.62) |
| Fan uç hızı / %100 N1 | 395 m/s / 4081 d/dk |
| HPC giriş uç çapı | 0.471 m (göbek/uç 0.56) |
| HPC uç hızı / %100 N2 | 450 m/s / 18257 d/dk |
| HPT / LPT ortalama yarıçap | 0.259 / 0.462 m |
| HPT / LPT ortalama kanat hızı | 495 / 197 m/s |
| Lüle boğaz alanı: baypas / çekirdek | 1.373 / 0.167 m² |
| Yaklaşık motor boyu | 3.18 m |
| Makara kutupsal ataleti: LP / HP | 95 / 9.5 kg·m² (varsayım) |

Kademe sayıları kademe yükleme sınırlarından bulunur (ψ = Δh/U²): HPC 0,38, booster 0,50, HPT 2,0, LPT 2,2.

## 5. Geçici rejim

Yer rölantisinden tam gaza ani gaz kolu hareketi (deniz seviyesi, durağan):
%95 kalkış itkisine ulaşma süresi **7.8 s**, en yüksek geçici T4 **1875 K**.
Yakıt denetimi: N1 hatasına PI denetleyici, pompaj payını en az %5 tutan hızlanma çizelgesi, Wf/P3 yavaşlama çizelgesi, T4 ve N2 üst sınırlayıcıları.

HPC pompaj hattı jenerik bir eğridir (tasarım noktasında %25 pay). Korumalar kapatılırsa ani gaz hareketi pompaja yol açar; denetim yakıtı kısarak toparlar.

Çalıştırma ve durdurma rölanti altı yarı ampirik modelle benzetilir: marş motoru N2'yi yaklaşık %20'ye çıkarır, ateşleme sonrası EGT zirve yapar, motor rölantiye oturur; durdurmada makaralar sürüklemeyle yavaşlar, uçuşta rüzgâr değirmeni hızında kalır.

## 6. Yöntem

- Gaz özellikleri: hava ve kerosen yanma ürünleri için sıcaklığa bağlı cp polinomları (Walsh & Fletcher, *Gas Turbine Performance*); entalpi ve entropi fonksiyonu analitik integral.
- Tasarım dışı eşleşme: HPT ve LPT kılavuz kanat boğazları boğulmuş kabul edilir (W√T/P sabit), lüleler sabit alanlı yakınsaktır (boğulma denetimli), makara hızları iki güç dengesinden Newton yöntemiyle çözülür.
- Kompresör işi mekanik hızın karesiyle ölçeklenir (sabit iş katsayısı); verim düzeltilmiş hız sapmasının karesiyle düşer.
- Geçici rejim: I·ω·dω/dt = P_türbin − P_kompresör − P_çekiş; Heun yöntemi, 20 ms adım.
- Doğrulama: `node test.js` (kütle/enerji korunumu, tasarım noktasının tasarım dışı çözücüyle yeniden üretimi, 48 koşulda yakınsama, geçici rejim ölçütleri).

## 7. Sınırlar

- Ölçülmüş kompresör/türbin haritası yoktur; pompaj hattı jenerik bir eğridir, döner durma ve düşük hızdaki gerçek davranış hesaplanmaz. Rölanti civarı ve rölanti altı sonuçlar yaklaşık değerdir.
- Kanat profili tasarımı, CFD, yapısal/ısıl/titreşim analizi, malzeme seçimi, ağırlık, gürültü ve emisyon kapsam dışıdır.
- Verimler, kayıplar, soğutma havası oranları ve ataletler bu sınıf için tipik kabul edilen varsayımlardır; deney verisiyle kalibre edilmemiştir.
- Karşılaştırma, bu motor sınıfı için yayımlanmış tipik aralıklarla yapılmıştır (fan çapı 1,7–2,1 m, seyir TSFC 0,50–0,60 lb/lbf·sa); belirli bir motorun verisiyle birebir doğrulama değildir.
- Sonuç: bu çalışma kavramsal/ön tasarım düzeyindedir, sertifikalandırılabilir bir motor tasarımı değildir.
