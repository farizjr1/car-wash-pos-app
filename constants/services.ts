import { KategoriMobil, WASHER_UPAH } from './cars';

export interface Service {
  id: string;
  name: string;
  kategori: string;
  harga: number | string;
  hargaDisplay: string;
  kasDefault?: number;      // bagian KAS perusahaan per unit
  upahTP?: number;          // upah TP tetap per unit (Premium & Paket)
  upahWasherTP?: number;    // upah washer untuk layanan Premium/Paket (washer tetap cuci mobilnya)
                            // Jika undefined, berarti tidak ada washer terpisah (Poles pakai WASHER_UPAH)
  hasTP?: boolean;          // butuh input nama TP
  isPolesDinamis?: boolean; // upah TP dihitung: harga - kas - upah_washer_cuci(hidrolik)
  isVariable?: boolean;
}

/**
 * LOGIKA PENDAPATAN (FINAL):
 *
 * === REGULER / NITROGEN / KARPET ===
 *   upah_washer = harga - kasDefault
 *   (tidak ada TP)
 *
 * === CUCI PREMIUM ===
 *   Washer cuci mobilnya → dapat upahWasherTP
 *   TP mengawasi/mengerjakan premium → dapat upahTP
 *   Contoh Premium 50K: KAS=36K, Washer=11K, TP=3K
 *
 * === PAKET MOBIL ===
 *   Washer cuci mobilnya → dapat upahWasherTP (upah cuci saja)
 *   TP mengerjakan paket (wax, doorsmeer, dll) → dapat upahTP tetap
 *   Contoh Doorsmeer 80K: KAS=64K, TP=5K, sisanya untuk Washer
 *
 * === POLES (DINAMIS) ===
 *   Poles SELALU dicuci HIDROLIK
 *   upah_tp = harga - kasDefault - upah_washer_cuci(kategoriMobil, hidrolik)
 *   upah_washer = WASHER_UPAH[kategoriMobil]['hidrolik']
 */

