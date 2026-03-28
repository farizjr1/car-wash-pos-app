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
  SERVICES, getPendapatanTP, getPendapatanTPTetap, getPendapatanTPPoles,
  getPendapatanWasher, getUpahWasherTP, Service,
} from '@/constants/services';
import {
  ALL_CARS, KATEGORI_MOBIL_LABEL, KATEGORI_MOBIL_PRICE,
  WASHER_UPAH, KategoriMobil, CarInfo,
} from '@/constants/cars';

interface AntrianItem {
  id: string; tanggal: string; nomor: number;
  jenis: string; nopol: string;
  modelMobil?: string; kategoriMobil?: string;
  serviceId: string; serviceName: string; kategori: string; harga: number;
  namaWasher: string; upahWasher?: number;
  namaTP?: string; pendapatanTP?: number;
  ket: string; status: string; createdAt: string;
}

const WASHER_LIST = ['Anto', 'Budi', 'Dedi', 'Eko', 'Fajar', 'Guntur', 'Hendra'];
const KAT_MOBIL_OPTIONS: { value: KategoriMobil; label: string; color: string }[] = [
  { value: 'umum',    label: 'Umum / Medium',  color: '#059669' },
  { value: 'big',     label: 'Besar / Big',    color: '#DC2626' },
  { value: 'premium', label: 'Premium',        color: '#7C3AED' },
];

