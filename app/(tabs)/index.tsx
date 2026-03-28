import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import {
  SERVICES, KATEGORI_ORDER, KATEGORI_LABELS, KATEGORI_BUTUH_TP,
  getPendapatanWasher, getPendapatanTP, getPendapatanTPTetap,
  getPendapatanTPPoles, Service,
} from '@/constants/services';
import { WASHER_UPAH, KategoriMobil } from '@/constants/cars';

type QtyMap     = Record<string, number>;
type TPMap      = Record<string, string>;
type KatMap     = Record<string, KategoriMobil>; // serviceId → kategoriMobil (untuk Poles)

const WASHER_LIST = ['Anto', 'Budi', 'Dedi', 'Eko', 'Fajar', 'Guntur', 'Hendra'];

const KAT_MOBIL_OPTIONS: { value: KategoriMobil; label: string; sub: string; color: string }[] = [
  { value: 'umum',    label: 'Umum / Medium', sub: 'Avanza, Xpander, HRV, dll',         color: '#059669' },
  { value: 'big',     label: 'Besar / Big',   sub: 'Fortuner, Pajero, Triton, dll',      color: '#DC2626' },
  { value: 'premium', label: 'Premium',       sub: 'Alphard, Velfire, Land Cruiser, dll', color: '#7C3AED' },
];

function fmt(n: number): string { return n.toLocaleString('id-ID'); }
function getTodayStr(): string { return new Date().toISOString().split('T')[0]; }

/** Hitung pendapatan TP dengan konteks kategori mobil (untuk Poles) */
function calcTP(s: Service, katMobil?: KategoriMobil): number {
  if (s.isPolesDinamis && katMobil) return getPendapatanTPPoles(s, katMobil);
  return getPendapatanTPTetap(s);
}