export const SERVICES: Service[] = [
  // ================================================================
  // REGULER — upah_washer = harga - kasDefault (tidak ada TP)
  // ================================================================
  { id: 'motor',              name: 'MOTOR',                           kategori: 'Reguler', harga: 15000,  hargaDisplay: '15K',  kasDefault: 8000  },
  { id: 'express_online',     name: 'EXPRESS ONLINE',                  kategori: 'Reguler', harga: 20000,  hargaDisplay: '20K',  kasDefault: 13000 },
  { id: 'hidrolik_online',    name: 'HIDROLIK ONLINE',                 kategori: 'Reguler', harga: 30000,  hargaDisplay: '30K',  kasDefault: 21000 },
  { id: 'express_small_med',  name: 'EXPRESS SMALL/MEDIUM',            kategori: 'Reguler', harga: 25000,  hargaDisplay: '25K',  kasDefault: 16000 },
  { id: 'hidrolik_small_med', name: 'HIDROLIK SMALL/MEDIUM',           kategori: 'Reguler', harga: 35000,  hargaDisplay: '35K',  kasDefault: 24000 },
  { id: 'express_besar_suv',  name: 'EXPRESS BESAR/SUV',               kategori: 'Reguler', harga: 30000,  hargaDisplay: '30K',  kasDefault: 21000 },
  { id: 'hidrolik_besar_suv', name: 'HIDROLIK BESAR/SUV',              kategori: 'Reguler', harga: 40000,  hargaDisplay: '40K',  kasDefault: 27000 },
  { id: 'express_alphard',    name: 'EXPRESS ALPHARD DAN SEJENISNYA',  kategori: 'Reguler', harga: 50000,  hargaDisplay: '50K',  kasDefault: 37000 },
  { id: 'hidrolik_alphard',   name: 'HIDROLIK ALPHARD DAN SEJENISNYA', kategori: 'Reguler', harga: 60000,  hargaDisplay: '60K',  kasDefault: 45000 },
  { id: 'elf_box',            name: 'MOBIL ELF/BOX DLL',               kategori: 'Reguler', harga: 60000,  hargaDisplay: '60K',  kasDefault: 37000 },

  // ================================================================
  // CUCI MOBIL PREMIUM
  // Washer tetap cuci → dapat upahWasherTP
  // TP mengawasi/premium → dapat upahTP (3.000 untuk semua Premium)
  // KAS + Washer + TP = Harga
  // ================================================================
  //  50K: KAS 36K + Washer 11K + TP 3K = 50K ✓
  { id: 'premium_hidrolik_sm',
    name: 'HIDROLIK SMALL/MEDIUM',           kategori: 'Premium', harga: 50000, hargaDisplay: '50K',
    kasDefault: 36000, hasTP: true, upahTP: 3000, upahWasherTP: 11000 },
  //  60K: KAS 44K + Washer 13K + TP 3K = 60K ✓
  { id: 'premium_hidrolik_big',
    name: 'HIDROLIK BIG',                    kategori: 'Premium', harga: 60000, hargaDisplay: '60K',
    kasDefault: 44000, hasTP: true, upahTP: 3000, upahWasherTP: 13000 },
  //  60K: KAS 44K + Washer 13K + TP 3K = 60K ✓
  { id: 'premium_express_alphard',
    name: 'EXPRESS ALPHARD DAN SEJENISNYA',  kategori: 'Premium', harga: 60000, hargaDisplay: '60K',
    kasDefault: 44000, hasTP: true, upahTP: 3000, upahWasherTP: 13000 },
  //  70K: KAS 52K + Washer 15K + TP 3K = 70K ✓
  { id: 'premium_hidrolik_alphard',
    name: 'HIDROLIK ALPHARD DAN SEJENISNYA', kategori: 'Premium', harga: 70000, hargaDisplay: '70K',
    kasDefault: 52000, hasTP: true, upahTP: 3000, upahWasherTP: 15000 },

  // ================================================================
  // PAKET MOBIL
  // Washer cuci → dapat upahWasherTP (sisa setelah KAS & TP)
  // TP mengerjakan paket → dapat upahTP tetap
  // ================================================================
  //  80K: KAS 64K + TP 5K + Washer 11K = 80K ✓
  { id: 'paket_doorsmeer',
    name: 'CUCI + DOORSMEER',                             kategori: 'Paket', harga: 80000,  hargaDisplay: '80K',
    kasDefault: 64000, hasTP: true, upahTP: 5000, upahWasherTP: 11000 },
  // 100K: KAS 78K + TP 11K + Washer 11K = 100K ✓
  { id: 'paket_wax',
    name: 'CUCI + WAX',                                   kategori: 'Paket', harga: 100000, hargaDisplay: '100K',
    kasDefault: 78000, hasTP: true, upahTP: 11000, upahWasherTP: 11000 },
  { id: 'paket_glass_coating',
    name: 'CUCI + GLASS COATING ALL KACA',                kategori: 'Paket', harga: 100000, hargaDisplay: '100K',
    kasDefault: 78000, hasTP: true, upahTP: 11000, upahWasherTP: 11000 },
  { id: 'paket_back_black',
    name: 'CUCI + BACK TO BLACK',                         kategori: 'Paket', harga: 100000, hargaDisplay: '100K',
    kasDefault: 78000, hasTP: true, upahTP: 11000, upahWasherTP: 11000 },
  { id: 'paket_poles',
    name: 'CUCI + POLES MESIN/ASPAL/AC/BARET KECIL',      kategori: 'Paket', harga: 100000, hargaDisplay: '100K',
    kasDefault: 78000, hasTP: true, upahTP: 11000, upahWasherTP: 11000 },
  // 125K: KAS 99K + TP 15K + Washer 11K = 125K ✓
  { id: 'paket_lampu',
    name: 'CUCI + MEMBERSIHKAN LAMPU DEPAN/JK/J.BODY',    kategori: 'Paket', harga: 125000, hargaDisplay: '125K',
    kasDefault: 99000, hasTP: true, upahTP: 15000, upahWasherTP: 11000 },
  { id: 'paket_interior',
    name: 'CUCI + MEMBERSIHKAN INTERIOR',                  kategori: 'Paket', harga: 125000, hargaDisplay: '125K',
    kasDefault: 99000, hasTP: true, upahTP: 15000, upahWasherTP: 11000 },
  // 200K: KAS 162K + TP 27K + Washer 11K = 200K ✓
  { id: 'paket_2',
    name: 'CUCI + 2 PAKET',                                kategori: 'Paket', harga: 200000, hargaDisplay: '200K',
    kasDefault: 162000, hasTP: true, upahTP: 27000, upahWasherTP: 11000 },
  // 250K: KAS 202K + TP 37K + Washer 11K = 250K ✓
  { id: 'paket_3',
    name: 'CUCI + 3 PAKET',                                kategori: 'Paket', harga: 250000, hargaDisplay: '250K',
    kasDefault: 202000, hasTP: true, upahTP: 37000, upahWasherTP: 11000 },

  // ================================================================
  // POLES — upah TP DINAMIS (selalu hidrolik)
  // upah_tp   = harga - kasDefault - WASHER_UPAH[kategoriMobil]['hidrolik']
  // upah_washer = WASHER_UPAH[kategoriMobil]['hidrolik']
  // ================================================================
  { id: 'poles_body_kecil',      name: 'POLES BODY KECIL',      kategori: 'Poles', harga: 300000, hargaDisplay: '300K', kasDefault: 202000, hasTP: true, isPolesDinamis: true, isVariable: true },
  { id: 'poles_body_sedang',     name: 'POLES BODY SEDANG',     kategori: 'Poles', harga: 350000, hargaDisplay: '350K', kasDefault: 227000, hasTP: true, isPolesDinamis: true, isVariable: true },
  { id: 'poles_body_besar',      name: 'POLES BODY BESAR',      kategori: 'Poles', harga: 400000, hargaDisplay: '400K', kasDefault: 252000, hasTP: true, isPolesDinamis: true, isVariable: true },
  { id: 'poles_interior_kecil',  name: 'POLES INTERIOR KECIL',  kategori: 'Poles', harga: 250000, hargaDisplay: '250K', kasDefault: 177000, hasTP: true, isPolesDinamis: true, isVariable: true },
  { id: 'poles_interior_sedang', name: 'POLES INTERIOR SEDANG', kategori: 'Poles', harga: 300000, hargaDisplay: '300K', kasDefault: 202000, hasTP: true, isPolesDinamis: true, isVariable: true },
  { id: 'poles_interior_besar',  name: 'POLES INTERIOR BESAR',  kategori: 'Poles', harga: 350000, hargaDisplay: '350K', kasDefault: 227000, hasTP: true, isPolesDinamis: true, isVariable: true },
  { id: 'poles_allin_kecil',     name: 'POLES ALL IN KECIL',    kategori: 'Poles', harga: 400000, hargaDisplay: '400K', kasDefault: 252000, hasTP: true, isPolesDinamis: true, isVariable: true },
  { id: 'poles_allin_sedang',    name: 'POLES ALL IN SEDANG',   kategori: 'Poles', harga: 500000, hargaDisplay: '500K', kasDefault: 327000, hasTP: true, isPolesDinamis: true, isVariable: true },
  { id: 'poles_allin_besar',     name: 'POLES ALL IN BESAR',    kategori: 'Poles', harga: 600000, hargaDisplay: '600K', kasDefault: 402000, hasTP: true, isPolesDinamis: true, isVariable: true },

  // ================================================================
  // NITROGEN — upah_washer = harga - kasDefault
  // ================================================================
  { id: 'nitrogen_motor', name: 'NITROGEN 2 BAN MOTOR', kategori: 'Nitrogen', harga: 5000,  hargaDisplay: '5K',         kasDefault: 3000 },
  { id: 'nitrogen_mobil', name: 'NITROGEN 4 BAN MOBIL', kategori: 'Nitrogen', harga: 10000, hargaDisplay: '10K',        kasDefault: 7000 },

  // ================================================================
  // KARPET
  // ================================================================
  { id: 'karpet', name: 'KARPET (PER METER)', kategori: 'Karpet', harga: 15000, hargaDisplay: '15K/meter', kasDefault: 0 },
];

