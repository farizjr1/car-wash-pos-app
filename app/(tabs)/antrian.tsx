import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import {
  SERVICES, getPendapatanTPPoles, getPendapatanTPTetap,
  getUpahWasherTP, Service,
} from '@/constants/services';
import { KATEGORI_MOBIL_LABEL, KATEGORI_MOBIL_PRICE, WASHER_UPAH } from '@/constants/cars';
import type { KategoriMobil } from '@/constants/cars';

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  orange:     '#E85D04',
  orangeD:    '#BF4800',
  orangeL:    '#FFF3E0',
  orangeT:    'rgba(232,93,4,0.15)',
  bg:         '#F5F5F5',
  white:      '#FFFFFF',
  dark:       '#1A1A2E',
  slate:      '#374151',
  gray:       '#6B7280',
  grayL:      '#F3F4F6',
  grayB:      '#E5E7EB',
  green:      '#059669',
  greenL:     '#ECFDF5',
  red:        '#DC2626',
  redL:       '#FEF2F2',
  purple:     '#7C3AED',
  purpleL:    '#F5F3FF',
  yellow:     '#F59E0B',
  free:       '#DC2626',
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface AntrianItem {
  id: string; tanggal: string; nomor: number;
  jenis: string; nopol: string;
  modelMobil?: string; kategoriMobil?: string;
  serviceId: string; serviceName: string; kategori: string; harga: number;
  namaWasher: string; upahWasher?: number;
  namaTP?: string; pendapatanTP?: number;
  ket: string; status: string; isFree?: number;
}

interface CarModel { id: string; nama: string; kategori: string; aktif: number }
interface Karyawan { id: string; nama: string; peran: string; aktif: number }

const KAT_OPTIONS = [
  { value: 'umum',    label: 'Umum/Medium', color: C.green  },
  { value: 'big',     label: 'Besar/Big',   color: C.red    },
  { value: 'premium', label: 'Premium',     color: C.purple },
];

function fmt(n: number)   { return n.toLocaleString('id-ID'); }
function todayStr()       { return new Date().toISOString().split('T')[0]; }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}
function getKatColor(kat?: string) {
  return kat === 'premium' ? C.purple : kat === 'big' ? C.red : C.green;
}
function getStatusColor(s: string) {
  return s === 'selesai' ? C.green : s === 'proses' ? C.yellow : C.gray;
}
function getStatusLabel(s: string) {
  return s === 'selesai' ? 'Selesai' : s === 'proses' ? 'Proses' : 'Antri';
}