export default function KasirScreen() {
  const queryClient = useQueryClient();
  const [qtyMap,  setQtyMap]  = useState<QtyMap>({});
  const [tpMap,   setTpMap]   = useState<TPMap>({});
  const [katMap,  setKatMap]  = useState<KatMap>({});  // kategoriMobil per Poles service
  const [kasir,   setKasir]   = useState('');

  // Modal QTY
  const [qtyModal,   setQtyModal]   = useState(false);
  const [qtySvc,     setQtySvc]     = useState<Service | null>(null);
  const [inputQty,   setInputQty]   = useState('');

  // Modal TP
  const [tpModal,    setTpModal]    = useState(false);
  const [tpSvc,      setTpSvc]      = useState<Service | null>(null);
  const [tpCustom,   setTpCustom]   = useState('');
  const [tpShowCust, setTpShowCust] = useState(false);

  // Modal Poles kategori
  const [polesModal, setPolesModal] = useState(false);
  const [polesSvc,   setPolesSvc]   = useState<Service | null>(null);

  const getQty = (id: string) => qtyMap[id] || 0;

  const openQtyModal = (sv: Service) => {
    setQtySvc(sv); setInputQty(String(qtyMap[sv.id] || '')); setQtyModal(true);
  };

  const confirmQty = () => {
    if (!qtySvc) return;
    const val = parseInt(inputQty, 10);
    if (!isNaN(val) && val >= 0) {
      setQtyMap(prev => ({ ...prev, [qtySvc.id]: val }));
      // Jika Poles dan qty > 0, buka picker kategori mobil jika belum dipilih
      if (val > 0 && qtySvc.isPolesDinamis && !katMap[qtySvc.id]) {
        setPolesSvc(qtySvc); setQtyModal(false); setPolesModal(true); return;
      }
    }
    setQtyModal(false);
  };

  const openTPModal = (sv: Service) => {
    setTpSvc(sv); setTpShowCust(false); setTpCustom(''); setTpModal(true);
  };

  const confirmTP = (name: string) => {
    if (!tpSvc) return;
    setTpMap(prev => ({ ...prev, [tpSvc.id]: name }));
    setTpModal(false);
  };

  const increment = (id: string) => {
    const sv = SERVICES.find(s => s.id === id);
    const newQty = (qtyMap[id] || 0) + 1;
    setQtyMap(prev => ({ ...prev, [id]: newQty }));
    if (sv?.isPolesDinamis && newQty === 1 && !katMap[id]) {
      setPolesSvc(sv); setPolesModal(true);
    }
  };
  const decrement = (id: string) => setQtyMap(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) - 1) }));

  // Aggregates
  const totalOmset   = SERVICES.reduce((sum, s) => sum + getQty(s.id) * (s.harga as number), 0);
  const totalKas     = SERVICES.reduce((sum, s) => sum + getQty(s.id) * (s.kasDefault || 0), 0);
  const totalWasher  = SERVICES
    .filter(s => !KATEGORI_BUTUH_TP.includes(s.kategori))
    .reduce((sum, s) => sum + getQty(s.id) * getPendapatanWasher(s.harga as number, s.kasDefault || 0), 0);
  const totalTP = SERVICES
    .filter(s => KATEGORI_BUTUH_TP.includes(s.kategori))
    .reduce((sum, s) => {
      const qty = getQty(s.id);
      return qty > 0 ? sum + qty * calcTP(s, katMap[s.id]) : sum;
    }, 0);
  const totalMobil = SERVICES
    .filter(s => s.kategori !== 'Nitrogen' && s.kategori !== 'Karpet')
    .reduce((sum, s) => sum + getQty(s.id), 0);

  const activeServices = SERVICES.filter(s => getQty(s.id) > 0);
  const missingTP      = activeServices.filter(s => s.hasTP && !tpMap[s.id]);
  const missingKat     = activeServices.filter(s => s.isPolesDinamis && !katMap[s.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!kasir.trim())           throw new Error('Nama kasir harus diisi');
      if (activeServices.length === 0) throw new Error('Belum ada layanan yang diinput');
      if (missingTP.length > 0)    throw new Error(`Isi nama TP untuk: ${missingTP.map(s => s.name).join(', ')}`);
      if (missingKat.length > 0)   throw new Error(`Pilih kategori mobil untuk Poles: ${missingKat.map(s => s.name).join(', ')}`);

      const id = `closing_${Date.now()}`;
      await blink.db.closingReports.create({
        id, tanggal: getTodayStr(), kasir: kasir.trim(), cabang: 'Semarang 3',
        status: 'open', totalOmset, totalOut: 0,
        kasBca: 0, kasBsi: 0, kasCimbBni: 0, kasQrisBca: 0,
        kasMandiri: 0, kasVoucher: 0, kasTunai: 0, totalCashless: 0,
        jumlahMobil: totalMobil, catatan: '',
      });

      for (const s of activeServices) {
        const qty    = getQty(s.id);
        const harga  = s.harga as number;
        const kas    = (s.kasDefault || 0) * qty;
        const jumlah = qty * harga;
        const isTP   = !!s.hasTP;
        const namaTP = tpMap[s.id] || '';
        const pendWasher = isTP ? 0 : getPendapatanWasher(harga, s.kasDefault || 0) * qty;
        const pendTP     = isTP ? calcTP(s, katMap[s.id]) * qty : 0;

        await blink.db.closingItems.create({
          id: `item_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          closingId: id, serviceId: s.id, serviceName: s.name, kategori: s.kategori,
          harga, qty, kas, jumlah, namaTP,
          pendapatanWasher: pendWasher,
          pendapatanTP: pendTP,
        });
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closing_reports'] });
      Alert.alert('Berhasil',
        `Closing tersimpan!\nOmset: Rp ${fmt(totalOmset)}\nKAS: Rp ${fmt(totalKas)}\nPendapatan TP: Rp ${fmt(totalTP)}`,
        [{ text: 'OK', onPress: resetForm }],
      );
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const resetForm = () => { setQtyMap({}); setTpMap({}); setKatMap({}); setKasir(''); };
  const handleReset = () =>
    Alert.alert('Reset', 'Yakin ingin mereset semua data?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetForm },
    ]);

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.logoCircle}><Text style={{ fontSize: 18 }}>🚗</Text></View>
          <View>
            <Text style={s.headerTitle}>ORANGE CARWASH</Text>
            <Text style={s.headerSub}>Cab. Semarang 3 · Closing Harian</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleReset} style={s.resetBtn}>
          <Ionicons name="refresh" size={20} color="#E85D04" />
        </TouchableOpacity>
      </View>

      {/* Kasir */}
      <View style={s.kasirRow}>
        <Ionicons name="person" size={16} color="#6B7280" />
        <TextInput style={s.kasirInput} placeholder="Nama Kasir..."
          value={kasir} onChangeText={setKasir} placeholderTextColor="#9CA3AF" />
      </View>

      {/* Legend */}
      <View style={s.legendBar}>
        <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#059669' }]} /><Text style={s.legendTxt}>Washer = Harga − KAS</Text></View>
        <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#7C3AED' }]} /><Text style={s.legendTxt}>TP = nilai tetap / Poles dinamis (selalu hidrolik)</Text></View>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {KATEGORI_ORDER.map(kat => {
          const services = SERVICES.filter(sv => sv.kategori === kat);
          const isTPKat  = KATEGORI_BUTUH_TP.includes(kat);
          return (
            <View key={kat} style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{KATEGORI_LABELS[kat]}</Text>
                {isTPKat && <View style={s.tpBadge}><Text style={s.tpBadgeText}>BUTUH TP</Text></View>}
              </View>

              {/* Table header */}
              <View style={s.tableHeader}>
                <Text style={[s.th, { flex: 2.5 }]}>JENIS CUCIAN</Text>
                <Text style={[s.th, { width: 34, textAlign: 'center' }]}>HARGA</Text>
                <Text style={[s.th, { width: 28, textAlign: 'center' }]}>KAS</Text>
                <Text style={[s.th, { width: 46, textAlign: 'center', color: isTPKat ? '#7C3AED' : '#059669' }]}>
                  {isTPKat ? 'TP' : 'WASHER'}
                </Text>
                <Text style={[s.th, { width: 36, textAlign: 'center' }]}>QTY</Text>
                <Text style={[s.th, { width: 52, textAlign: 'right' }]}>JUMLAH</Text>
              </View>

              {services.map(sv => {
                const qty        = getQty(sv.id);
                const harga      = sv.harga as number;
                const kas        = sv.kasDefault || 0;
                const namaTP     = tpMap[sv.id];
                const missingTp  = sv.hasTP && qty > 0 && !namaTP;
                const missingK   = sv.isPolesDinamis && qty > 0 && !katMap[sv.id];

                // Kolom TP/Washer per unit
                let colVal = '';
                let colColor = '#059669';
                if (sv.hasTP) {
                  colColor = '#7C3AED';
                  if (sv.isPolesDinamis) {
                    const km = katMap[sv.id];
                    colVal = km
                      ? `${fmt(calcTP(sv, km))}`
                      : '?';
                  } else {
                    colVal = fmt(getPendapatanTPTetap(sv));
                  }
                } else {
                  colVal = fmt(harga - kas);
                }

                return (
                  <View key={sv.id} style={[
                    s.tableRow,
                    qty > 0 && s.tableRowActive,
                    (missingTp || missingK) && s.tableRowWarn,
                  ]}>
                    {/* Nama layanan + info Poles */}
                    <TouchableOpacity style={{ flex: 2.5 }} onPress={() => openQtyModal(sv)}>
                      <Text style={[s.tdName, qty > 0 && s.tdNameActive]} numberOfLines={2}>{sv.name}</Text>
                      {sv.isPolesDinamis && katMap[sv.id] && (
                        <Text style={s.tdKatInfo}>
                          {KAT_MOBIL_OPTIONS.find(k => k.value === katMap[sv.id])?.label} · Hidrolik
                        </Text>
                      )}
                    </TouchableOpacity>

                    <Text style={[s.tdCell, { width: 34, textAlign: 'center' }]}>{(harga / 1000).toFixed(0)}K</Text>
                    <Text style={[s.tdCell, { width: 28, textAlign: 'center', color: '#9CA3AF' }]}>{(kas / 1000).toFixed(0)}K</Text>

                    {/* TP atau Washer */}
                    {sv.hasTP ? (
                      <TouchableOpacity
                        style={[s.tpCol, { width: 46 }, namaTP && s.tpColFilled, (missingTp || missingK) && s.tpColWarn]}
                        onPress={() => {
                          if (sv.isPolesDinamis && !katMap[sv.id]) { setPolesSvc(sv); setPolesModal(true); }
                          else openTPModal(sv);
                        }}
                      >
                        <Text style={[s.tpColText, namaTP && s.tpColTextFilled]} numberOfLines={1}>
                          {missingK ? '?cat' : namaTP ? namaTP.split(' ')[0] : '+TP'}
                        </Text>
                        <Text style={[s.tpColSub, namaTP && { color: '#5B21B6' }]}>{colVal}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={[s.tdSelisih, { width: 46, textAlign: 'center', color: colColor }]}>{colVal}</Text>
                    )}

                    {/* QTY */}
                    <View style={[s.qtyRow, { width: 36 }]}>
                      <TouchableOpacity onPress={() => decrement(sv.id)} style={s.qtyMinus}>
                        <Ionicons name="remove" size={11} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => openQtyModal(sv)} style={s.qtyVal}>
                        <Text style={[s.qtyText, qty > 0 && s.qtyTextActive]}>{qty}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => increment(sv.id)} style={s.qtyPlus}>
                        <Ionicons name="add" size={11} color="#E85D04" />
                      </TouchableOpacity>
                    </View>

                    <Text style={[s.tdJumlah, { width: 52 }, qty > 0 && s.tdJumlahActive]}>
                      {qty > 0 ? fmt(qty * harga) : '-'}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Summary */}
        <View style={s.summaryBox}>
          <SRow label="Jumlah Kendaraan"    value={String(totalMobil)} />
          <SRow label="KAS Perusahaan"      value={`Rp ${fmt(totalKas)}`}    vc="#374151" />
          <SRow label="Pendapatan Washer"   value={`Rp ${fmt(totalWasher)}`} vc="#059669" />
          <SRow label="Pendapatan TP"       value={`Rp ${fmt(totalTP)}`}     vc="#7C3AED" />
          <View style={s.divider} />
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>TOTAL OMSET</Text>
            <Text style={s.totalValue}>Rp {fmt(totalOmset)}</Text>
          </View>
        </View>

        {/* Ringkasan aktif */}
        {activeServices.length > 0 && (
          <View style={s.activeBox}>
            <Text style={s.activeTitle}>Ringkasan Transaksi</Text>
            {activeServices.map(sv => {
              const qty   = getQty(sv.id);
              const harga = sv.harga as number;
              const isTP  = !!sv.hasTP;
              const tpPu  = isTP ? calcTP(sv, katMap[sv.id]) : 0;
              return (
                <View key={sv.id} style={s.activeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.activeName} numberOfLines={1}>{sv.name}</Text>
                    {isTP
                      ? <Text style={s.activeTP}>
                          TP: {tpMap[sv.id] || '⚠ belum diisi'} · Rp {fmt(tpPu)}/unit
                          {sv.isPolesDinamis && katMap[sv.id] ? ` (${KAT_MOBIL_OPTIONS.find(k => k.value === katMap[sv.id])?.label})` : ''}
                        </Text>
                      : <Text style={s.activeWasher}>Washer: Rp {fmt(harga - (sv.kasDefault || 0))}/unit</Text>
                    }
                  </View>
                  <Text style={s.activeQty}>×{qty}</Text>
                  <Text style={s.activeJumlah}>Rp {fmt(qty * harga)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Warnings */}
        {(missingTP.length > 0 || missingKat.length > 0) && (
          <View style={s.warnBox}>
            <Ionicons name="warning" size={16} color="#D97706" />
            <View style={{ flex: 1 }}>
              {missingTP.length > 0 && <Text style={s.warnText}>Belum isi nama TP: {missingTP.map(sv => sv.name).join(', ')}</Text>}
              {missingKat.length > 0 && <Text style={s.warnText}>Pilih kategori mobil untuk Poles: {missingKat.map(sv => sv.name).join(', ')}</Text>}
            </View>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.saveBtn, saveMutation.isPending && s.saveBtnDis]}
          onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}
        >
          <Ionicons name="save" size={20} color="#fff" />
          <Text style={s.saveBtnText}>{saveMutation.isPending ? 'Menyimpan...' : 'SIMPAN CLOSING'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── QTY Modal ── */}
      <Modal visible={qtyModal} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setQtyModal(false)}>
          <TouchableOpacity style={s.modalBox} activeOpacity={1}>
            <Text style={s.modalTitle}>{qtySvc?.name}</Text>
            <Text style={s.modalPrice}>Rp {fmt((qtySvc?.harga as number) || 0)}</Text>
            {qtySvc && (
              <Text style={s.modalKas}>
                KAS: {fmt(qtySvc.kasDefault || 0)}  ·  {qtySvc.hasTP ? '🟣 TP' : '🟢 Washer'}: Rp {fmt(
                  qtySvc.hasTP ? calcTP(qtySvc, katMap[qtySvc.id]) : getPendapatanWasher(qtySvc.harga as number, qtySvc.kasDefault || 0)
                )}
              </Text>
            )}
            <TextInput
              style={s.modalInput} value={inputQty} onChangeText={setInputQty}
              keyboardType="numeric" placeholder="Jumlah" autoFocus placeholderTextColor="#9CA3AF"
            />
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setQtyModal(false)}>
                <Text style={s.modalBtnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnOk} onPress={confirmQty}>
                <Text style={s.modalBtnOkText}>OK</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── TP Picker Modal ── */}
      <Modal visible={tpModal} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setTpModal(false)}>
          <TouchableOpacity style={[s.modalBox, { maxHeight: '80%' }]} activeOpacity={1}>
            <Text style={s.modalTitle}>Pilih Nama TP</Text>
            <Text style={s.modalPrice}>{tpSvc?.name}</Text>
            {tpSvc && (
              <View style={s.tpInfoBox}>
                <Text style={s.tpInfoLabel}>Pendapatan TP per unit</Text>
                <Text style={s.tpInfoVal}>Rp {fmt(calcTP(tpSvc, katMap[tpSvc.id]))}</Text>
                {tpSvc.isPolesDinamis && katMap[tpSvc.id] && (
                  <Text style={s.tpInfoSub}>
                    {fmt(tpSvc.harga as number)} − {fmt(tpSvc.kasDefault || 0)} (KAS) − {fmt(WASHER_UPAH[katMap[tpSvc.id]]['hidrolik'])} (cuci hidrolik)
                  </Text>
                )}
              </View>
            )}
            <ScrollView style={{ maxHeight: 260 }}>
              {WASHER_LIST.map(w => (
                <TouchableOpacity key={w}
                  style={[s.tpPickerRow, tpMap[tpSvc?.id || ''] === w && s.tpPickerRowActive]}
                  onPress={() => confirmTP(w)}>
                  <Ionicons name="person-circle" size={22} color={tpMap[tpSvc?.id || ''] === w ? '#7C3AED' : '#9CA3AF'} />
                  <Text style={[s.tpPickerName, tpMap[tpSvc?.id || ''] === w && s.tpPickerNameActive]}>{w}</Text>
                  {tpMap[tpSvc?.id || ''] === w && <Ionicons name="checkmark" size={18} color="#7C3AED" />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[s.tpPickerRow, tpShowCust && s.tpPickerRowActive]} onPress={() => setTpShowCust(true)}>
                <Ionicons name="create" size={22} color={tpShowCust ? '#7C3AED' : '#9CA3AF'} />
                <Text style={[s.tpPickerName, tpShowCust && s.tpPickerNameActive]}>Nama lain...</Text>
              </TouchableOpacity>
              {tpShowCust && (
                <View style={{ paddingHorizontal: 4, marginTop: 4 }}>
                  <TextInput style={s.tpCustomInput} placeholder="Ketik nama TP..."
                    value={tpCustom} onChangeText={setTpCustom} autoFocus placeholderTextColor="#9CA3AF" />
                  <TouchableOpacity style={[s.modalBtnOk, { marginTop: 8 }]}
                    onPress={() => tpCustom.trim() && confirmTP(tpCustom.trim())}>
                    <Text style={s.modalBtnOkText}>Konfirmasi</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity style={[s.modalBtnCancel, { marginTop: 12 }]} onPress={() => setTpModal(false)}>
              <Text style={s.modalBtnCancelText}>Tutup</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Poles Kategori Mobil Modal (jenis cuci selalu HIDROLIK) ── */}
      <Modal visible={polesModal} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setPolesModal(false)}>
          <TouchableOpacity style={[s.modalBox, { maxHeight: '85%' }]} activeOpacity={1}>
            <Text style={s.modalTitle}>Poles — Pilih Kategori Mobil</Text>
            <Text style={s.modalPrice}>{polesSvc?.name}</Text>
            <View style={s.polesInfoBanner}>
              <Ionicons name="information-circle" size={16} color="#7C3AED" />
              <Text style={s.polesInfoText}>Poles selalu dicuci <Text style={{ fontWeight: '800' }}>HIDROLIK</Text>. Pilih kategori mobil:</Text>
            </View>
            <View style={s.polesInfoFormula}>
              <Text style={s.polesInfoFormulaText}>
                Upah TP = Harga − KAS − Upah Cuci Hidrolik
              </Text>
            </View>

            {KAT_MOBIL_OPTIONS.map(opt => {
              const upahCuci = WASHER_UPAH[opt.value]['hidrolik'];
              const tpVal    = polesSvc ? getPendapatanTPPoles(polesSvc, opt.value) : 0;
              const isAct    = katMap[polesSvc?.id || ''] === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.polesOptRow, isAct && { backgroundColor: opt.color, borderColor: opt.color }]}
                  onPress={() => {
                    if (polesSvc) setKatMap(prev => ({ ...prev, [polesSvc.id]: opt.value }));
                    setPolesModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.polesOptTitle, isAct && { color: '#fff' }]}>{opt.label}</Text>
                    <Text style={[s.polesOptSub, isAct && { color: '#FEF9C3' }]}>{opt.sub}</Text>
                  </View>
                  <View style={s.polesOptRight}>
                    <Text style={[s.polesOptCuci, isAct && { color: '#FEF9C3' }]}>Cuci Rp {fmt(upahCuci)}</Text>
                    <Text style={[s.polesOptTP, isAct && { color: '#fff' }]}>TP Rp {fmt(tpVal)}</Text>
                  </View>
                  {isAct && <Ionicons name="checkmark-circle" size={22} color="#fff" style={{ marginLeft: 8 }} />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={[s.modalBtnCancel, { marginTop: 16 }]} onPress={() => setPolesModal(false)}>
              <Text style={s.modalBtnCancelText}>Tutup</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function SRow({ label, value, vc }: { label: string; value: string; vc?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, color: '#6B7280' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: vc || '#374151' }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E85D04', paddingHorizontal: 16, paddingVertical: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { color: '#FED7AA', fontSize: 10 },
  resetBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 8 },
  kasirRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 8 },
  kasirInput: { flex: 1, fontSize: 14, color: '#1F2937' },
  legendBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendTxt: { fontSize: 9, color: '#6B7280' },
  scroll: { flex: 1 },
  section: { marginTop: 5, backgroundColor: '#fff' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1F2937', paddingHorizontal: 12, paddingVertical: 6 },
  sectionTitle: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  tpBadge: { backgroundColor: '#7C3AED', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  tpBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', alignItems: 'center' },
  th: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.3, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tableRowActive: { backgroundColor: '#FFF7ED' },
  tableRowWarn: { backgroundColor: '#FFFBEB', borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  tdName: { fontSize: 11, color: '#374151', fontWeight: '500', paddingRight: 4 },
  tdNameActive: { color: '#E85D04', fontWeight: '700' },
  tdKatInfo: { fontSize: 9, color: '#7C3AED', fontWeight: '600', marginTop: 1 },
  tdCell: { fontSize: 10, color: '#6B7280' },
  tdSelisih: { fontSize: 11, fontWeight: '700' },
  tpCol: { paddingHorizontal: 2, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  tpColFilled: { backgroundColor: '#EDE9FE' },
  tpColWarn: { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' },
  tpColText: { fontSize: 9, fontWeight: '700', color: '#7C3AED' },
  tpColTextFilled: { color: '#5B21B6' },
  tpColSub: { fontSize: 8, color: '#9CA3AF' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  qtyMinus: { width: 15, height: 15, borderRadius: 3, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  qtyVal: { width: 18, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  qtyTextActive: { color: '#E85D04' },
  qtyPlus: { width: 15, height: 15, borderRadius: 3, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  tdJumlah: { fontSize: 11, fontWeight: '600', color: '#CBD5E1', textAlign: 'right' },
  tdJumlahActive: { color: '#059669' },
  summaryBox: { margin: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#1F2937' },
  totalValue: { fontSize: 18, fontWeight: '900', color: '#E85D04' },
  activeBox: { marginHorizontal: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#E85D04' },
  activeTitle: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 10 },
  activeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  activeName: { fontSize: 11, color: '#374151', fontWeight: '500' },
  activeWasher: { fontSize: 10, color: '#059669', marginTop: 1 },
  activeTP: { fontSize: 10, color: '#7C3AED', marginTop: 1 },
  activeQty: { fontSize: 12, fontWeight: '700', color: '#E85D04', marginHorizontal: 8 },
  activeJumlah: { fontSize: 12, fontWeight: '600', color: '#059669', minWidth: 80, textAlign: 'right' },
  warnBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginHorizontal: 12, marginBottom: 8, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FCD34D' },
  warnText: { fontSize: 11, color: '#92400E' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingBottom: Platform.OS === 'ios' ? 24 : 16 },
  saveBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#E85D04', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnDis: { backgroundColor: '#FCA97A' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '88%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  modalTitle: { fontSize: 13, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  modalPrice: { fontSize: 12, color: '#E85D04', fontWeight: '600' },
  modalKas: { fontSize: 10, color: '#6B7280', marginBottom: 10 },
  modalInput: { borderWidth: 2, borderColor: '#E85D04', borderRadius: 8, padding: 12, fontSize: 20, fontWeight: '700', textAlign: 'center', color: '#1F2937', marginTop: 8 },
  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  modalBtnCancel: { flex: 1, paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  modalBtnOk: { flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: '#E85D04', alignItems: 'center' },
  modalBtnOkText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  tpInfoBox: { backgroundColor: '#F5F3FF', borderRadius: 8, padding: 10, marginBottom: 12 },
  tpInfoLabel: { fontSize: 10, color: '#6B7280' },
  tpInfoVal: { fontSize: 18, fontWeight: '900', color: '#7C3AED' },
  tpInfoSub: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  tpPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, marginBottom: 2 },
  tpPickerRowActive: { backgroundColor: '#EDE9FE' },
  tpPickerName: { flex: 1, fontSize: 15, color: '#374151', fontWeight: '500' },
  tpPickerNameActive: { color: '#7C3AED', fontWeight: '700' },
  tpCustomInput: { borderWidth: 1.5, borderColor: '#7C3AED', borderRadius: 8, padding: 10, fontSize: 15, color: '#1F2937' },
  polesInfoBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F3FF', borderRadius: 8, padding: 10, marginVertical: 10 },
  polesInfoText: { fontSize: 12, color: '#5B21B6', flex: 1 },
  polesInfoFormula: { backgroundColor: '#1F2937', borderRadius: 8, padding: 10, marginBottom: 12 },
  polesInfoFormulaText: { fontSize: 11, color: '#D1D5DB', textAlign: 'center', fontStyle: 'italic' },
  polesOptRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 8, backgroundColor: '#fff' },
  polesOptTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  polesOptSub: { fontSize: 10, color: '#6B7280', marginTop: 1 },
  polesOptRight: { alignItems: 'flex-end' },
  polesOptCuci: { fontSize: 10, color: '#9CA3AF' },
  polesOptTP: { fontSize: 13, fontWeight: '800', color: '#7C3AED' },
});
