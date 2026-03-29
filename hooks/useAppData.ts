/**
 * Global hooks for shared app data:
 * - useKasirInfo: kasir aktif + shift dari app_settings
 * - useKaryawan: daftar washer & TP dari tabel karyawan
 * - useCarModels: daftar mobil dari tabel car_models
 */

import { useQuery } from '@tanstack/react-query';
import { blink } from '@/lib/blink';

export interface Karyawan {
  id: string;
  nama: string;
  peran: 'washer' | 'tp' | 'both';
  aktif: number;
}

export interface CarModel {
  id: string;
  nama: string;
  kategori: 'umum' | 'big' | 'premium';
  aktif: number;
}

export interface AppSetting {
  key: string;
  value: string;
}

// ── Kasir info dari app_settings ──────────────────────────────────────────────
export function useKasirInfo() {
  const { data } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const res = await blink.db.appSettings.list();
      const map: Record<string, string> = {};
      (res as AppSetting[]).forEach(s => { map[s.key] = s.value; });
      return map;
    },
    staleTime: 1000 * 30,
  });
  return {
    kasirAktif: data?.kasir_aktif || data?.kasirAktif || '',
    shiftAktif: data?.shift_aktif || data?.shiftAktif || '1',
    cabang: data?.cabang || 'Orange Carwash',
    settings: data || {},
  };
}

// ── Daftar Karyawan ───────────────────────────────────────────────────────────
export function useKaryawan() {
  return useQuery({
    queryKey: ['karyawan'],
    queryFn: async () => {
      const res = await blink.db.karyawan.list({ orderBy: { nama: 'asc' } });
      return (res as Karyawan[]).filter(k => Number(k.aktif) > 0);
    },
    staleTime: 1000 * 60,
  });
}

export function useWasherList() {
  const { data } = useKaryawan();
  return (data || []).filter(k => k.peran === 'washer' || k.peran === 'both');
}

export function useTPList() {
  const { data } = useKaryawan();
  return (data || []).filter(k => k.peran === 'tp' || k.peran === 'both');
}

// ── Daftar Mobil ──────────────────────────────────────────────────────────────
export function useCarModels() {
  return useQuery({
    queryKey: ['car_models'],
    queryFn: async () => {
      const res = await blink.db.carModels.list({ orderBy: { nama: 'asc' } });
      return (res as CarModel[]).filter(c => Number(c.aktif) > 0);
    },
    staleTime: 1000 * 60,
  });
}