type Step = 'model' | 'nopol' | 'service' | 'washer';
const CUCI_TYPES = [
  { id: 'express',  label: 'Express',  icon: 'flash',  color: C.yellow },
  { id: 'hidrolik', label: 'Hidrolik', icon: 'water',  color: C.green  },
] as const;

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function AntrianScreen() {
  const qc   = useQueryClient();
  const today = todayStr();

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState<Step>('model');

  // Step 1 – Model
  const [modelSearch, setModelSearch] = useState('');
  const [selectedCar, setSelectedCar] = useState<CarModel | null>(null);
  const [cuciType, setCuciType] = useState<'express' | 'hidrolik'>('express');

  // Step 2 – Nopol
  const [formNopol, setFormNopol] = useState('');

  // Step 3 – Service
  const [formServiceId, setFormServiceId]       = useState('');
  const [formServiceName, setFormServiceName]   = useState('');
  const [formKategori, setFormKategori]         = useState('');
  const [formHarga, setFormHarga]               = useState(0);
  const [formUpahWasher, setFormUpahWasher]     = useState(0);
  const [formPendapatanTP, setFormPendapatanTP] = useState(0);
  const [formSelectedSvc, setFormSelectedSvc]   = useState<Service | null>(null);
  const [showSvcPicker, setShowSvcPicker]       = useState(false);
  const [polesKat, setPolesKat]                 = useState<KategoriMobil | null>(null);

  // Step 4 – Washer & TP & FREE
  const [formWasher, setFormWasher]     = useState('');
  const [formTPName, setFormTPName]     = useState('');
  const [formKet, setFormKet]           = useState('');
  const [formIsFree, setFormIsFree]     = useState(false);

  // Detail modal
  const [selectedItem, setSelectedItem] = useState<AntrianItem | null>(null);

  // ── Data Fetching ──
  const { data: antrian, isLoading } = useQuery({
    queryKey: ['antrian', today],
    queryFn: async () => {
      const res = await blink.db.antrian.list({ where: { tanggal: today }, orderBy: { nomor: 'asc' } });
      return res as AntrianItem[];
    },
  });

  const { data: cars } = useQuery({
    queryKey: ['car_models'],
    queryFn: async () => {
      const res = await blink.db.carModels.list({ orderBy: { nama: 'asc' } });
      return (res as CarModel[]).filter(c => Number(c.aktif) > 0);
    },
  });

  const { data: karyawan } = useQuery({
    queryKey: ['karyawan'],
    queryFn: async () => {
      const res = await blink.db.karyawan.list({ orderBy: { nama: 'asc' } });
      return (res as Karyawan[]).filter(k => Number(k.aktif) > 0);
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const res = await blink.db.appSettings.list();
      const map: Record<string, string> = {};
      (res as any[]).forEach(s => { map[s.key] = s.value; });
      return map;
    },
  });

  const washerList = (karyawan || []).filter(k => k.peran === 'washer' || k.peran === 'both');
  const tpList     = (karyawan || []).filter(k => k.peran === 'tp'     || k.peran === 'both');

  // ── Stats ──
  const nomorBerikut = (antrian?.length || 0) + 1;
  const paidAntrian  = antrian?.filter(a => !Number((a as any).isFree)) || [];
  const totalOmset   = paidAntrian.reduce((s, a) => s + (a.harga || 0), 0);
  const totalSelesai = antrian?.filter(a => a.status === 'selesai').length || 0;
  const totalFree    = antrian?.filter(a => Number((a as any).isFree) > 0).length || 0;

  // ── Filtered cars ──
  const filteredCars = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return cars || [];
    return (cars || []).filter(c => c.nama.toLowerCase().includes(q));
  }, [modelSearch, cars]);

  // ── Upah washer dari settings ──
  const getUpahFromSettings = (kat: string, type: 'express' | 'hidrolik') => {
    const key = `upah_washer_${kat}_${type}`;
    const val = settings?.[key];
    if (val) return parseInt(val) || 0;
    return WASHER_UPAH[kat as KategoriMobil]?.[type] || 0;
  };

  // ── Apply services ──
  const applyCarService = (car: CarModel, type: 'express' | 'hidrolik') => {
    const kat = car.kategori as KategoriMobil;
    const harga = KATEGORI_MOBIL_PRICE[kat][type];
    const upah  = getUpahFromSettings(kat, type);
    const nm = type === 'express'
      ? (kat === 'umum' ? 'EXPRESS SMALL/MEDIUM' : kat === 'big' ? 'EXPRESS BESAR/SUV' : 'EXPRESS ALPHARD DAN SEJENISNYA')
      : (kat === 'umum' ? 'HIDROLIK SMALL/MEDIUM' : kat === 'big' ? 'HIDROLIK BESAR/SUV' : 'HIDROLIK ALPHARD DAN SEJENISNYA');
    const svc = SERVICES.find(sv => sv.name === nm);
    setFormServiceId(svc?.id || `${type}_${kat}`);
    setFormServiceName(nm);
    setFormKategori('Reguler');
    setFormHarga(harga);
    setFormUpahWasher(upah);
    setFormSelectedSvc(svc || null);
    setFormPendapatanTP(0);
    setPolesKat(null);
    setShowSvcPicker(false);
  };

  const applyManualService = (svc: Service, kat?: KategoriMobil) => {
    setFormServiceId(svc.id);
    setFormServiceName(svc.name);
    setFormKategori(svc.kategori);
    setFormHarga(svc.harga as number);
    setFormSelectedSvc(svc);
    if (svc.isPolesDinamis) {
      const rk = kat || polesKat || (selectedCar?.kategori as KategoriMobil) || 'umum';
      setFormUpahWasher(getUpahFromSettings(rk, 'hidrolik'));
      setFormPendapatanTP(getPendapatanTPPoles(svc, rk));
    } else if (svc.hasTP) {
      setFormUpahWasher(getUpahWasherTP(svc));
      setFormPendapatanTP(getPendapatanTPTetap(svc));
    } else {
      setFormUpahWasher(selectedCar ? getUpahFromSettings(selectedCar.kategori, cuciType) : 0);
      setFormPendapatanTP(0);
    }
  };

  // ── Mutations ──
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCar)       throw new Error('Pilih model mobil');
      if (!formNopol.trim())  throw new Error('Masukkan nomor polisi');
      if (!formWasher.trim()) throw new Error('Pilih atau isi nama washer');
      if (formSelectedSvc?.hasTP && !formTPName.trim()) throw new Error('Isi nama TP');

      const harga       = formIsFree ? 0 : formHarga;
      const upahWasher  = formIsFree ? 0 : formUpahWasher;
      const pendTP      = formIsFree ? 0 : formPendapatanTP;

      await blink.db.antrian.create({
        id:            `ant_${Date.now()}`,
        tanggal:       today,
        nomor:         nomorBerikut,
        jenis:         KATEGORI_MOBIL_LABEL[selectedCar.kategori as KategoriMobil] || selectedCar.kategori,
        nopol:         formNopol.trim().toUpperCase(),
        modelMobil:    selectedCar.nama,
        kategoriMobil: selectedCar.kategori,
        serviceId:     formServiceId,
        serviceName:   formServiceName,
        kategori:      formKategori,
        harga,
        namaWasher:    formWasher.trim(),
        upahWasher,
        namaTP:        formTPName.trim() || '',
        pendapatanTP:  pendTP,
        ket:           formKet.trim(),
        status:        'antri',
        isFree:        formIsFree ? 1 : 0,
      });

      // ── Auto-update closing aktif ──
      try {
        const settingsRes = await blink.db.appSettings.list();
        const settingsMap: Record<string, string> = {};
        (settingsRes as any[]).forEach((s: any) => { settingsMap[s.key] = s.value; });
        const closingId = settingsMap['closing_aktif_id'];
        if (closingId) {
          // Cek closing masih open
          const closingRes = await blink.db.closingReports.get(closingId);
          const closing = closingRes as any;
          if (closing && closing.status === 'open' && closing.tanggal === today) {
            // Upsert closing_item (grouping per service)
            const existingItems = await blink.db.closingItems.list({ where: { closingId } });
            const existItem = (existingItems as any[]).find(
              (it: any) => (it.serviceId || it.service_id) === formServiceId
            );
            if (existItem && !formIsFree) {
              const newQty    = (existItem.qty || 0) + 1;
              const newJumlah = newQty * harga;
              const newKas    = (existItem.kas || 0) + (formSelectedSvc?.kasDefault || 0);
              const newPW     = (existItem.pendapatanWasher || existItem.pendapatan_washer || 0) + upahWasher;
              const newPT     = (existItem.pendapatanTp || existItem.pendapatan_tp || 0) + pendTP;
              await blink.db.closingItems.update(existItem.id, {
                qty: newQty, jumlah: newJumlah, kas: newKas,
                pendapatanWasher: newPW,
                pendapatanTp: newPT,
                namaTp: formTPName.trim() || existItem.namaTp || existItem.nama_tp || '',
              });
            } else if (!formIsFree) {
              await blink.db.closingItems.create({
                id:               `item_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                closingId,
                serviceId:        formServiceId,
                serviceName:      formServiceName,
                kategori:         formKategori,
                harga,
                qty:              1,
                kas:              formSelectedSvc?.kasDefault || 0,
                jumlah:           harga,
                namaTp:           formTPName.trim() || '',
                pendapatanWasher: upahWasher,
                pendapatanTp:     pendTP,
              });
            }
            // Update total_omset & jumlah_mobil di closing_reports
            const allItems = await blink.db.closingItems.list({ where: { closingId } });
            const newOmset = (allItems as any[]).reduce((s: number, it: any) => s + (it.jumlah || 0), 0) + (formIsFree ? 0 : harga);
            const newJumlahMobil = (closing.jumlahMobil || 0) + 1;
            await blink.db.closingReports.update(closingId, {
              totalOmset:  newOmset,
              jumlahMobil: newJumlahMobil,
              updatedAt:   new Date().toISOString(),
            });
          }
        }
      } catch (_err) {
        // Auto-update gagal tidak blocker — silent
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['antrian', today] });
      qc.invalidateQueries({ queryKey: ['closing_reports'] });
      qc.invalidateQueries({ queryKey: ['closing_items'] });
      closeModal();
    },
    onError:   (e: any) => Alert.alert('Error', e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      blink.db.antrian.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['antrian', today] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => blink.db.antrian.delete(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['antrian', today] });
      qc.invalidateQueries({ queryKey: ['antrian_closing', today] });
      setSelectedItem(null);
    },
  });

  // ── Modal helpers ──
  const openModal = () => {
    setStep('model'); setModelSearch(''); setSelectedCar(null); setCuciType('express');
    setFormNopol(''); setFormServiceId(''); setFormServiceName(''); setFormKategori('');
    setFormHarga(0); setFormUpahWasher(0); setFormWasher(''); setFormTPName('');
    setFormKet(''); setFormSelectedSvc(null); setFormPendapatanTP(0);
    setShowSvcPicker(false); setPolesKat(null); setFormIsFree(false);
    setModalVisible(true);
  };
  const closeModal = () => setModalVisible(false);

  const needsTP = !!formSelectedSvc?.hasTP;
  const isPoles = !!formSelectedSvc?.isPolesDinamis;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>ANTRIAN CUCI</Text>
          <Text style={s.headerSub}>{fmtDate(today)}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openModal}>
          <Ionicons name="add-circle" size={22} color={C.white} />
          <Text style={s.addBtnTxt}>TAMBAH</Text>
        </TouchableOpacity>
      </View>

      {/* ── Stats Bar ── */}
      <View style={s.statsBar}>
        <StatCard label="Total" value={antrian?.length || 0} icon="car" color={C.orange} />
        <StatCard label="Proses" value={antrian?.filter(a => a.status === 'proses').length || 0} icon="construct" color={C.yellow} />
        <StatCard label="Selesai" value={totalSelesai} icon="checkmark-circle" color={C.green} />
        <StatCard label="FREE" value={totalFree} icon="gift" color={C.red} />
        <StatCard label="Omset" value={`${fmt(totalOmset)}`} icon="cash" color={C.purple} small />
      </View>

      {/* ── Table Header ── */}
      <View style={s.tableHead}>
        <Text style={[s.th, { width: 28 }]}>#</Text>
        <Text style={[s.th, { width: 72 }]}>NOPOL</Text>
        <Text style={[s.th, { flex: 1 }]}>MODEL / LAYANAN</Text>
        <Text style={[s.th, { width: 58, textAlign: 'right' }]}>HARGA</Text>
        <Text style={[s.th, { width: 54, textAlign: 'right' }]}>UPAH</Text>
        <Text style={[s.th, { width: 52, textAlign: 'center' }]}>STATUS</Text>
      </View>

      {/* ── List ── */}
      {isLoading ? (
        <View style={s.centerBox}>
          <Ionicons name="hourglass" size={36} color={C.orange} />
          <Text style={s.emptyTxt}>Memuat data...</Text>
        </View>
      ) : !antrian?.length ? (
        <View style={s.centerBox}>
          <Ionicons name="car-outline" size={64} color={C.grayB} />
          <Text style={s.emptyTitle}>Belum Ada Antrian</Text>
          <Text style={s.emptyTxt}>Tap TAMBAH untuk mencatat mobil masuk</Text>
          <TouchableOpacity style={s.emptyAddBtn} onPress={openModal}>
            <Ionicons name="add-circle" size={18} color={C.white} />
            <Text style={s.emptyAddTxt}>Tambah Mobil</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={antrian}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => {
            const isFree     = Number((item as any).isFree) > 0;
            const katColor   = getKatColor((item as any).kategoriMobil);
            const upahWasher = (item as any).upahWasher || 0;
            const pendTP     = (item as any).pendapatanTP || 0;
            const namaTP     = (item as any).namaTP || '';
            return (
              <TouchableOpacity
                style={[s.row, item.status === 'selesai' && s.rowDone, isFree && s.rowFree]}
                onPress={() => setSelectedItem(item)}
                activeOpacity={0.75}
              >
                <View style={[s.rowNo, isFree && { backgroundColor: C.red }]}>
                  <Text style={[s.rowNoTxt, isFree && { color: C.white }]}>{item.nomor}</Text>
                </View>
                <View style={{ width: 72 }}>
                  <Text style={[s.rowNopol, item.status === 'selesai' && s.txtDone]} numberOfLines={1}>
                    {item.nopol}
                  </Text>
                  <Text style={s.rowWasher} numberOfLines={1}>{item.namaWasher}</Text>
                </View>
                <View style={{ flex: 1, paddingRight: 4 }}>
                  {(item as any).modelMobil ? (
                    <View style={[s.modelBadge, { backgroundColor: katColor }]}>
                      <Text style={s.modelBadgeTxt} numberOfLines={1}>{(item as any).modelMobil}</Text>
                    </View>
                  ) : null}
                  <Text style={[s.rowSvc, item.status === 'selesai' && s.txtDone]} numberOfLines={1}>
                    {item.serviceName}
                  </Text>
                  {namaTP ? <Text style={s.rowTP}>TP: {namaTP}</Text> : null}
                </View>
                {isFree ? (
                  <View style={s.freeBadge}>
                    <Ionicons name="gift" size={11} color={C.white} />
                    <Text style={s.freeBadgeTxt}>FREE</Text>
                  </View>
                ) : (
                  <Text style={s.rowPrice}>{fmt(item.harga)}</Text>
                )}
                <View style={{ width: 54, alignItems: 'flex-end' }}>
                  {isFree ? null : (
                    <>
                      {upahWasher > 0 && <Text style={s.rowUpah}>{fmt(upahWasher)}</Text>}
                      {pendTP > 0     && <Text style={s.rowTPVal}>+{fmt(pendTP)}</Text>}
                    </>
                  )}
                </View>
                <View style={{ width: 52, alignItems: 'center' }}>
                  <View style={[s.statusPill, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={s.statusPillTxt}>{getStatusLabel(item.status)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ════════════════ TAMBAH MODAL ════════════════ */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <SafeAreaView style={s.modalSafe}>
          {/* Modal Header */}
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => {
              if (step === 'model') closeModal();
              else if (step === 'nopol')   setStep('model');
              else if (step === 'service') setStep('nopol');
              else setStep('service');
            }}>
              <Ionicons name={step === 'model' ? 'close' : 'arrow-back'} size={24} color={C.white} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.modalTitle}>TAMBAH ANTRIAN</Text>
              <Text style={s.modalSub}>
                {step === 'model'   ? '① Pilih Model Mobil'
                 : step === 'nopol'   ? '② Nomor Polisi'
                 : step === 'service' ? '③ Pilih Layanan'
                 :                     '④ Washer & Opsi'}
              </Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          {/* Step Dots */}
          <View style={s.stepBar}>
            {(['model', 'nopol', 'service', 'washer'] as Step[]).map((st, i) => {
              const idx = ['model', 'nopol', 'service', 'washer'].indexOf(step);
              const done = idx > i;
              const active = step === st;
              return (
                <View key={st} style={s.stepItem}>
                  <View style={[s.stepDot, active && s.stepDotA, done && s.stepDotD]}>
                    {done
                      ? <Ionicons name="checkmark" size={12} color={C.white} />
                      : <Text style={[s.stepDotTxt, (active || done) && { color: C.white }]}>{i + 1}</Text>
                    }
                  </View>
                  {i < 3 && <View style={[s.stepLine, done && s.stepLineD]} />}
                </View>
              );
            })}
          </View>

          {/* ── STEP 1: MODEL ── */}
          {step === 'model' && (
            <View style={{ flex: 1 }}>
              <View style={s.searchWrap}>
                <Ionicons name="search" size={18} color={C.gray} />
                <TextInput style={s.searchInput} placeholder="Cari model mobil..."
                  value={modelSearch} onChangeText={setModelSearch}
                  placeholderTextColor={C.gray} autoFocus />
                {modelSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setModelSearch('')}>
                    <Ionicons name="close-circle" size={18} color={C.gray} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Legenda */}
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 6 }}>
                {KAT_OPTIONS.map(o => (
                  <View key={o.value} style={[s.katLegend, { backgroundColor: o.color + '18' }]}>
                    <View style={[s.katDot, { backgroundColor: o.color }]} />
                    <Text style={[s.katLegendTxt, { color: o.color }]}>{o.label}</Text>
                  </View>
                ))}
              </View>

              {cars?.length === 0 ? (
                <View style={s.centerBox}>
                  <Ionicons name="car-outline" size={48} color={C.grayB} />
                  <Text style={s.emptyTitle}>Belum ada mobil</Text>
                  <Text style={s.emptyTxt}>Tambahkan mobil di menu Pengaturan → Mobil</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredCars}
                  keyExtractor={c => c.id}
                  initialNumToRender={20}
                  renderItem={({ item: car }) => {
                    const opt = KAT_OPTIONS.find(o => o.value === car.kategori) || KAT_OPTIONS[0];
                    const sel = selectedCar?.id === car.id;
                    return (
                      <TouchableOpacity
                        style={[s.carRow, sel && s.carRowSel]}
                        onPress={() => setSelectedCar(car)}
                      >
                        <View style={[s.katDot, { backgroundColor: opt.color, width: 10, height: 10 }]} />
                        <Text style={[s.carNama, sel && { color: C.orange }]}>{car.nama}</Text>
                        <View style={[s.katBadgeSm, { backgroundColor: opt.color + '20' }]}>
                          <Text style={[s.katBadgeSmTxt, { color: opt.color }]}>{opt.label}</Text>
                        </View>
                        {sel && <Ionicons name="checkmark-circle" size={20} color={C.orange} />}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}

              {selectedCar && (
                <View style={s.bottomBar}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.bottomBarName}>{selectedCar.nama}</Text>
                    <Text style={s.bottomBarSub}>
                      {KAT_OPTIONS.find(o => o.value === selectedCar.kategori)?.label}
                    </Text>
                  </View>
                  <TouchableOpacity style={s.nextBtn} onPress={() => setStep('nopol')}>
                    <Text style={s.nextBtnTxt}>Lanjut</Text>
                    <Ionicons name="arrow-forward" size={16} color={C.white} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── STEP 2: NOPOL ── */}
          {step === 'nopol' && (
            <ScrollView contentContainerStyle={{ padding: 18 }}>
              <Text style={s.stepLabel}>Nomor Polisi</Text>
              <View style={s.platePrev}>
                <View style={s.plate}>
                  <Text style={s.plateTxt}>{formNopol || 'H 1234 AB'}</Text>
                </View>
                {selectedCar && (
                  <View style={[s.katBadgeSm, { backgroundColor: getKatColor(selectedCar.kategori) + '20', marginTop: 10 }]}>
                    <Text style={[s.katBadgeSmTxt, { color: getKatColor(selectedCar.kategori) }]}>
                      {selectedCar.nama}
                    </Text>
                  </View>
                )}
              </View>
              <TextInput style={s.nopolInput}
                placeholder="Contoh: H 1234 AB"
                value={formNopol}
                onChangeText={v => setFormNopol(v.toUpperCase())}
                autoCapitalize="characters"
                autoFocus
                placeholderTextColor={C.gray}
              />
              <TouchableOpacity
                style={[s.bigBtn, !formNopol.trim() && s.bigBtnDis]}
                onPress={() => {
                  if (!formNopol.trim()) return;
                  if (selectedCar) applyCarService(selectedCar, cuciType);
                  setStep('service');
                }}
                disabled={!formNopol.trim()}
              >
                <Text style={s.bigBtnTxt}>Lanjut →</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── STEP 3: LAYANAN ── */}
          {step === 'service' && selectedCar && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={s.stepLabel}>Jenis Cuci</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {CUCI_TYPES.map(ct => (
                  <TouchableOpacity
                    key={ct.id}
                    style={[s.cuciBtn, cuciType === ct.id && !showSvcPicker && { borderColor: ct.color, backgroundColor: ct.color + '18' }]}
                    onPress={() => {
                      setCuciType(ct.id);
                      setShowSvcPicker(false);
                      applyCarService(selectedCar, ct.id);
                    }}
                  >
                    <Ionicons name={ct.icon as any} size={22} color={cuciType === ct.id && !showSvcPicker ? ct.color : C.gray} />
                    <Text style={[s.cuciBtnTxt, cuciType === ct.id && !showSvcPicker && { color: ct.color, fontWeight: '800' }]}>
                      {ct.label}
                    </Text>
                    <Text style={s.cuciBtnPrice}>
                      Rp {fmt(KATEGORI_MOBIL_PRICE[selectedCar.kategori as KategoriMobil][ct.id])}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Layanan tambahan */}
              <TouchableOpacity
                style={[s.altBtn, showSvcPicker && { backgroundColor: C.purple, borderColor: C.purple }]}
                onPress={() => setShowSvcPicker(v => !v)}
              >
                <Ionicons name="list" size={16} color={showSvcPicker ? C.white : C.purple} />
                <Text style={[s.altBtnTxt, showSvcPicker && { color: C.white }]}>
                  {showSvcPicker ? '✕ Tutup' : '+ Paket / Poles / Premium'}
                </Text>
              </TouchableOpacity>

              {showSvcPicker && (
                <View style={s.altList}>
                  {['Premium', 'Paket', 'Poles'].map(kat => (
                    <View key={kat}>
                      <Text style={s.altKatHdr}>{kat.toUpperCase()}</Text>
                      {SERVICES.filter(sv => sv.kategori === kat).map(svc => {
                        const isAct = formServiceId === svc.id;
                        let hint = '';
                        if (svc.isPolesDinamis) {
                          const rk = polesKat || (selectedCar.kategori as KategoriMobil);
                          hint = `TP ~${fmt(getPendapatanTPPoles(svc, rk))}`;
                        } else if (svc.hasTP && svc.upahTP) {
                          hint = `TP Rp ${fmt(svc.upahTP)}`;
                        }
                        return (
                          <TouchableOpacity
                            key={svc.id}
                            style={[s.altRow, isAct && s.altRowAct]}
                            onPress={() => applyManualService(svc)}
                          >
                            <View style={[s.radio, isAct && s.radioAct]}>
                              {isAct && <View style={s.radioInner} />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.altName, isAct && { color: C.orange, fontWeight: '700' }]} numberOfLines={2}>
                                {svc.name}
                              </Text>
                              {hint ? <Text style={s.altHint}>{hint}</Text> : null}
                            </View>
                            <Text style={[s.altPrice, isAct && { color: C.orange }]}>Rp {fmt(svc.harga as number)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                  {isPoles && (
                    <View style={s.polesBox}>
                      <Text style={s.polesTitle}>Poles selalu HIDROLIK · Pilih Kategori:</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        {KAT_OPTIONS.map(o => {
                          const tp = formSelectedSvc ? getPendapatanTPPoles(formSelectedSvc, o.value as KategoriMobil) : 0;
                          const act = polesKat === o.value;
                          return (
                            <TouchableOpacity key={o.value}
                              style={[s.polesKatBtn, act && { backgroundColor: o.color, borderColor: o.color }]}
                              onPress={() => { setPolesKat(o.value as KategoriMobil); if (formSelectedSvc) applyManualService(formSelectedSvc, o.value as KategoriMobil); }}
                            >
                              <Text style={[s.polesKatLbl, act && { color: C.white }]}>{o.label}</Text>
                              <Text style={[s.polesKatSub, act && { color: '#FEF9C3' }]}>TP {fmt(tp)}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Service card */}
              <View style={s.svcCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={s.svcCardLabel}>Layanan</Text>
                  <Text style={s.svcCardVal} numberOfLines={2}>{formServiceName}</Text>
                </View>
                <View style={s.svcDiv} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.svcCardLabel}>Harga</Text>
                  <Text style={s.svcCardPrice}>Rp {fmt(formHarga)}</Text>
                </View>
                {formUpahWasher > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={s.svcCardLabel}>Upah Washer</Text>
                    <Text style={[s.svcCardVal, { color: C.green }]}>Rp {fmt(formUpahWasher)}</Text>
                  </View>
                )}
                {needsTP && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={s.svcCardLabel}>Upah TP</Text>
                    <Text style={[s.svcCardVal, { color: C.purple }]}>Rp {fmt(formPendapatanTP)}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={s.bigBtn} onPress={() => setStep('washer')}>
                <Text style={s.bigBtnTxt}>Lanjut →</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── STEP 4: WASHER & FREE ── */}
          {step === 'washer' && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>

              {/* ======= TOGGLE FREE ======= */}
              <TouchableOpacity
                style={[s.freeToggle, formIsFree && s.freeToggleOn]}
                onPress={() => setFormIsFree(v => !v)}
                activeOpacity={0.8}
              >
                <View style={[s.freeIconBox, formIsFree && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Ionicons name="gift" size={22} color={formIsFree ? C.white : C.red} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.freeTitle, formIsFree && { color: C.white }]}>
                    {formIsFree ? '🎁 CUCI FREE / GRATIS' : 'Tandai sebagai Cuci Free'}
                  </Text>
                  <Text style={[s.freeSub, formIsFree && { color: '#FECACA' }]}>
                    {formIsFree
                      ? 'Tidak masuk closing · Tercatat sebagai pengeluaran otomatis'
                      : 'Untuk karyawan, keluarga, atau tamu khusus'}
                  </Text>
                </View>
                <View style={[s.freeSwitch, formIsFree && s.freeSwitchOn]}>
                  <View style={[s.freeSwitchThumb, formIsFree && s.freeSwitchThumbOn]} />
                </View>
              </TouchableOpacity>

              {/* Nama Washer */}
              <Text style={s.stepLabel}>Nama Washer</Text>
              {washerList.length === 0 ? (
                <View style={s.emptyKarBox}>
                  <Ionicons name="person-outline" size={24} color={C.grayB} />
                  <Text style={s.emptyKarTxt}>Belum ada washer. Tambahkan di Pengaturan → Karyawan</Text>
                </View>
              ) : (
                <View style={s.chipWrap}>
                  {washerList.map(w => (
                    <TouchableOpacity key={w.id}
                      style={[s.chip, formWasher === w.nama && s.chipActive]}
                      onPress={() => setFormWasher(w.nama)}
                    >
                      <Text style={[s.chipTxt, formWasher === w.nama && s.chipTxtActive]}>{w.nama}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {/* Juga bisa tulis manual */}
              <TextInput style={s.inputField}
                placeholder="Atau ketik nama washer..."
                value={formWasher}
                onChangeText={setFormWasher}
                placeholderTextColor={C.gray}
              />

              {/* Nama TP */}
              {needsTP && !formIsFree && (
                <>
                  <View style={s.tpSeparator}>
                    <View style={s.tpSepLine} />
                    <View style={s.tpSepBadge}>
                      <Ionicons name="star" size={12} color={C.white} />
                      <Text style={s.tpSepTxt}>TEAM POLISHER</Text>
                    </View>
                    <View style={s.tpSepLine} />
                  </View>
                  <Text style={s.stepLabel}>Nama TP <Text style={{ color: C.purple }}>Rp {fmt(formPendapatanTP)}</Text></Text>
                  {tpList.length === 0 ? (
                    <View style={s.emptyKarBox}>
                      <Text style={s.emptyKarTxt}>Belum ada TP. Tambahkan di Pengaturan → Karyawan</Text>
                    </View>
                  ) : (
                    <View style={s.chipWrap}>
                      {tpList.map(t => (
                        <TouchableOpacity key={t.id}
                          style={[s.chip, s.chipTP, formTPName === t.nama && s.chipTPActive]}
                          onPress={() => setFormTPName(t.nama)}
                        >
                          <Text style={[s.chipTxt, formTPName === t.nama && { color: C.white }]}>{t.nama}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <TextInput style={[s.inputField, { borderColor: C.purple }]}
                    placeholder="Atau ketik nama TP..."
                    value={formTPName}
                    onChangeText={setFormTPName}
                    placeholderTextColor={C.gray}
                  />
                </>
              )}

              {/* Keterangan */}
              <Text style={s.stepLabel}>Keterangan (Opsional)</Text>
              <TextInput style={[s.inputField, { height: 60 }]}
                placeholder="Catatan tambahan..."
                value={formKet} onChangeText={setFormKet}
                multiline placeholderTextColor={C.gray}
              />

              {/* Ringkasan */}
              <View style={s.summary}>
                <Text style={s.summaryTitle}>RINGKASAN ORDER</Text>
                <SRow label="Nopol"   val={formNopol} />
                <SRow label="Model"   val={`${selectedCar?.nama} (${KAT_OPTIONS.find(o => o.value === selectedCar?.kategori)?.label || ''})`} />
                <SRow label="Layanan" val={formServiceName} />
                <SRow label="Washer"  val={formWasher || '-'} />
                <View style={s.summaryDiv} />
                {formIsFree
                  ? <SRow label="Harga" val="🎁 FREE / GRATIS" vc={C.red} bold />
                  : <>
                      <SRow label="Harga"        val={`Rp ${fmt(formHarga)}`}        vc={C.orange} bold />
                      {formUpahWasher > 0 && <SRow label="Upah Washer" val={`Rp ${fmt(formUpahWasher)}`} vc={C.green} />}
                      {needsTP && <SRow label="Upah TP" val={`Rp ${fmt(formPendapatanTP)}`} vc={C.purple} />}
                    </>
                }
              </View>

              <TouchableOpacity
                style={[s.saveBtn, addMutation.isPending && s.saveBtnDis]}
                onPress={() => addMutation.mutate()}
                disabled={addMutation.isPending}
              >
                <Ionicons name="checkmark-circle" size={20} color={C.white} />
                <Text style={s.saveBtnTxt}>
                  {addMutation.isPending ? 'Menyimpan...' : 'SIMPAN ANTRIAN'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* ════════════════ DETAIL MODAL ════════════════ */}
      {selectedItem && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setSelectedItem(null)}>
          <View style={s.detailOverlay}>
            <View style={s.detailBox}>
              {Number((selectedItem as any).isFree) > 0 && (
                <View style={s.freeBanner}>
                  <Ionicons name="gift" size={14} color={C.white} />
                  <Text style={s.freeBannerTxt}>CUCI FREE / GRATIS</Text>
                </View>
              )}
              <View style={s.detailPlate}>
                <Text style={s.detailPlateTxt}>{selectedItem.nopol}</Text>
              </View>
              {(selectedItem as any).modelMobil && (
                <View style={[s.katBadgeSm, { alignSelf: 'center', marginTop: 6, backgroundColor: getKatColor((selectedItem as any).kategoriMobil) + '20' }]}>
                  <Text style={[s.katBadgeSmTxt, { color: getKatColor((selectedItem as any).kategoriMobil) }]}>
                    {(selectedItem as any).modelMobil} · {selectedItem.jenis}
                  </Text>
                </View>
              )}
              <Text style={s.detailNo}>No. Antrian {selectedItem.nomor}</Text>
              <View style={s.detailDiv} />
              <DR label="Layanan" val={selectedItem.serviceName} />
              <DR label="Harga"   val={Number((selectedItem as any).isFree) > 0 ? 'FREE' : `Rp ${fmt(selectedItem.harga)}`}
                  vc={Number((selectedItem as any).isFree) > 0 ? C.red : C.orange} />
              {!Number((selectedItem as any).isFree) && (selectedItem as any).upahWasher > 0 && (
                <DR label="Upah Washer" val={`Rp ${fmt((selectedItem as any).upahWasher)}`} vc={C.green} />
              )}
              {!Number((selectedItem as any).isFree) && (selectedItem as any).pendapatanTP > 0 && (
                <DR label={`Upah TP (${(selectedItem as any).namaTP})`}
                    val={`Rp ${fmt((selectedItem as any).pendapatanTP)}`} vc={C.purple} />
              )}
              <DR label="Washer" val={selectedItem.namaWasher} />
              {selectedItem.ket ? <DR label="Ket" val={selectedItem.ket} /> : null}
              <View style={s.detailDiv} />
              <Text style={s.detailStatusTitle}>Update Status</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {(['antri', 'proses', 'selesai'] as string[]).map(st => (
                  <TouchableOpacity key={st}
                    style={[s.statusBtn, selectedItem.status === st && s.statusBtnActive]}
                    onPress={() => { statusMutation.mutate({ id: selectedItem.id, status: st }); setSelectedItem({ ...selectedItem, status: st }); }}
                  >
                    <Text style={[s.statusBtnTxt, selectedItem.status === st && s.statusBtnTxtActive]}>
                      {st === 'antri' ? '⏳ Antri' : st === 'proses' ? '🔧 Proses' : '✅ Selesai'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={s.delBtn}
                  onPress={() => Alert.alert('Hapus', `Hapus ${selectedItem.nopol}?`, [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate(selectedItem.id) },
                  ])}
                >
                  <Ionicons name="trash-outline" size={16} color={C.red} />
                  <Text style={s.delBtnTxt}>Hapus</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.closeBtn} onPress={() => setSelectedItem(null)}>
                  <Text style={s.closeBtnTxt}>Tutup</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, small }: { label: string; value: any; icon: string; color: string; small?: boolean }) {
  return (
    <View style={s.statCard}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={[s.statVal, { color, fontSize: small ? 11 : 14 }]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}
function SRow({ label, val, vc, bold }: { label: string; val: string; vc?: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</Text>
      <Text style={{ fontSize: bold ? 13 : 11, fontWeight: bold ? '800' : '600', color: vc || '#E5E7EB', maxWidth: '65%', textAlign: 'right' }}>{val}</Text>
    </View>
  );
}
function DR({ label, val, vc }: { label: string; val: string; vc?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      <Text style={{ fontSize: 13, color: C.gray, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: vc || C.dark, maxWidth: '55%', textAlign: 'right' }}>{val}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },

  // Header
  header:      { backgroundColor: C.orange, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  headerSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.orangeD, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22 },
  addBtnTxt:   { color: C.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  // Stats
  statsBar:    { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.grayB, paddingVertical: 6 },
  statCard:    { flex: 1, alignItems: 'center', gap: 1, paddingVertical: 4 },
  statVal:     { fontWeight: '900', fontSize: 14 },
  statLbl:     { fontSize: 9, color: C.gray, fontWeight: '600' },

  // Table
  tableHead:   { flexDirection: 'row', backgroundColor: C.dark, paddingHorizontal: 10, paddingVertical: 8 },
  th:          { fontSize: 9, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: C.white },
  rowDone:     { backgroundColor: C.greenL },
  rowFree:     { backgroundColor: '#FFF5F5' },
  rowNo:       { width: 28, height: 28, borderRadius: 14, backgroundColor: C.grayL, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  rowNoTxt:    { fontSize: 11, fontWeight: '800', color: C.slate },
  rowNopol:    { fontSize: 13, fontWeight: '800', color: C.dark },
  rowWasher:   { fontSize: 10, color: C.gray, marginTop: 1 },
  rowSvc:      { fontSize: 11, color: C.gray, marginTop: 2 },
  rowTP:       { fontSize: 9, color: C.purple, fontWeight: '600', marginTop: 1 },
  rowPrice:    { width: 58, fontSize: 12, fontWeight: '700', color: C.green, textAlign: 'right' },
  rowUpah:     { fontSize: 10, fontWeight: '700', color: C.green },
  rowTPVal:    { fontSize: 9, fontWeight: '700', color: C.purple },
  modelBadge:  { alignSelf: 'flex-start', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginBottom: 2 },
  modelBadgeTxt:{ fontSize: 9, fontWeight: '700', color: C.white },
  txtDone:     { color: C.gray, textDecorationLine: 'line-through' },
  freeBadge:   { width: 48, flexDirection: 'column', alignItems: 'center', gap: 1, backgroundColor: C.red, borderRadius: 8, paddingVertical: 3 },
  freeBadgeTxt:{ fontSize: 8, fontWeight: '800', color: C.white },
  statusPill:  { paddingHorizontal: 5, paddingVertical: 3, borderRadius: 16 },
  statusPillTxt:{ fontSize: 8, fontWeight: '800', color: C.white },

  // Empty
  centerBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: C.slate, marginTop: 14 },
  emptyTxt:    { fontSize: 13, color: C.gray, textAlign: 'center', marginTop: 6 },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.orange, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 20 },
  emptyAddTxt: { color: C.white, fontSize: 14, fontWeight: '700' },

  // Modal
  modalSafe:   { flex: 1, backgroundColor: C.bg },
  modalHeader: { backgroundColor: C.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  modalTitle:  { color: C.white, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  modalSub:    { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },

  // Step bar
  stepBar:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.grayB },
  stepItem:    { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot:     { width: 26, height: 26, borderRadius: 13, backgroundColor: C.grayL, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.grayB },
  stepDotA:    { borderColor: C.orange, backgroundColor: C.orange },
  stepDotD:    { borderColor: C.green, backgroundColor: C.green },
  stepDotTxt:  { fontSize: 11, fontWeight: '700', color: C.gray },
  stepLine:    { flex: 1, height: 2, backgroundColor: C.grayB, marginHorizontal: 2 },
  stepLineD:   { backgroundColor: C.green },

  // Search
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: C.grayB },
  searchInput: { flex: 1, fontSize: 14, color: C.dark },

  // Car list
  carRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', backgroundColor: C.white },
  carRowSel:   { backgroundColor: C.orangeL },
  carNama:     { flex: 1, fontSize: 14, color: C.slate, fontWeight: '500' },
  katDot:      { width: 10, height: 10, borderRadius: 5 },
  katBadgeSm:  { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  katBadgeSmTxt:{ fontSize: 10, fontWeight: '700' },
  katLegend:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  katLegendTxt:{ fontSize: 10, fontWeight: '700' },

  bottomBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.dark, paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  bottomBarName:{ color: C.white, fontSize: 15, fontWeight: '800', flex: 1 },
  bottomBarSub:{ color: '#9CA3AF', fontSize: 11 },
  nextBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.orange, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  nextBtnTxt:  { color: C.white, fontSize: 14, fontWeight: '700' },

  // Nopol step
  stepLabel:   { fontSize: 14, fontWeight: '700', color: C.dark, marginBottom: 12 },
  platePrev:   { alignItems: 'center', marginBottom: 18 },
  plate:       { backgroundColor: C.yellow, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8, borderWidth: 3, borderColor: C.dark },
  plateTxt:    { fontSize: 26, fontWeight: '900', color: C.dark, letterSpacing: 4 },
  nopolInput:  { backgroundColor: C.white, borderWidth: 2, borderColor: C.orange, borderRadius: 12, padding: 14, fontSize: 22, fontWeight: '900', textAlign: 'center', color: C.dark, letterSpacing: 4, marginBottom: 20 },
  bigBtn:      { backgroundColor: C.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  bigBtnDis:   { backgroundColor: '#FCA97A' },
  bigBtnTxt:   { color: C.white, fontSize: 15, fontWeight: '800' },

  // Service step
  cuciBtn:     { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14, borderRadius: 14, borderWidth: 2, borderColor: C.grayB, backgroundColor: C.white },
  cuciBtnTxt:  { fontSize: 13, fontWeight: '600', color: C.gray },
  cuciBtnPrice:{ fontSize: 11, color: C.gray },
  altBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: C.purple, marginBottom: 10 },
  altBtnTxt:   { fontSize: 13, fontWeight: '700', color: C.purple, flex: 1 },
  altList:     { backgroundColor: C.white, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.grayB },
  altKatHdr:   { fontSize: 9, fontWeight: '800', color: C.white, backgroundColor: C.slate, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start', marginTop: 8, marginBottom: 4, letterSpacing: 0.5 },
  altRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8, marginBottom: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  altRowAct:   { borderColor: C.orange, backgroundColor: C.orangeL },
  radio:       { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: C.grayB },
  radioAct:    { borderColor: C.orange },
  radioInner:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.orange, alignSelf: 'center', marginTop: 2 },
  altName:     { fontSize: 11, color: C.slate, fontWeight: '500' },
  altHint:     { fontSize: 10, color: C.purple, marginTop: 1 },
  altPrice:    { fontSize: 11, fontWeight: '700', color: C.gray },
  polesBox:    { backgroundColor: C.purpleL, borderRadius: 10, padding: 10, marginTop: 8 },
  polesTitle:  { fontSize: 11, fontWeight: '700', color: C.purple },
  polesKatBtn: { flex: 1, alignItems: 'center', padding: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#DDD6FE' },
  polesKatLbl: { fontSize: 10, fontWeight: '700', color: C.slate },
  polesKatSub: { fontSize: 9, color: C.purple, marginTop: 2 },
  svcCard:     { backgroundColor: C.dark, borderRadius: 14, padding: 14, marginBottom: 14 },
  svcCardLabel:{ fontSize: 11, color: '#9CA3AF' },
  svcCardVal:  { fontSize: 12, fontWeight: '700', color: C.white, maxWidth: '70%', textAlign: 'right' },
  svcCardPrice:{ fontSize: 18, fontWeight: '900', color: C.orange },
  svcDiv:      { height: 1, backgroundColor: '#374151', marginVertical: 8 },

  // Step 4 – FREE TOGGLE ──────────────────────────────────────
  freeToggle:  {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.redL, borderRadius: 16, padding: 16, marginBottom: 18,
    borderWidth: 2, borderColor: '#FECACA',
  },
  freeToggleOn:{ backgroundColor: C.red, borderColor: C.red },
  freeIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  freeTitle:   { fontSize: 14, fontWeight: '800', color: C.red },
  freeSub:     { fontSize: 10, color: '#EF4444', marginTop: 3, lineHeight: 14 },
  freeSwitch:  { width: 46, height: 26, borderRadius: 13, backgroundColor: '#FECACA', padding: 2 },
  freeSwitchOn:{ backgroundColor: 'rgba(255,255,255,0.3)' },
  freeSwitchThumb:     { width: 22, height: 22, borderRadius: 11, backgroundColor: C.red },
  freeSwitchThumbOn:   { backgroundColor: C.white, alignSelf: 'flex-end' },
  // ─────────────────────────────────────────────────────────────

  chipWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.grayL, borderWidth: 1, borderColor: C.grayB },
  chipActive:  { backgroundColor: C.orange, borderColor: C.orange },
  chipTxt:     { fontSize: 13, fontWeight: '600', color: C.slate },
  chipTxtActive:{ color: C.white },
  chipTP:      { borderColor: '#DDD6FE' },
  chipTPActive:{ backgroundColor: C.purple, borderColor: C.purple },

  tpSeparator:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 },
  tpSepLine:    { flex: 1, height: 1, backgroundColor: C.grayB },
  tpSepBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.purple, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tpSepTxt:     { fontSize: 10, fontWeight: '800', color: C.white, letterSpacing: 0.5 },

  inputField:  { borderWidth: 1.5, borderColor: C.grayB, borderRadius: 10, padding: 12, fontSize: 14, color: C.dark, backgroundColor: C.white, marginBottom: 12 },
  emptyKarBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.grayL, borderRadius: 10, padding: 12, marginBottom: 10 },
  emptyKarTxt: { fontSize: 12, color: C.gray, flex: 1 },

  summary:     { backgroundColor: C.dark, borderRadius: 14, padding: 14, marginBottom: 14 },
  summaryTitle:{ color: C.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  summaryDiv:  { height: 1, backgroundColor: '#374151', marginVertical: 6 },
  saveBtn:     { flexDirection: 'row', gap: 8, backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnDis:  { backgroundColor: '#6EE7B7' },
  saveBtnTxt:  { color: C.white, fontSize: 15, fontWeight: '800' },

  // Detail modal
  detailOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  detailBox:   { backgroundColor: C.white, borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 },
  freeBanner:  { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', backgroundColor: C.red, borderRadius: 8, paddingVertical: 5, marginBottom: 10 },
  freeBannerTxt:{ fontSize: 12, fontWeight: '800', color: C.white, letterSpacing: 0.5 },
  detailPlate: { backgroundColor: C.yellow, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 3, borderColor: C.dark, alignSelf: 'center' },
  detailPlateTxt:{ fontSize: 22, fontWeight: '900', color: C.dark, letterSpacing: 3 },
  detailNo:    { textAlign: 'center', fontSize: 12, color: C.gray, marginTop: 6, marginBottom: 8 },
  detailDiv:   { height: 1, backgroundColor: C.grayB, marginVertical: 8 },
  detailStatusTitle:{ fontSize: 11, fontWeight: '700', color: C.slate, marginBottom: 8, textTransform: 'uppercase' },
  statusBtn:   { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: C.grayB, alignItems: 'center' },
  statusBtnActive:{ borderColor: C.orange, backgroundColor: C.orangeL },
  statusBtnTxt:  { fontSize: 11, fontWeight: '600', color: C.gray },
  statusBtnTxtActive:{ color: C.orange },
  delBtn:      { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center' },
  delBtnTxt:   { fontSize: 13, fontWeight: '600', color: C.red },
  closeBtn:    { flex: 2, paddingVertical: 10, borderRadius: 8, backgroundColor: C.dark, alignItems: 'center' },
  closeBtnTxt: { fontSize: 14, fontWeight: '700', color: C.white },
});
