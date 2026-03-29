import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import {
  SERVICES, KATEGORI_ORDER, KATEGORI_LABELS, KATEGORI_BUTUH_TP,
  getPendapatanWasher, getPendapatanTP, getPendapatanTPTetap,
  getPendapatanTPPoles, Service,
} from '@/constants/services';
import { WASHER_UPAH, KategoriMobil } from '@/constants/cars';

type QtyMap     = Record<string, number>;
type TPMap      = Record<string, string>;
type KatMap     = Record<string, KategoriMobil>;

// WASHER_LIST sekarang dinamis dari DB (lihat query karyawanList di bawah)

const KAT_MOBIL_OPTIONS: { value: KategoriMobil; label: string; sub: string; color: string; icon: string }[] = [
  { value: 'umum',    label: 'Umum / Medium', sub: 'Avanza, Xpander, HRV, dll',          color: '#059669', icon: 'car-outline' },
  { value: 'big',     label: 'Besar / Big',   sub: 'Fortuner, Pajero, Triton, dll',       color: '#DC2626', icon: 'car-sport-outline' },
  { value: 'premium', label: 'Premium',       sub: 'Alphard, Velfire, Land Cruiser, dll', color: '#7C3AED', icon: 'diamond-outline' },
];

function fmt(n: number): string { return n.toLocaleString('id-ID'); }
function getTodayStr(): string { return new Date().toISOString().split('T')[0]; }

function calcTP(s: Service, katMobil?: KategoriMobil): number {
  if (s.isPolesDinamis && katMobil) return getPendapatanTPPoles(s, katMobil);
  return getPendapatanTPTetap(s);
}