export const KATEGORI_ORDER = ['Reguler', 'Premium', 'Paket', 'Poles', 'Nitrogen', 'Karpet'];

export const KATEGORI_LABELS: Record<string, string> = {
  Reguler:  'REGULER',
  Premium:  'CUCI MOBIL PREMIUM',
  Paket:    'PAKET MOBIL',
  Poles:    'POLES',
  Nitrogen: 'NITROGEN',
  Karpet:   'KARPET (PER METER 15K)',
};

// Kategori yang butuh input nama TP
export const KATEGORI_BUTUH_TP = ['Premium', 'Paket', 'Poles'];

// ================================================================
// FUNGSI KALKULASI
// ================================================================

/**
 * Pendapatan washer untuk layanan REGULER/NITROGEN/KARPET
 * = harga - kasDefault
 */
export function getPendapatanWasher(harga: number, kasDefault: number): number {
  return harga - kasDefault;
}

/**
 * Upah washer untuk layanan dengan TP (Premium/Paket/Poles)
 * Premium & Paket → upahWasherTP (tetap dari definisi)
 * Poles → WASHER_UPAH[kategoriMobil]['hidrolik'] (selalu hidrolik)
 */
export function getUpahWasherTP(
  service: Service,
  kategoriMobil?: KategoriMobil
): number {
  if (service.isPolesDinamis) {
    // Poles selalu hidrolik
    const kat = kategoriMobil || 'umum';
    return WASHER_UPAH[kat]['hidrolik'];
  }
  return service.upahWasherTP || 0;
}

/**
 * Pendapatan TP tetap (Premium & Paket)
 */
export function getPendapatanTPTetap(service: Service): number {
  return service.upahTP || 0;
}

/**
 * Pendapatan TP untuk Poles (dinamis, selalu hidrolik)
 * = harga - kasDefault - upah_washer_cuci(kategoriMobil, hidrolik)
 */
export function getPendapatanTPPoles(
  harga: number,
  kasDefault: number,
  kategoriMobil: KategoriMobil
): number {
  const upahWasherCuci = WASHER_UPAH[kategoriMobil]['hidrolik'];
  return harga - kasDefault - upahWasherCuci;
}

/**
 * Pendapatan TP dari sebuah service.
 * Poles: selalu hidrolik, perlu kategoriMobil.
 * Premium/Paket: nilai tetap dari upahTP.
 */
export function getPendapatanTP(
  service: Service,
  kategoriMobil?: KategoriMobil,
  _unused?: 'express' | 'hidrolik'
): number {
  if (service.isPolesDinamis && kategoriMobil) {
    return getPendapatanTPPoles(
      service.harga as number,
      service.kasDefault || 0,
      kategoriMobil
    );
  }
  return getPendapatanTPTetap(service);
}