function fmt(n: number): string { return n.toLocaleString('id-ID'); }
function getTodayStr(): string { return new Date().toISOString().split('T')[0]; }
function formatDateDisplay(s: string): string {
  return new Date(s).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

type Step = 'model' | 'nopol' | 'service' | 'washer';
const CUCI_TYPES = [
  { id: 'express',  label: 'EXPRESS',  icon: '⚡' },
  { id: 'hidrolik', label: 'HIDROLIK', icon: '🔧' },
];

export default function AntrianScreen() {
  const queryClient = useQueryClient();
  const today = getTodayStr();

  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState<Step>('model');

  // Step 1 — Model
  const [modelSearch, setModelSearch] = useState('');
  const [selectedCar, setSelectedCar] = useState<CarInfo | null>(null);
  const [cuciType, setCuciType] = useState<'express' | 'hidrolik'>('express');

  // Step 2 — Nopol
  const [formNopol, setFormNopol] = useState('');

  // Step 3 — Service
  const [formServiceId, setFormServiceId] = useState('');
  const [formServiceName, setFormServiceName] = useState('');
  const [formKategori, setFormKategori] = useState('');
  const [formHarga, setFormHarga] = useState(0);
  // upah washer cuci (dari kategori mobil)
  const [formUpahWasher, setFormUpahWasher] = useState(0);
  // TP fields
  const [formPendapatanTP, setFormPendapatanTP] = useState(0);
  const [formSelectedService, setFormSelectedService] = useState<Service | null>(null);
  const [showServicePicker, setShowServicePicker] = useState(false);
  // Untuk Poles: kategori mobil (jenis cuci selalu hidrolik)
  const [polesKatMobil, setPolesKatMobil] = useState<KategoriMobil | null>(null);

  // Step 4 — Washer & TP
  const [formWasher, setFormWasher] = useState('');
  const [formKet, setFormKet] = useState('');
  const [customWasher, setCustomWasher] = useState('');
  const [showCustomWasher, setShowCustomWasher] = useState(false);
  const [formTPName, setFormTPName] = useState('');
  const [showCustomTP, setShowCustomTP] = useState(false);
  const [customTPName, setCustomTPName] = useState('');

  const [selectedItem, setSelectedItem] = useState<AntrianItem | null>(null);

  const filteredCars = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return ALL_CARS;
    return ALL_CARS.filter(c => c.model.toLowerCase().includes(q));
  }, [modelSearch]);

  const { data: antrian, isLoading } = useQuery({
    queryKey: ['antrian', today],
    queryFn: async () => {
      const res = await blink.db.antrian.list({ where: { tanggal: today }, orderBy: { nomor: 'asc' } });
      return res as AntrianItem[];
    },
  });

  const nomorBerikut = (antrian?.length || 0) + 1;
  const totalOmset   = antrian?.reduce((sum, a) => sum + (a.harga || 0), 0) || 0;
  const totalSelesai = antrian?.filter(a => a.status === 'selesai').length || 0;
  const totalUpah    = antrian?.reduce((sum, a) => sum + ((a as any).upahWasher || 0), 0) || 0;
  const totalTP      = antrian?.reduce((sum, a) => sum + ((a as any).pendapatanTP || 0), 0) || 0;

  /** Terapkan layanan cuci biasa berdasar model + jenis cuci */
  const applyCarService = (car: CarInfo, type: 'express' | 'hidrolik') => {
    const harga = KATEGORI_MOBIL_PRICE[car.kategori][type];
    const upah  = WASHER_UPAH[car.kategori][type];
    const svcName = type === 'express'
      ? (car.kategori === 'umum' ? 'EXPRESS SMALL/MEDIUM' : car.kategori === 'big' ? 'EXPRESS BESAR/SUV' : 'EXPRESS ALPHARD DAN SEJENISNYA')
      : (car.kategori === 'umum' ? 'HIDROLIK SMALL/MEDIUM' : car.kategori === 'big' ? 'HIDROLIK BESAR/SUV' : 'HIDROLIK ALPHARD DAN SEJENISNYA');
    const svc = SERVICES.find(s => s.name === svcName && s.kategori === 'Reguler');
    setFormServiceId(svc?.id || `${type}_${car.kategori}`);
    setFormServiceName(svcName);
    setFormKategori('Reguler');
    setFormHarga(harga);
    setFormUpahWasher(upah);
    setFormSelectedService(svc || null);
    setFormPendapatanTP(0);
    setPolesKatMobil(null);
    setShowServicePicker(false);
  };

  /** Terapkan layanan manual (Poles/Paket/Premium) */
  const applyManualService = (svc: Service, kat?: KategoriMobil) => {
    setFormServiceId(svc.id);
    setFormServiceName(svc.name);
    setFormKategori(svc.kategori);
    setFormHarga(svc.harga as number);
    setFormSelectedService(svc);

    if (svc.isPolesDinamis) {
      const resolvedKat = kat || polesKatMobil || selectedCar?.kategori || 'umum';
      // Poles selalu dicuci hidrolik
      const upahCuci = WASHER_UPAH[resolvedKat]['hidrolik'];
      const pendTP   = getPendapatanTPPoles(svc, resolvedKat);
      setFormUpahWasher(upahCuci);
      setFormPendapatanTP(pendTP);
    } else if (svc.hasTP) {
      // Premium/Paket: washer dapat upahWasherTP, TP dapat upahTP
      setFormUpahWasher(getUpahWasherTP(svc));
      setFormPendapatanTP(getPendapatanTPTetap(svc));
    } else {
      const upah = selectedCar ? WASHER_UPAH[selectedCar.kategori][cuciType] : 0;
      setFormUpahWasher(upah);
      setFormPendapatanTP(0);
    }
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const washer = showCustomWasher ? customWasher.trim() : formWasher;
      const namaTP = showCustomTP ? customTPName.trim() : formTPName;
      if (!selectedCar)          throw new Error('Pilih model mobil');
      if (!formNopol.trim())     throw new Error('Masukkan nomor polisi');
      if (!washer)               throw new Error('Pilih atau isi nama washer');
      if (formSelectedService?.hasTP && !namaTP) throw new Error('Isi nama TP untuk layanan ini');

      await blink.db.antrian.create({
        id: `ant_${Date.now()}`,
        tanggal: today,
        nomor: nomorBerikut,
        jenis: KATEGORI_MOBIL_LABEL[selectedCar.kategori],
        nopol: formNopol.trim().toUpperCase(),
        modelMobil: selectedCar.model,
        kategoriMobil: selectedCar.kategori,
        serviceId: formServiceId,
        serviceName: formServiceName,
        kategori: formKategori,
        harga: formHarga,
        namaWasher: washer,
        upahWasher: formUpahWasher,
        namaTP: namaTP || '',
        pendapatanTP: formPendapatanTP,
        ket: formKet.trim(),
        status: 'antri',
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['antrian', today] }); closeModal(); },
    onError:   (e: any) => Alert.alert('Error', e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => blink.db.antrian.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['antrian', today] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => blink.db.antrian.delete(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['antrian', today] }); setSelectedItem(null); },
  });

  const openModal = () => {
    setStep('model'); setModelSearch(''); setSelectedCar(null); setCuciType('express');
    setFormNopol(''); setFormServiceId(''); setFormServiceName(''); setFormKategori('');
    setFormHarga(0); setFormUpahWasher(0); setFormWasher(''); setFormKet('');
    setCustomWasher(''); setShowCustomWasher(false); setFormSelectedService(null);
    setFormPendapatanTP(0); setFormTPName(''); setShowCustomTP(false);
    setCustomTPName(''); setShowServicePicker(false); setPolesKatMobil(null);
    setModalVisible(true);
  };
  const closeModal = () => setModalVisible(false);

  const handleDeleteConfirm = (item: AntrianItem) =>
    Alert.alert('Hapus', `Hapus data mobil ${item.nopol}?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
    ]);

  const getStatusColor = (s: string) => s === 'selesai' ? '#10B981' : s === 'proses' ? '#F59E0B' : '#6B7280';
  const getStatusLabel = (s: string) => s === 'selesai' ? 'Selesai' : s === 'proses' ? 'Proses' : 'Antri';
  const getKatColor = (kat?: string) => kat === 'premium' ? '#7C3AED' : kat === 'big' ? '#DC2626' : '#059669';

  const steps: Step[] = ['model', 'nopol', 'service', 'washer'];
  const needsTP = !!formSelectedService?.hasTP;
  const isPoles = !!formSelectedService?.isPolesDinamis;

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>ANTRIAN CUCI</Text>
          <Text style={s.headerSub}>{formatDateDisplay(today)} · Orange Carwash</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openModal}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.addBtnText}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={s.statsBar}>
        <StatItem value={antrian?.length || 0} label="Total" />
        <View style={s.statDiv} />
        <StatItem value={antrian?.filter(a => a.status === 'proses').length || 0} label="Proses" color="#F59E0B" />
        <View style={s.statDiv} />
        <StatItem value={totalSelesai} label="Selesai" color="#10B981" />
        <View style={s.statDiv} />
        <StatItem value={fmt(totalOmset)} label="Omset" color="#E85D04" small />
        <View style={s.statDiv} />
        <StatItem value={fmt(totalUpah)} label="Washer" color="#059669" small />
        <View style={s.statDiv} />
        <StatItem value={fmt(totalTP)} label="TP" color="#7C3AED" small />
      </View>

      {/* Table header */}
      <View style={s.tableHead}>
        <Text style={[s.th, { width: 26 }]}>NO</Text>
        <Text style={[s.th, { width: 68 }]}>NOPOL</Text>
        <Text style={[s.th, { flex: 1 }]}>MODEL / LAYANAN</Text>
        <Text style={[s.th, { width: 56, textAlign: 'right' }]}>HARGA</Text>
        <Text style={[s.th, { width: 52, textAlign: 'right' }]}>UPAH</Text>
        <Text style={[s.th, { width: 50, textAlign: 'center' }]}>STATUS</Text>
      </View>

      {isLoading ? (
        <View style={s.emptyBox}><Ionicons name="hourglass" size={36} color="#E85D04" /><Text style={s.emptyText}>Memuat...</Text></View>
      ) : !antrian?.length ? (
        <View style={s.emptyBox}>
          <Ionicons name="car-outline" size={60} color="#D1D5DB" />
          <Text style={s.emptyTitle}>Belum Ada Antrian</Text>
          <Text style={s.emptyText}>Tap tombol Tambah untuk mencatat mobil masuk</Text>
          <TouchableOpacity style={s.emptyAddBtn} onPress={openModal}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={s.emptyAddText}>Tambah Mobil</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={antrian} keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item }) => {
            const katColor  = getKatColor((item as any).kategoriMobil);
            const upahWasher = (item as any).upahWasher || 0;
            const pendTP    = (item as any).pendapatanTP || 0;
            const namaTP    = (item as any).namaTP || '';
            return (
              <TouchableOpacity style={[s.tableRow, item.status === 'selesai' && s.tableRowDone]}
                onPress={() => setSelectedItem(item)} activeOpacity={0.7}>
                <Text style={s.tdNo}>{item.nomor}</Text>
                <View style={{ width: 68 }}>
                  <Text style={[s.tdBold, item.status === 'selesai' && s.tdDone]} numberOfLines={1}>{item.nopol}</Text>
                  <Text style={s.tdSub} numberOfLines={1}>{item.namaWasher}</Text>
                </View>
                <View style={{ flex: 1, paddingRight: 4 }}>
                  {(item as any).modelMobil ? (
                    <View style={[s.katBadge, { backgroundColor: katColor, alignSelf: 'flex-start', marginBottom: 2 }]}>
                      <Text style={s.katBadgeText}>{(item as any).modelMobil}</Text>
                    </View>
                  ) : null}
                  <Text style={[s.tdSvc, item.status === 'selesai' && s.tdDone]} numberOfLines={1}>{item.serviceName}</Text>
                  {namaTP ? <Text style={s.tdTP}>TP: {namaTP}</Text> : null}
                </View>
                <Text style={s.tdPrice}>{fmt(item.harga)}</Text>
                <View style={{ width: 52, alignItems: 'flex-end' }}>
                  {upahWasher > 0 && <Text style={s.tdUpah}>{fmt(upahWasher)}</Text>}
                  {pendTP > 0 && <Text style={s.tdTPVal}>TP {fmt(pendTP)}</Text>}
                </View>
                <View style={{ width: 50, alignItems: 'center' }}>
                  <View style={[s.statusPill, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={s.statusPillText}>{getStatusLabel(item.status)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ========== ADD MODAL ========== */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <SafeAreaView style={s.modalSafe}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => {
              if (step === 'model') closeModal();
              else if (step === 'nopol') setStep('model');
              else if (step === 'service') setStep('nopol');
              else setStep('service');
            }}>
              <Ionicons name={step === 'model' ? 'close' : 'arrow-back'} size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.modalTitle}>Tambah Antrian</Text>
              <Text style={s.modalSub}>
                {step === 'model' ? '① Model Mobil' : step === 'nopol' ? '② Nomor Polisi'
                  : step === 'service' ? '③ Pilih Layanan' : '④ Washer & TP'}
              </Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          {/* Step dots */}
          <View style={s.stepRow}>
            {steps.map((st, i) => (
              <View key={st} style={s.stepItem}>
                <View style={[s.stepDot, step === st && s.stepDotActive, steps.indexOf(step) > i && s.stepDotDone]}>
                  <Text style={[s.stepDotText, (step === st || steps.indexOf(step) > i) && s.stepDotTextActive]}>{i + 1}</Text>
                </View>
                {i < 3 && <View style={[s.stepLine, steps.indexOf(step) > i && s.stepLineDone]} />}
              </View>
            ))}
          </View>

          {/* ── STEP 1: MODEL ── */}
          {step === 'model' && (
            <View style={{ flex: 1 }}>
              <View style={s.searchBox}>
                <Ionicons name="search" size={18} color="#9CA3AF" />
                <TextInput style={s.searchInput} placeholder="Cari model... (Avanza, Fortuner, Alphard)"
                  value={modelSearch} onChangeText={setModelSearch} placeholderTextColor="#9CA3AF" autoFocus />
                {modelSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setModelSearch('')}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.legendRow}>
                {KAT_MOBIL_OPTIONS.map(o => (
                  <View key={o.value} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: o.color }]} />
                    <Text style={s.legendText}>{o.label}</Text>
                  </View>
                ))}
              </View>
              <FlatList
                data={filteredCars} keyExtractor={item => item.model} style={{ flex: 1 }} initialNumToRender={20}
                renderItem={({ item }) => {
                  const kc = getKatColor(item.kategori);
                  const isSel = selectedCar?.model === item.model;
                  return (
                    <TouchableOpacity style={[s.carItem, isSel && s.carItemSel]} onPress={() => setSelectedCar(item)}>
                      <View style={[s.carKatDot, { backgroundColor: kc }]} />
                      <Text style={[s.carModel, isSel && s.carModelSel]}>{item.model}</Text>
                      <Text style={[s.carKatLbl, { color: kc }]}>{KATEGORI_MOBIL_LABEL[item.kategori]}</Text>
                      {isSel && <Ionicons name="checkmark-circle" size={20} color={kc} />}
                    </TouchableOpacity>
                  );
                }}
              />
              {selectedCar && (
                <View style={s.carSelBar}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.carSelName}>{selectedCar.model}</Text>
                    <Text style={s.carSelKat}>{KATEGORI_MOBIL_LABEL[selectedCar.kategori]}</Text>
                  </View>
                  <TouchableOpacity style={s.nextBtnSm} onPress={() => setStep('nopol')}>
                    <Text style={s.nextBtnSmText}>Lanjut →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── STEP 2: NOPOL ── */}
          {step === 'nopol' && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={s.stepLbl}>Nomor Polisi</Text>
              <View style={s.nopolPreview}>
                <View style={s.nopolPlate}>
                  <Text style={s.nopolPlateText}>{formNopol || 'H 1234 AB'}</Text>
                </View>
                {selectedCar && (
                  <View style={s.nopolCarInfo}>
                    <View style={[s.katBadgeLg, { backgroundColor: getKatColor(selectedCar.kategori) }]}>
                      <Text style={s.katBadgeLgText}>{selectedCar.model}</Text>
                    </View>
                    <Text style={s.nopolHint}>{KATEGORI_MOBIL_LABEL[selectedCar.kategori]}</Text>
                  </View>
                )}
              </View>
              <TextInput style={s.nopolInput} placeholder="Contoh: H 1234 AB"
                value={formNopol} onChangeText={v => setFormNopol(v.toUpperCase())}
                autoCapitalize="characters" autoFocus placeholderTextColor="#9CA3AF" />
              <TouchableOpacity
                style={[s.nextBtn, !formNopol.trim() && s.nextBtnDis]}
                onPress={() => {
                  if (!formNopol.trim()) return;
                  if (selectedCar) applyCarService(selectedCar, cuciType);
                  setStep('service');
                }}
                disabled={!formNopol.trim()}
              >
                <Text style={s.nextBtnText}>Lanjut →</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── STEP 3: LAYANAN ── */}
          {step === 'service' && selectedCar && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={s.stepLbl}>Jenis Cuci</Text>

              {/* Toggle Express / Hidrolik (untuk cuci biasa) */}
              <View style={s.cuciToggle}>
                {CUCI_TYPES.map(ct => (
                  <TouchableOpacity
                    key={ct.id}
                    style={[s.cuciBtn, cuciType === ct.id && !showServicePicker && s.cuciBtnActive]}
                    onPress={() => {
                      const t = ct.id as 'express' | 'hidrolik';
                      setCuciType(t);
                      setShowServicePicker(false);
                      applyCarService(selectedCar, t);
                    }}
                  >
                    <Text style={s.cuciIcon}>{ct.icon}</Text>
                    <Text style={[s.cuciBtnText, cuciType === ct.id && !showServicePicker && s.cuciBtnTextActive]}>
                      {ct.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tombol layanan tambahan */}
              <TouchableOpacity
                style={[s.altBtn, showServicePicker && s.altBtnActive]}
                onPress={() => setShowServicePicker(!showServicePicker)}
              >
                <Ionicons name="list" size={16} color={showServicePicker ? '#fff' : '#7C3AED'} />
                <Text style={[s.altBtnText, showServicePicker && { color: '#fff' }]}>
                  {showServicePicker ? 'Tutup' : '+ Paket / Poles / Premium'}
                </Text>
              </TouchableOpacity>

              {showServicePicker && (
                <View style={s.altList}>
                  {['Premium', 'Paket', 'Poles'].map(kat => (
                    <View key={kat}>
                      <Text style={s.altKatHdr}>{kat.toUpperCase()}</Text>
                      {SERVICES.filter(sv => sv.kategori === kat).map(svc => {
                        const isAct = formServiceId === svc.id;
                        // Untuk Poles: hitung estimasi TP pakai kategori mobil terpilih
                        let tpHint = '';
                        if (svc.isPolesDinamis) {
                          const kat2 = polesKatMobil || selectedCar.kategori;
                          const tp = getPendapatanTPPoles(svc, kat2);
                          tpHint = `TP ~${fmt(tp)} (${KATEGORI_MOBIL_LABEL[kat2]}, hidrolik)`;
                        } else if (svc.hasTP && svc.upahTP !== undefined) {
                          tpHint = `TP Rp ${fmt(svc.upahTP)}`;
                        }
                        return (
                          <TouchableOpacity
                            key={svc.id}
                            style={[s.altRow, isAct && s.altRowActive]}
                            onPress={() => applyManualService(svc)}
                          >
                            <View style={[s.radioDot, isAct && s.radioDotActive]}>
                              {isAct && <View style={s.radioDotInner} />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.altName, isAct && s.altNameActive]} numberOfLines={2}>{svc.name}</Text>
                              {tpHint ? <Text style={s.altTP}>{tpHint}</Text> : null}
                            </View>
                            <Text style={[s.altPrice, isAct && { color: '#059669' }]}>Rp {fmt(svc.harga as number)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}

                  {/* Poles: pilih kategori mobil (jenis cuci sudah pasti HIDROLIK) */}
                  {isPoles && (
                    <View style={s.polesKatBox}>
                      <Text style={s.polesKatTitle}>🔧 Poles selalu HIDROLIK · Pilih Kategori Mobil:</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        {KAT_MOBIL_OPTIONS.map(o => {
                          const upahCuci = WASHER_UPAH[o.value]['hidrolik'];
                          const tp = formSelectedService
                            ? getPendapatanTPPoles(formSelectedService, o.value)
                            : 0;
                          const isAct = polesKatMobil === o.value;
                          return (
                            <TouchableOpacity
                              key={o.value}
                              style={[s.polesKatBtn, isAct && { backgroundColor: o.color, borderColor: o.color }]}
                              onPress={() => {
                                setPolesKatMobil(o.value);
                                if (formSelectedService) applyManualService(formSelectedService, o.value);
                              }}
                            >
                              <Text style={[s.polesKatBtnLbl, isAct && { color: '#fff' }]}>{o.label}</Text>
                              <Text style={[s.polesKatBtnSub, isAct && { color: '#FEF9C3' }]}>
                                Cuci {fmt(upahCuci)} · TP {fmt(tp)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Detail card */}
              <View style={s.svcCard}>
                <SvcCardRow label="Model" right={
                  <View style={[s.katBadgeLg, { backgroundColor: getKatColor(selectedCar.kategori) }]}>
                    <Text style={s.katBadgeLgText}>{selectedCar.model} · {KATEGORI_MOBIL_LABEL[selectedCar.kategori]}</Text>
                  </View>
                } />
                <SvcCardRow label="Layanan" rightText={formServiceName} />
                <View style={s.svcCardDiv} />
                <SvcCardRow label="Harga" rightText={`Rp ${fmt(formHarga)}`} rightColor="#E85D04" large />
                {formUpahWasher > 0 && (
                  <SvcCardRow label="Upah Washer (Hidrolik)" rightText={`Rp ${fmt(formUpahWasher)}`} rightColor="#059669" />
                )}
                {needsTP && (
                  <SvcCardRow label="Pendapatan TP" rightText={`Rp ${fmt(formPendapatanTP)}`} rightColor="#A78BFA" />
                )}
                {isPoles && formSelectedService && (
                  <View style={s.formulaBox}>
                    <Text style={s.formulaText}>
                      {fmt(formHarga)} − {fmt(formSelectedService.kasDefault || 0)} (KAS) − {fmt(formUpahWasher)} (cuci) = Rp {fmt(formPendapatanTP)}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={s.nextBtn} onPress={() => setStep('washer')}>
                <Text style={s.nextBtnText}>Lanjut →</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── STEP 4: WASHER & TP ── */}
          {step === 'washer' && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={s.stepLbl}>Nama Washer</Text>
              <View style={s.chipGrid}>
                {WASHER_LIST.map(w => (
                  <TouchableOpacity
                    key={w}
                    style={[s.chip, formWasher === w && !showCustomWasher && s.chipActive]}
                    onPress={() => { setFormWasher(w); setShowCustomWasher(false); }}
                  >
                    <Text style={[s.chipText, formWasher === w && !showCustomWasher && s.chipTextActive]}>{w}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[s.chip, showCustomWasher && s.chipActive]}
                  onPress={() => { setShowCustomWasher(true); setFormWasher(''); }}
                >
                  <Text style={[s.chipText, showCustomWasher && s.chipTextActive]}>+ Lainnya</Text>
                </TouchableOpacity>
              </View>
              {showCustomWasher && (
                <TextInput style={s.textInput} placeholder="Nama washer..."
                  value={customWasher} onChangeText={setCustomWasher} autoFocus placeholderTextColor="#9CA3AF" />
              )}

              {/* TP section */}
              {needsTP && (
                <>
                  <View style={s.tpHdr}>
                    <View style={[s.tpHdrDot]} />
                    <Text style={s.tpHdrTitle}>Nama TP (Tenaga Premium)</Text>
                    <View style={s.tpHdrBadge}>
                      <Text style={s.tpHdrBadgeText}>Rp {fmt(formPendapatanTP)}</Text>
                    </View>
                  </View>
                  <View style={s.chipGrid}>
                    {WASHER_LIST.map(w => (
                      <TouchableOpacity
                        key={w}
                        style={[s.chip, s.chipTP, formTPName === w && !showCustomTP && s.chipTPActive]}
                        onPress={() => { setFormTPName(w); setShowCustomTP(false); }}
                      >
                        <Text style={[s.chipText, formTPName === w && !showCustomTP && s.chipTPActiveText]}>{w}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[s.chip, s.chipTP, showCustomTP && s.chipTPActive]}
                      onPress={() => { setShowCustomTP(true); setFormTPName(''); }}
                    >
                      <Text style={[s.chipText, showCustomTP && s.chipTPActiveText]}>+ Lainnya</Text>
                    </TouchableOpacity>
                  </View>
                  {showCustomTP && (
                    <TextInput style={[s.textInput, { borderColor: '#7C3AED' }]}
                      placeholder="Nama TP..." value={customTPName} onChangeText={setCustomTPName}
                      autoFocus placeholderTextColor="#9CA3AF" />
                  )}
                </>
              )}

              <Text style={[s.stepLbl, { marginTop: 14 }]}>Keterangan (Opsional)</Text>
              <TextInput style={[s.textInput, { height: 65 }]} placeholder="Catatan tambahan..."
                value={formKet} onChangeText={setFormKet} multiline placeholderTextColor="#9CA3AF" />

              {/* Ringkasan */}
              <View style={s.summary}>
                <Text style={s.summaryTitle}>RINGKASAN</Text>
                <SumRow label="Nopol"   value={formNopol} />
                <SumRow label="Model"   value={`${selectedCar?.model} (${KATEGORI_MOBIL_LABEL[selectedCar?.kategori || 'umum']})`} />
                <SumRow label="Layanan" value={formServiceName} />
                <View style={s.summaryDiv} />
                <SumRow label="Harga"        value={`Rp ${fmt(formHarga)}`}        color="#E85D04" />
                {formUpahWasher > 0 && <SumRow label="Upah Washer" value={`Rp ${fmt(formUpahWasher)}`} color="#059669" />}
                {needsTP && <SumRow label="Pendapatan TP" value={`Rp ${fmt(formPendapatanTP)}`} color="#A78BFA" />}
              </View>

              <TouchableOpacity
                style={[s.saveBtn, addMutation.isPending && s.saveBtnDis]}
                onPress={() => addMutation.mutate()} disabled={addMutation.isPending}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.saveBtnText}>{addMutation.isPending ? 'Menyimpan...' : 'SIMPAN ANTRIAN'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* ========== DETAIL MODAL ========== */}
      {selectedItem && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setSelectedItem(null)}>
          <View style={s.detailOverlay}>
            <View style={s.detailBox}>
              <View style={s.detailPlate}>
                <Text style={s.detailPlateText}>{selectedItem.nopol}</Text>
              </View>
              {(selectedItem as any).modelMobil && (
                <View style={[s.katBadgeLg, { alignSelf: 'center', marginTop: 6, backgroundColor: getKatColor((selectedItem as any).kategoriMobil) }]}>
                  <Text style={s.katBadgeLgText}>{(selectedItem as any).modelMobil} · {selectedItem.jenis}</Text>
                </View>
              )}
              <Text style={s.detailNo}>No. {selectedItem.nomor}</Text>
              <View style={s.detailDiv} />
              <DR label="Layanan" value={selectedItem.serviceName} />
              <DR label="Harga"   value={`Rp ${fmt(selectedItem.harga)}`} vc="#E85D04" />
              {(selectedItem as any).upahWasher > 0 && (
                <DR label="Upah Washer" value={`Rp ${fmt((selectedItem as any).upahWasher)}`} vc="#059669" />
              )}
              {(selectedItem as any).pendapatanTP > 0 && (
                <DR label={`Pendapatan TP (${(selectedItem as any).namaTP || '-'})`}
                  value={`Rp ${fmt((selectedItem as any).pendapatanTP)}`} vc="#7C3AED" />
              )}
              <DR label="Washer" value={selectedItem.namaWasher} />
              {selectedItem.ket ? <DR label="Ket" value={selectedItem.ket} /> : null}
              <View style={s.detailDiv} />
              <Text style={s.detailStatusTitle}>Update Status</Text>
              <View style={s.detailStatusRow}>
                {(['antri', 'proses', 'selesai'] as string[]).map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[s.detailStatusBtn, selectedItem.status === st && s.detailStatusBtnActive]}
                    onPress={() => { updateStatusMutation.mutate({ id: selectedItem.id, status: st }); setSelectedItem({ ...selectedItem, status: st }); }}
                  >
                    <Text style={[s.detailStatusBtnText, selectedItem.status === st && s.detailStatusBtnTextActive]}>
                      {st === 'antri' ? '⏳ Antri' : st === 'proses' ? '🔧 Proses' : '✅ Selesai'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.detailActRow}>
                <TouchableOpacity style={s.detailDelBtn} onPress={() => handleDeleteConfirm(selectedItem)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={s.detailDelText}>Hapus</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.detailCloseBtn} onPress={() => setSelectedItem(null)}>
                  <Text style={s.detailCloseBtnText}>Tutup</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ── Small helpers ──
function StatItem({ value, label, color, small }: { value: any; label: string; color?: string; small?: boolean }) {
  return (
    <View style={s.statItem}>
      <Text style={[s.statNum, color && { color }, small && { fontSize: 11 }]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}
function SvcCardRow({ label, right, rightText, rightColor, large }: { label: string; right?: React.ReactNode; rightText?: string; rightColor?: string; large?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 }}>
      <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</Text>
      {right || <Text style={{ fontSize: large ? 17 : 12, fontWeight: large ? '900' : '600', color: rightColor || '#E5E7EB', maxWidth: '65%', textAlign: 'right' }}>{rightText}</Text>}
    </View>
  );
}
function DR({ label, value, vc }: { label: string; value: string; vc?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      <Text style={{ fontSize: 13, color: '#6B7280', flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: vc || '#1F2937', maxWidth: '55%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
function SumRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color: color || '#E5E7EB', maxWidth: '65%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E85D04', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { color: '#FED7AA', fontSize: 11, marginTop: 1 },
  addBtn: { flexDirection: 'row', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  statsBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingVertical: 8 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 14, fontWeight: '900', color: '#1F2937' },
  statLbl: { fontSize: 9, color: '#9CA3AF', marginTop: 1 },
  statDiv: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  tableHead: { flexDirection: 'row', backgroundColor: '#1F2937', paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center' },
  th: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#fff' },
  tableRowDone: { backgroundColor: '#F0FDF4' },
  tdNo: { width: 26, fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  tdBold: { fontSize: 12, fontWeight: '800', color: '#1F2937' },
  tdSvc: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  tdSub: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  tdTP: { fontSize: 9, color: '#7C3AED', fontWeight: '600', marginTop: 1 },
  tdDone: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  tdPrice: { width: 56, fontSize: 11, fontWeight: '700', color: '#059669', textAlign: 'right' },
  tdUpah: { fontSize: 10, fontWeight: '700', color: '#059669' },
  tdTPVal: { fontSize: 9, fontWeight: '700', color: '#7C3AED' },
  katBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  katBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  statusPill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 20 },
  statusPillText: { fontSize: 8, fontWeight: '800', color: '#fff' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 6 },
  emptyAddBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#E85D04', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 20, alignItems: 'center' },
  emptyAddText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalSafe: { flex: 1, backgroundColor: '#F9FAFB' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E85D04', paddingHorizontal: 16, paddingVertical: 14 },
  modalTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  modalSub: { color: '#FED7AA', fontSize: 11, marginTop: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E5E7EB' },
  stepDotActive: { borderColor: '#E85D04', backgroundColor: '#E85D04' },
  stepDotDone: { borderColor: '#10B981', backgroundColor: '#10B981' },
  stepDotText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  stepDotTextActive: { color: '#fff' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 3 },
  stepLineDone: { backgroundColor: '#10B981' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937' },
  legendRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: '#6B7280' },
  carItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', backgroundColor: '#fff' },
  carItemSel: { backgroundColor: '#FFF7ED' },
  carKatDot: { width: 8, height: 8, borderRadius: 4 },
  carModel: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
  carModelSel: { color: '#E85D04', fontWeight: '700' },
  carKatLbl: { fontSize: 10, fontWeight: '600' },
  carSelBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', padding: 14, paddingHorizontal: 16, gap: 12 },
  carSelName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  carSelKat: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  nextBtnSm: { backgroundColor: '#E85D04', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  nextBtnSmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  stepLbl: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  nopolPreview: { alignItems: 'center', marginBottom: 20 },
  nopolPlate: { backgroundColor: '#F59E0B', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8, borderWidth: 3, borderColor: '#1F2937' },
  nopolPlateText: { fontSize: 26, fontWeight: '900', color: '#1F2937', letterSpacing: 4 },
  nopolCarInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  nopolHint: { fontSize: 12, color: '#6B7280' },
  nopolInput: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#E85D04', borderRadius: 12, padding: 14, fontSize: 22, fontWeight: '800', textAlign: 'center', color: '#1F2937', letterSpacing: 4, marginBottom: 20 },
  cuciToggle: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  cuciBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  cuciBtnActive: { borderColor: '#E85D04', backgroundColor: '#FFF7ED' },
  cuciIcon: { fontSize: 18 },
  cuciBtnText: { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
  cuciBtnTextActive: { color: '#E85D04' },
  altBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#7C3AED', marginBottom: 10 },
  altBtnActive: { backgroundColor: '#7C3AED' },
  altBtnText: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  altList: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  altKatHdr: { fontSize: 10, fontWeight: '800', color: '#fff', backgroundColor: '#374151', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 6, marginTop: 8, letterSpacing: 0.5 },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8, marginBottom: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  altRowActive: { borderColor: '#E85D04', backgroundColor: '#FFF7ED' },
  radioDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioDotActive: { borderColor: '#E85D04' },
  radioDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E85D04' },
  altName: { fontSize: 11, color: '#374151', fontWeight: '500' },
  altNameActive: { color: '#E85D04', fontWeight: '700' },
  altTP: { fontSize: 10, color: '#7C3AED', marginTop: 1 },
  altPrice: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  polesKatBox: { backgroundColor: '#F5F3FF', borderRadius: 10, padding: 12, marginTop: 8 },
  polesKatTitle: { fontSize: 11, fontWeight: '700', color: '#5B21B6' },
  polesKatBtn: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#DDD6FE', alignItems: 'center' },
  polesKatBtnLbl: { fontSize: 11, fontWeight: '700', color: '#374151' },
  polesKatBtnSub: { fontSize: 9, color: '#7C3AED', marginTop: 2, textAlign: 'center' },
  svcCard: { backgroundColor: '#1F2937', borderRadius: 14, padding: 14, marginBottom: 14 },
  svcCardDiv: { height: 1, backgroundColor: '#374151', marginVertical: 4 },
  formulaBox: { backgroundColor: '#374151', borderRadius: 6, padding: 8, marginTop: 4 },
  formulaText: { fontSize: 10, color: '#D1D5DB', textAlign: 'center' },
  katBadgeLg: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  katBadgeLgText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#E85D04', borderColor: '#E85D04' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#fff' },
  chipTP: { borderColor: '#DDD6FE' },
  chipTPActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipTPActiveText: { color: '#fff' },
  tpHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 10 },
  tpHdrDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' },
  tpHdrTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1F2937' },
  tpHdrBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tpHdrBadgeText: { fontSize: 11, fontWeight: '800', color: '#7C3AED' },
  textInput: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 15, color: '#1F2937', marginBottom: 4 },
  summary: { backgroundColor: '#1F2937', borderRadius: 12, padding: 14, marginVertical: 14 },
  summaryTitle: { color: '#fff', fontSize: 11, fontWeight: '800', marginBottom: 10, letterSpacing: 0.5 },
  summaryDiv: { height: 1, backgroundColor: '#374151', marginVertical: 6 },
  nextBtn: { backgroundColor: '#E85D04', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  nextBtnDis: { backgroundColor: '#FCA97A' },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  saveBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnDis: { backgroundColor: '#6EE7B7' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  detailBox: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  detailPlate: { backgroundColor: '#F59E0B', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 3, borderColor: '#1F2937', alignSelf: 'center' },
  detailPlateText: { fontSize: 22, fontWeight: '900', color: '#1F2937', letterSpacing: 3 },
  detailNo: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 4, marginBottom: 8 },
  detailDiv: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 10 },
  detailStatusTitle: { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailStatusRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  detailStatusBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center' },
  detailStatusBtnActive: { borderColor: '#E85D04', backgroundColor: '#FFF7ED' },
  detailStatusBtnText: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  detailStatusBtnTextActive: { color: '#E85D04' },
  detailActRow: { flexDirection: 'row', gap: 10 },
  detailDelBtn: { flexDirection: 'row', gap: 6, flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center' },
  detailDelText: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
  detailCloseBtn: { flex: 2, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1F2937', alignItems: 'center' },
  detailCloseBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