export default function KasirScreen() {
  const queryClient = useQueryClient();
  const [qtyMap,  setQtyMap]  = useState<QtyMap>({});
  const [tpMap,   setTpMap]   = useState<TPMap>({});
  const [katMap,  setKatMap]  = useState<KatMap>({});
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

  // Modal Poles
  const [polesModal, setPolesModal] = useState(false);
  const [polesSvc,   setPolesSvc]   = useState<Service | null>(null);

  // ── DB: Karyawan dinamis ──
  const { data: karyawanList } = useQuery({
    queryKey: ['karyawan'],
    queryFn: async () => {
      const res = await blink.db.karyawan.list({ where: { aktif: '1' }, orderBy: { nama: 'asc' } });
      return res as any[];
    },
  });
  const washerList = karyawanList?.filter((k: any) => k.peran === 'washer' || k.peran === 'both').map((k: any) => k.nama) || [];
  const tpList = karyawanList?.filter((k: any) => k.peran === 'tp' || k.peran === 'both').map((k: any) => k.nama) || [];

  // Settings untuk kasir aktif
  const { data: settingsList } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const res = await blink.db.appSettings.list();
      return res as any[];
    },
  });
  const kasirAktif = settingsList?.find((s: any) => s.key === 'kasir_aktif')?.value || '';
  const shiftAktif = settingsList?.find((s: any) => s.key === 'shift_aktif')?.value || '1';

  const getQty = (id: string) => qtyMap[id] || 0;

  const openQtyModal = (sv: Service) => {
    setQtySvc(sv); setInputQty(String(qtyMap[sv.id] || '')); setQtyModal(true);
  };

  const confirmQty = () => {
    if (!qtySvc) return;
    const val = parseInt(inputQty, 10);
    if (!isNaN(val) && val >= 0) {
      setQtyMap(prev => ({ ...prev, [qtySvc.id]: val }));
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
  const totalWasher = SERVICES.reduce((sum, s) => {
    const qty = getQty(s.id); if (!qty) return sum;
    if (s.isPolesDinamis) {
      const kat = katMap[s.id];
      return kat ? sum + qty * WASHER_UPAH[kat]['hidrolik'] : sum;
    } else if (s.hasTP) {
      return sum + qty * (s.upahWasherTP || 0);
    }
    return sum + qty * getPendapatanWasher(s.harga as number, s.kasDefault || 0);
  }, 0);
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
        let pendWasher: number;
        if (s.isPolesDinamis) {
          const kat = katMap[s.id] || 'umum';
          pendWasher = WASHER_UPAH[kat]['hidrolik'] * qty;
        } else if (s.hasTP) {
          pendWasher = (s.upahWasherTP || 0) * qty;
        } else {
          pendWasher = getPendapatanWasher(harga, s.kasDefault || 0) * qty;
        }
        const pendTP = isTP ? calcTP(s, katMap[s.id]) * qty : 0;

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
      Alert.alert('✅ Berhasil',
        `Closing tersimpan!\nOmset: Rp ${fmt(totalOmset)}\nKAS: Rp ${fmt(totalKas)}\nPendapatan TP: Rp ${fmt(totalTP)}`,
        [{ text: 'OK', onPress: resetForm }],
      );
    },
    onError: (e: any) => Alert.alert('⚠️ Error', e.message),
  });

  const resetForm = () => { setQtyMap({}); setTpMap({}); setKatMap({}); setKasir(''); };
  const handleReset = () =>
    Alert.alert('Reset', 'Yakin ingin mereset semua data?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetForm },
    ]);

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>

      {/* ── PREMIUM HEADER ── */}
      <View style={s.header}>
        {/* Top row: brand + actions */}
        <View style={s.headerTopRow}>
          <View style={s.headerLeft}>
            <View style={s.logoCircle}>
              <Text style={{ fontSize: 18 }}>🚗</Text>
            </View>
            <View>
              <Text style={s.headerTitle}>ORANGE CARWASH</Text>
              <Text style={s.headerSub}>Cab. Semarang 3 · Closing Harian</Text>
            </View>
          </View>

          <View style={s.headerActions}>
            {kasirAktif ? (
              <View style={s.kasirBadge}>
                <Ionicons name="person" size={10} color="#fff" />
                <Text style={s.kasirBadgeTxt}>{kasirAktif} S{shiftAktif}</Text>
              </View>
            ) : null}
            <TouchableOpacity onPress={handleReset} style={s.resetBtn}>
              <Ionicons name="refresh" size={17} color="#E85D04" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Kasir input row */}
        <View style={s.kasirRow}>
          <View style={s.kasirInputWrap}>
            <Ionicons name="person-circle" size={18} color="#E85D04" />
            <TextInput
              style={s.kasirInput}
              placeholder="Nama kasir bertugas..."
              value={kasir}
              onChangeText={setKasir}
              placeholderTextColor="#FCA97A"
            />
            {kasir.length > 0 && (
              <TouchableOpacity onPress={() => setKasir('')}>
                <Ionicons name="close-circle" size={16} color="#FCA97A" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ── LEGEND BAR ── */}
      <View style={s.legendBar}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#059669' }]} />
          <Text style={s.legendTxt}>Washer = Harga − KAS</Text>
        </View>
        <View style={s.legendSep} />
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#7C3AED' }]} />
          <Text style={s.legendTxt}>TP = nilai tetap / Poles dinamis</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {KATEGORI_ORDER.map(kat => {
          const services = SERVICES.filter(sv => sv.kategori === kat);
          const isTPKat  = KATEGORI_BUTUH_TP.includes(kat);
          const katActive = services.filter(sv => getQty(sv.id) > 0).length;
          return (
            <View key={kat} style={s.section}>

              {/* Section Header — premium dark strip */}
              <View style={s.sectionHeader}>
                <View style={s.sectionHeaderLeft}>
                  <View style={[s.sectionAccentBar, { backgroundColor: isTPKat ? '#7C3AED' : '#E85D04' }]} />
                  <Text style={s.sectionTitle}>{KATEGORI_LABELS[kat]}</Text>
                  {katActive > 0 && (
                    <View style={s.sectionCountBadge}>
                      <Text style={s.sectionCountText}>{katActive}</Text>
                    </View>
                  )}
                </View>
                {isTPKat && (
                  <View style={s.tpBadge}>
                    <Ionicons name="people" size={9} color="#fff" />
                    <Text style={s.tpBadgeText}>BUTUH TP</Text>
                  </View>
                )}
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

              {services.map((sv, idx) => {
                const qty        = getQty(sv.id);
                const harga      = sv.harga as number;
                const kas        = sv.kasDefault || 0;
                const namaTP     = tpMap[sv.id];
                const missingTp  = sv.hasTP && qty > 0 && !namaTP;
                const missingK   = sv.isPolesDinamis && qty > 0 && !katMap[sv.id];
                const isLast     = idx === services.length - 1;

                let colVal = '';
                let colColor = '#059669';
                if (sv.hasTP) {
                  colColor = '#7C3AED';
                  if (sv.isPolesDinamis) {
                    const km = katMap[sv.id];
                    colVal = km ? `${fmt(calcTP(sv, km))}` : '?';
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
                    isLast && s.tableRowLast,
                  ]}>
                    {/* Nama layanan */}
                    <TouchableOpacity style={{ flex: 2.5 }} onPress={() => openQtyModal(sv)}>
                      <Text style={[s.tdName, qty > 0 && s.tdNameActive]} numberOfLines={2}>
                        {sv.name}
                      </Text>
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

                    {/* QTY Controls */}
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

        {/* ── SUMMARY BOX ── */}
        <View style={s.summaryBox}>
          <View style={s.summaryHeaderRow}>
            <View style={s.summaryIconWrap}>
              <Ionicons name="stats-chart" size={16} color="#E85D04" />
            </View>
            <Text style={s.summaryBoxTitle}>Ringkasan Closing</Text>
          </View>
          <View style={s.summaryDivider} />
          <SRow label="Jumlah Kendaraan"  value={`${totalMobil} unit`} />
          <SRow label="KAS Perusahaan"    value={`Rp ${fmt(totalKas)}`}    vc="#374151" />
          <SRow label="Pendapatan Washer" value={`Rp ${fmt(totalWasher)}`} vc="#059669" />
          <SRow label="Pendapatan TP"     value={`Rp ${fmt(totalTP)}`}     vc="#7C3AED" />
          <View style={s.divider} />
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>TOTAL OMSET</Text>
            <Text style={s.totalValue}>Rp {fmt(totalOmset)}</Text>
          </View>
        </View>

        {/* ── RINGKASAN AKTIF ── */}
        {activeServices.length > 0 && (
          <View style={s.activeBox}>
            <View style={s.activeBoxHeader}>
              <Ionicons name="receipt" size={14} color="#E85D04" />
              <Text style={s.activeTitle}>Ringkasan Transaksi</Text>
              <View style={s.activeCountBadge}>
                <Text style={s.activeCountText}>{activeServices.length} item</Text>
              </View>
            </View>
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
                  <View style={s.activeQtyBadge}>
                    <Text style={s.activeQtyText}>×{qty}</Text>
                  </View>
                  <Text style={s.activeJumlah}>Rp {fmt(qty * harga)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── WARNINGS ── */}
        {(missingTP.length > 0 || missingKat.length > 0) && (
          <View style={s.warnBox}>
            <View style={s.warnIconWrap}>
              <Ionicons name="warning" size={18} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.warnTitle}>Perlu Dilengkapi</Text>
              {missingTP.length > 0 && (
                <Text style={s.warnText}>• Belum isi nama TP: {missingTP.map(sv => sv.name).join(', ')}</Text>
              )}
              {missingKat.length > 0 && (
                <Text style={s.warnText}>• Pilih kategori mobil untuk Poles: {missingKat.map(sv => sv.name).join(', ')}</Text>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── FOOTER SAVE ── */}
      <View style={s.footer}>
        {activeServices.length > 0 && (
          <View style={s.footerMeta}>
            <Text style={s.footerMetaText}>
              {totalMobil} kendaraan · Rp {fmt(totalOmset)}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[s.saveBtn, saveMutation.isPending && s.saveBtnDis]}
          onPress={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          activeOpacity={0.85}
        >
          <Ionicons name={saveMutation.isPending ? 'hourglass' : 'save'} size={20} color="#fff" />
          <Text style={s.saveBtnText}>
            {saveMutation.isPending ? 'Menyimpan...' : 'SIMPAN CLOSING'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── QTY MODAL ── */}
      <Modal visible={qtyModal} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setQtyModal(false)}>
          <TouchableOpacity style={s.modalBox} activeOpacity={1}>
            <View style={s.modalTopStrip} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{qtySvc?.name}</Text>
              <View style={s.modalPricePill}>
                <Text style={s.modalPrice}>Rp {fmt((qtySvc?.harga as number) || 0)}</Text>
              </View>
            </View>
            {qtySvc && (
              <View style={s.modalInfoRow}>
                <View style={s.modalInfoChip}>
                  <Text style={s.modalInfoChipText}>KAS {fmt(qtySvc.kasDefault || 0)}</Text>
                </View>
                <View style={[s.modalInfoChip, { backgroundColor: qtySvc.hasTP ? '#EDE9FE' : '#DCFCE7' }]}>
                  <Text style={[s.modalInfoChipText, { color: qtySvc.hasTP ? '#7C3AED' : '#059669' }]}>
                    {qtySvc.hasTP ? '🟣 TP' : '🟢 Washer'}: {fmt(
                      qtySvc.hasTP
                        ? calcTP(qtySvc, katMap[qtySvc.id])
                        : getPendapatanWasher(qtySvc.harga as number, qtySvc.kasDefault || 0)
                    )}
                  </Text>
                </View>
              </View>
            )}
            <TextInput
              style={s.modalInput}
              value={inputQty}
              onChangeText={setInputQty}
              keyboardType="numeric"
              placeholder="0"
              autoFocus
              placeholderTextColor="#D1D5DB"
            />
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setQtyModal(false)}>
                <Text style={s.modalBtnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnOk} onPress={confirmQty}>
                <Text style={s.modalBtnOkText}>Konfirmasi</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── TP PICKER MODAL ── */}
      <Modal visible={tpModal} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setTpModal(false)}>
          <TouchableOpacity style={[s.modalBox, { maxHeight: '82%' }]} activeOpacity={1}>
            <View style={[s.modalTopStrip, { backgroundColor: '#7C3AED' }]} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Pilih Nama TP</Text>
              <Text style={[s.modalPrice, { color: '#6B7280', fontSize: 11 }]}>{tpSvc?.name}</Text>
            </View>
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
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {tpList.length === 0 && (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Belum ada TP. Tambah di menu Pengaturan.</Text>
                </View>
              )}
              {tpList.map((w: string) => (
                <TouchableOpacity
                  key={w}
                  style={[s.tpPickerRow, tpMap[tpSvc?.id || ''] === w && s.tpPickerRowActive]}
                  onPress={() => confirmTP(w)}
                >
                  <View style={[s.tpAvatarCircle, tpMap[tpSvc?.id || ''] === w && s.tpAvatarCircleActive]}>
                    <Text style={[s.tpAvatarText, tpMap[tpSvc?.id || ''] === w && { color: '#fff' }]}>
                      {w.charAt(0)}
                    </Text>
                  </View>
                  <Text style={[s.tpPickerName, tpMap[tpSvc?.id || ''] === w && s.tpPickerNameActive]}>
                    {w}
                  </Text>
                  {tpMap[tpSvc?.id || ''] === w && (
                    <Ionicons name="checkmark-circle" size={20} color="#7C3AED" />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[s.tpPickerRow, tpShowCust && s.tpPickerRowActive]}
                onPress={() => setTpShowCust(true)}
              >
                <View style={[s.tpAvatarCircle, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="create" size={14} color={tpShowCust ? '#7C3AED' : '#9CA3AF'} />
                </View>
                <Text style={[s.tpPickerName, tpShowCust && s.tpPickerNameActive]}>Nama lain...</Text>
              </TouchableOpacity>
              {tpShowCust && (
                <View style={{ paddingHorizontal: 4, marginTop: 8 }}>
                  <TextInput
                    style={s.tpCustomInput}
                    placeholder="Ketik nama TP..."
                    value={tpCustom}
                    onChangeText={setTpCustom}
                    autoFocus
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    style={[s.modalBtnOk, { marginTop: 8, backgroundColor: '#7C3AED' }]}
                    onPress={() => tpCustom.trim() && confirmTP(tpCustom.trim())}
                  >
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

      {/* ── POLES KATEGORI MOBIL MODAL ── */}
      <Modal visible={polesModal} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setPolesModal(false)}>
          <TouchableOpacity style={[s.modalBox, { maxHeight: '88%' }]} activeOpacity={1}>
            <View style={s.modalTopStrip} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Poles — Kategori Mobil</Text>
              <Text style={[s.modalPrice, { fontSize: 11, color: '#6B7280' }]}>{polesSvc?.name}</Text>
            </View>

            <View style={s.polesInfoBanner}>
              <Ionicons name="information-circle" size={15} color="#7C3AED" />
              <Text style={s.polesInfoText}>
                Poles selalu dicuci <Text style={{ fontWeight: '800' }}>HIDROLIK</Text>. Pilih kategori mobil:
              </Text>
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
                  <View style={[s.polesOptIconWrap, isAct && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <Ionicons name={opt.icon as any} size={18} color={isAct ? '#fff' : opt.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.polesOptTitle, isAct && { color: '#fff' }]}>{opt.label}</Text>
                    <Text style={[s.polesOptSub, isAct && { color: 'rgba(255,255,255,0.8)' }]}>{opt.sub}</Text>
                  </View>
                  <View style={s.polesOptRight}>
                    <Text style={[s.polesOptCuci, isAct && { color: 'rgba(255,255,255,0.8)' }]}>Cuci Rp {fmt(upahCuci)}</Text>
                    <Text style={[s.polesOptTP, isAct && { color: '#fff' }]}>TP Rp {fmt(tpVal)}</Text>
                  </View>
                  {isAct && <Ionicons name="checkmark-circle" size={22} color="#fff" style={{ marginLeft: 6 }} />}
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
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}>
      <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: vc || '#374151' }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },

  // ── HEADER ──
  header: {
    backgroundColor: '#E85D04',
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: '#C2410C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kasirBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  kasirBadgeTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  resetBtn: {
    width: 34,
    height: 34,
    padding: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  kasirRow: {
    marginTop: 2,
  },
  kasirInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  kasirInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // ── LEGEND ──
  legendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  legendSep: {
    width: 1,
    height: 14,
    backgroundColor: '#FED7AA',
    marginHorizontal: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendTxt: {
    fontSize: 9,
    color: '#92400E',
    fontWeight: '500',
  },

  // ── SCROLL ──
  scroll: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },

  // ── SECTION ──
  section: {
    marginTop: 6,
    marginHorizontal: 0,
    backgroundColor: '#fff',
    borderRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionAccentBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCountBadge: {
    backgroundColor: '#E85D04',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  tpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tpBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ── TABLE ──
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  th: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    minHeight: 48,
  },
  tableRowActive: {
    backgroundColor: '#FFF7ED',
    borderLeftWidth: 3,
    borderLeftColor: '#E85D04',
  },
  tableRowWarn: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tdName: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
    paddingRight: 4,
    lineHeight: 15,
  },
  tdNameActive: {
    color: '#C2410C',
    fontWeight: '700',
  },
  tdKatInfo: {
    fontSize: 9,
    color: '#7C3AED',
    fontWeight: '600',
    marginTop: 2,
  },
  tdCell: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  tdSelisih: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  tpCol: {
    paddingHorizontal: 2,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tpColFilled: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  tpColWarn: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  tpColText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#7C3AED',
  },
  tpColTextFilled: {
    color: '#5B21B6',
  },
  tpColSub: {
    fontSize: 7.5,
    color: '#9CA3AF',
    marginTop: 1,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyMinus: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyVal: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  qtyTextActive: {
    color: '#E85D04',
  },
  qtyPlus: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tdJumlah: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
    textAlign: 'right',
  },
  tdJumlahActive: {
    color: '#059669',
    fontWeight: '800',
  },

  // ── SUMMARY BOX ──
  summaryBox: {
    margin: 12,
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#E85D04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  summaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: 0.2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: 0.3,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#E85D04',
    letterSpacing: 0.3,
  },

  // ── ACTIVE BOX ──
  activeBox: {
    marginHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#E85D04',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  activeBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  activeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
    flex: 1,
  },
  activeCountBadge: {
    backgroundColor: '#FFF0E6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  activeCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E85D04',
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  activeName: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
  },
  activeWasher: {
    fontSize: 10,
    color: '#059669',
    marginTop: 2,
    fontWeight: '500',
  },
  activeTP: {
    fontSize: 10,
    color: '#7C3AED',
    marginTop: 2,
    fontWeight: '500',
  },
  activeQtyBadge: {
    backgroundColor: '#FFF0E6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  activeQtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E85D04',
  },
  activeJumlah: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    minWidth: 80,
    textAlign: 'right',
  },

  // ── WARN BOX ──
  warnBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warnIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 3,
  },
  warnText: {
    fontSize: 10,
    color: '#78350F',
    lineHeight: 15,
    fontWeight: '500',
  },

  // ── FOOTER ──
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 26 : 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#FED7AA',
    shadowColor: '#E85D04',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  footerMeta: {
    alignItems: 'center',
    marginBottom: 8,
  },
  footerMetaText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#E85D04',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C2410C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnDis: {
    backgroundColor: '#FCA97A',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // ── OVERLAY & MODAL ──
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    width: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTopStrip: {
    height: 4,
    backgroundColor: '#E85D04',
    width: '100%',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  modalPricePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0E6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  modalPrice: {
    fontSize: 13,
    color: '#E85D04',
    fontWeight: '700',
  },
  modalInfoRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  modalInfoChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  modalInfoChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  modalKas: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#E85D04',
    borderRadius: 12,
    padding: 14,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1F2937',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    letterSpacing: 2,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingTop: 12,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  modalBtnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalBtnOk: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E85D04',
    alignItems: 'center',
    shadowColor: '#C2410C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  modalBtnOkText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // ── TP MODAL ──
  tpInfoBox: {
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  tpInfoLabel: {
    fontSize: 10,
    color: '#7C3AED',
    fontWeight: '600',
    marginBottom: 2,
  },
  tpInfoVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#7C3AED',
  },
  tpInfoSub: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 3,
    fontStyle: 'italic',
  },
  tpPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 0,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tpPickerRowActive: {
    backgroundColor: '#FAF5FF',
  },
  tpAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tpAvatarCircleActive: {
    backgroundColor: '#7C3AED',
  },
  tpAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6B7280',
  },
  tpPickerName: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  tpPickerNameActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  tpCustomInput: {
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    borderRadius: 10,
    padding: 11,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },

  // ── POLES MODAL ──
  polesInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  polesInfoText: {
    fontSize: 12,
    color: '#5B21B6',
    flex: 1,
    fontWeight: '500',
    lineHeight: 17,
  },
  polesInfoFormula: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  polesInfoFormulaText: {
    fontSize: 11,
    color: '#D1D5DB',
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  polesOptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#fff',
    gap: 10,
  },
  polesOptIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  polesOptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  polesOptSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  polesOptRight: {
    alignItems: 'flex-end',
  },
  polesOptCuci: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  polesOptTP: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7C3AED',
    marginTop: 1,
  },
});
