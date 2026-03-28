// Daftar mobil berdasarkan kategori dari tabel resmi Orange Carwash

export type KategoriMobil = 'umum' | 'big' | 'premium';

export interface CarInfo {
  model: string;
  kategori: KategoriMobil;
}

export const KATEGORI_MOBIL_LABEL: Record<KategoriMobil, string> = {
  umum: 'UMUM/MEDIUM',
  big: 'BESAR/BIG',
  premium: 'PREMIUM',
};

export const KATEGORI_MOBIL_PRICE: Record<KategoriMobil, { express: number; hidrolik: number }> = {
  umum: { express: 25000, hidrolik: 35000 },
  big: { express: 30000, hidrolik: 40000 },
  premium: { express: 50000, hidrolik: 60000 },
};

// Upah washer per kategori & jenis cuci
export const WASHER_UPAH: Record<KategoriMobil, { express: number; hidrolik: number }> = {
  umum: { express: 9000, hidrolik: 12000 },
  big: { express: 9000, hidrolik: 13000 },
  premium: { express: 13000, hidrolik: 15000 },
};

const UMUM_MEDIUM: string[] = [
  'Accord', 'Agya', 'Air-ev', 'Altis', 'Alvez', 'APV', 'Audi',
  'Avanza', 'Avega', 'Avla', 'Baleno', 'Binguo Ev', 'Brio', 'BRV',
  'Calva', 'Camry', 'Carens', 'Carry', 'Cherry Omoda', 'Chevrolet',
  'City', 'Civic', 'Cloud Ev', 'Confero', 'Corolla', 'Cortez', 'Creta',
  'CRV', 'CX-2', 'CX-3', 'CX-5', 'CX-30', 'Curls', 'Datsun', 'Dodge',
  'Duster', 'Eclipse Cross', 'Ertiga', 'Estilo', 'Etios', 'Evalia',
  'Expass', 'Exora', 'Feroza', 'Fiesta', 'Focus', 'Freed', 'Gets',
  'Glory', 'Granmax', 'S-Presso', 'HRV', 'Hyundai H-100', 'Hyundai Kona',
  'Hyundai Tucson', 'Harier', 'Ignis', 'Ioniq', 'Jazz', 'Jimny', 'Juke',
  'Karimun', 'Katana', 'Kia Rio', 'Kia Seltos', 'Kia Sonet', 'Kiger',
  'Kijang', 'Kwid', 'L300', 'Lancer', 'Livina', 'Luxio', 'Magnite',
  'March', 'Mazda 2', 'Mirage', 'Nissan Kick', 'Outlander', 'Panther',
  'Peugeot', 'Picanto', 'Raize', 'Rocky', 'Rash', 'Renault', 'Seross',
  'Sienta', 'Sigra', 'Sirion', 'Stream', 'Subaru', 'Sportage', 'Stargazer',
  'Swift', 'Taft', 'Tata', 'Teana', 'Terios', 'Toyota C-HR', 'Toyota Ist',
  'Trajet', 'Veloz', 'Vios', 'Vitara', 'WRV', 'Wuling', 'Xenia', 'XL7',
  'X Force', 'Xpander', 'Xtrail',
];

const BESAR_BIG: string[] = [
  'Almaz', 'Avante', 'Blazer', 'BMW', 'Carnival', 'CX-8', 'CX-9',
  'Delica', 'D-max', 'Elysion', 'Everest', 'Ford Ranger', 'Fortuner',
  'Hilux', 'Inova', 'Mercy', 'Mux', 'Navara', 'Nav1', 'Odyssey',
  'Pajero', 'Palisade', 'Santafe', 'Sedona', 'Serena', 'Strada',
  'Terano', 'Terra', 'Traga', 'Triton', 'Tropper', 'Voxy', 'Zenix',
];

const PREMIUM: string[] = [
  'Alphard', 'Chrysler', 'Crown', 'Elgrand', 'Ferrari', 'Hyundai H1',
  'Jaguar', 'Jeep Besar', 'Kia EV 6', 'Land Cruiser', 'Lexus ES 250',
  'Mazda MX-5', 'Mini Cooper', 'Porche', 'Range Rover', 'Rubicon',
  'Toyota 86', 'Toyota GR Supra', 'Velfire', 'Staria',
];

// Build flat list with kategori
export const ALL_CARS: CarInfo[] = [
  ...UMUM_MEDIUM.map(m => ({ model: m, kategori: 'umum' as KategoriMobil })),
  ...BESAR_BIG.map(m => ({ model: m, kategori: 'big' as KategoriMobil })),
  ...PREMIUM.map(m => ({ model: m, kategori: 'premium' as KategoriMobil })),
].sort((a, b) => a.model.localeCompare(b.model));

export function findCarByModel(query: string): CarInfo | undefined {
  const q = query.trim().toLowerCase();
  return ALL_CARS.find(c => c.model.toLowerCase() === q) ||
    ALL_CARS.find(c => c.model.toLowerCase().startsWith(q));
}

export const UMUM_LIST = UMUM_MEDIUM;
export const BIG_LIST = BESAR_BIG;
export const PREMIUM_LIST = PREMIUM;
