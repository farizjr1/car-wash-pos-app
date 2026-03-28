export interface ClosingItem {
  id: string;
  closingId: string;
  serviceId: string;
  serviceName: string;
  kategori: string;
  harga: number;
  qty: number;
  kas: number;
  jumlah: number;
  namaTP?: string;
  pendapatanWasher?: number;
  pendapatanTP?: number;
}

export interface Pengeluaran {
  id: string;
  closingId: string;
  jenis: string;
  harga: number;
}

export interface ClosingReport {
  id: string;
  tanggal: string;
  kasir: string;
  cabang: string;
  status: string;
  totalOmset: number;
  totalOut: number;
  kasBca: number;
  kasBsi: number;
  kasCimbBni: number;
  kasQrisBca: number;
  kasMandiri: number;
  kasVoucher: number;
  kasTunai: number;
  totalCashless: number;
  jumlahMobil: number;
  catatan: string;
  createdAt: string;
  updatedAt: string;
}
