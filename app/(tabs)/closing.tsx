import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import { ClosingReport } from '@/types/closing';

/**
 * LOGIKA CLOSING:
 *
 * 1. Pengeluaran OTOMATIS (dari data antrian hari ini):
 *    - Cuci FREE    → pengeluaran "free/p.free"  = upah_washer mobil tsb (11K/13K/15K)
 *    - Kategori Big → pengeluaran "big/p.big"    = Rp 2.000 per mobil big
 *    - Kategori Prem (layanan Premium) → pengeluaran "prem/p.prem" = Rp 4.000 per mobil premium
 *
 * 2. Cashless:
 *    - BCA Kolom   = QRIS masuk (bukan transfer BCA biasa)
 *    - Total Cashless = QRIS_BCA + BCA_Transfer + BSI + CIMB_BNI + Mandiri + Voucher
 *                     - Penjualan_Mart - Penjualan_ACC
 *    - Field "Jual Mart" & "Jual ACC" adalah pengurang cashless
 *
 * 3. Pendapatan Total = Total Harga (semua cuci) - Total KAS = Upah Washer + TP
 *
 * 4. Rekap Akhir:
 *    - Omset Bersih = Total KAS - Total Pengeluaran
 *    - Tunai Rill   = Omset Bersih - Total Cashless
 */

function fmt(n: number) { return n.toLocaleString('id-ID'); }
function getTodayStr()   { return new Date().toISOString().split('T')[0]; }
function formatDateLong(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

// Upah washer berdasar kategori mobil (reguler)
const UPAH_WASHER_BY_KAT: Record<string, number> = {
  umum: 11000,
  big: 13000,
  premium: 15000,
};

interface AutoPengeluaran {
  jenis: string;
  harga: number;
  keterangan: string;
}

interface PengItem { jenis: string; harga: string }

export default function ClosingScreen() {
  const queryClient = useQueryClient();

  // ── Fetch latest open closing report ──
  const { data: reports } = useQuery({
    queryKey: ['closing_reports'],
    queryFn: async () => {
      const res = await blink.db.closingReports.list({ orderBy: { createdAt: 'desc' }, limit: 10 });
      return res as ClosingReport[];
    },
  });

  const latestOpen = reports?.find(r => r.status === 'open');

  // ── Fetch closing items ──
  const { data: items } = useQuery({
    queryKey: ['closing_items', latestOpen?.id],
    queryFn: async () => {
      if (!latestOpen?.id) return [];
      return await blink.db.closingItems.list({ where: { closingId: latestOpen.id } });
    },
    enabled: !!latestOpen?.id,
  });

  // ── Fetch antrian hari ini (untuk auto-pengeluaran) ──
  const today = latestOpen?.tanggal || getTodayStr();
  const { data: antrian } = useQuery({
    queryKey: ['antrian_closing', today],
    queryFn: async () => {
      const res = await blink.db.antrian.list({ where: { tanggal: today } });
      return res as any[];
    },
    enabled: !!latestOpen,
  });

  // ── Fetch existing pengeluaran (sudah tersimpan) ──
  const { data: savedPeng } = useQuery({
    queryKey: ['pengeluaran', latestOpen?.id],
    queryFn: async () => {
      if (!latestOpen?.id) return [];
      return await blink.db.pengeluaran.list({ where: { closingId: latestOpen.id } });
    },
    enabled: !!latestOpen?.id,
  });

  // ── Hitung auto-pengeluaran dari antrian ──
  const autoPengeluaran = useMemo<AutoPengeluaran[]>(() => {
    if (!antrian) return [];
    const result: AutoPengeluaran[] = [];

    let totalFree = 0;
    let countBig = 0;
    let countPrem = 0;

    for (const a of antrian) {
      const isFree    = Number(a.isFree || a.is_free || 0) > 0;
      const katMobil  = a.kategoriMobil || a.kategori_mobil || 'umum';
      const upahWasher= UPAH_WASHER_BY_KAT[katMobil] || 11000;

      if (isFree) {
        totalFree += upahWasher;
      }

      // Big: semua mobil kategori big (kecuali free)
      if (!isFree && katMobil === 'big') countBig++;

      // Premium: mobil yang pakai layanan cuci premium
      const kategoriLayanan = a.kategori || '';
      if (!isFree && kategoriLayanan === 'Premium') countPrem++;
    }

    if (totalFree > 0) {
      result.push({ jenis: 'free/p.free', harga: totalFree, keterangan: `Cuci free (upah washer)` });
    }
    if (countBig > 0) {
      result.push({ jenis: 'big/p.big', harga: countBig * 2000, keterangan: `${countBig} mobil big × Rp 2.000` });
    }
    if (countPrem > 0) {
      result.push({ jenis: 'prem/p.prem', harga: countPrem * 4000, keterangan: `${countPrem} mobil premium × Rp 4.000` });
    }

    return result;
  }, [antrian]);

  // ── Hitung rekap dari closing items ──
  const { totalHargaCuci, totalKasItems, totalPendapatanWasher, totalPendapatanTP, tpRekapMap } =
    useMemo(() => {
      let totalHargaCuci = 0;
      let totalKasItems = 0;
      let totalPendapatanWasher = 0;
      let totalPendapatanTP = 0;
      const tpRekapMap: Record<string, number> = {};

      if (items) {
        (items as any[]).forEach((item: any) => {
          const jumlah = item.jumlah || 0;
          const kas    = item.kas || 0;
          const pw     = item.pendapatanWasher || item.pendapatan_washer || 0;
          const pt     = item.pendapatanTP || item.pendapatan_tp || 0;
          const namaTP = item.namaTP || item.nama_tp || '';

          totalHargaCuci          += jumlah;
          totalKasItems           += kas;
          totalPendapatanWasher   += pw;
          totalPendapatanTP       += pt;

          if (namaTP && pt > 0) {
            tpRekapMap[namaTP] = (tpRekapMap[namaTP] || 0) + pt;
          }
        });
      }
      return { totalHargaCuci, totalKasItems, totalPendapatanWasher, totalPendapatanTP, tpRekapMap };
    }, [items]);

  // ── Payment state ──
  const [qrisBca,   setQrisBca]   = useState('');
  const [bca,       setBca]       = useState(''); // BCA Transfer
  const [bsi,       setBsi]       = useState('');
  const [cimbBni,   setCimbBni]   = useState('');
  const [mandiri,   setMandiri]   = useState('');
  const [voucher,   setVoucher]   = useState('');
  const [jualMart,  setJualMart]  = useState(''); // pengurang cashless
  const [jualAcc,   setJualAcc]   = useState(''); // pengurang cashless

  // ── Pengeluaran manual tambahan ──
  const [manualPeng, setManualPeng] = useState<PengItem[]>([
    { jenis: '', harga: '' }, { jenis: '', harga: '' }, { jenis: '', harga: '' },
  ]);

  const parseNum = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;

  // Total cashless = semua pembayaran non-tunai - jual mart - jual acc
  const totalCashlessGross = parseNum(qrisBca) + parseNum(bca) + parseNum(bsi) +
    parseNum(cimbBni) + parseNum(mandiri) + parseNum(voucher);
  const totalCashless = Math.max(0, totalCashlessGross - parseNum(jualMart) - parseNum(jualAcc));

  // Total pengeluaran = auto + manual + sudah tersimpan
  const totalAutoOut  = autoPengeluaran.reduce((s, p) => s + p.harga, 0);
  const totalManualOut= manualPeng.reduce((s, p) => s + parseNum(p.harga), 0);
  const totalSavedOut = (savedPeng as any[])?.reduce((s: number, p: any) => s + (p.harga || 0), 0) || 0;
  const totalOut      = totalAutoOut + totalManualOut + totalSavedOut;

  const omset = latestOpen?.totalOmset || 0;

  // Omset Bersih = Total KAS - Total Pengeluaran
  const omsetBersih = omset - totalOut;

  // Tunai Rill = Omset Bersih - Total Cashless
  const tunaiRill = omsetBersih - totalCashless;

  // Verifikasi: Total Harga - Total KAS = Pendapatan (Washer + TP)
  const totalPendapatan = totalHargaCuci - totalKasItems;

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!latestOpen?.id) throw new Error('Tidak ada closing aktif');

      // Simpan auto-pengeluaran
      for (const p of autoPengeluaran) {
        await blink.db.pengeluaran.create({
          id: `peng_auto_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          closingId: latestOpen.id,
          jenis: p.jenis,
          harga: p.harga,
        });
      }

      // Simpan pengeluaran manual
      for (const p of manualPeng) {
        if (p.jenis.trim() && parseNum(p.harga) > 0) {
          await blink.db.pengeluaran.create({
            id: `peng_manual_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            closingId: latestOpen.id,
            jenis: p.jenis,
            harga: parseNum(p.harga),
          });
        }
      }

      await blink.db.closingReports.update(latestOpen.id, {
        status:       'closed',
        kasBca:       parseNum(bca),
        kasBsi:       parseNum(bsi),
        kasCimbBni:   parseNum(cimbBni),
        kasQrisBca:   parseNum(qrisBca),
        kasMandiri:   parseNum(mandiri),
        kasVoucher:   parseNum(voucher),
        kasTunai:     tunaiRill,
        totalCashless,
        totalOut,
        updatedAt:    new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closing_reports'] });
      queryClient.invalidateQueries({ queryKey: ['pengeluaran', latestOpen?.id] });
      Alert.alert('Closing Berhasil ✅',
        `Omset: Rp ${fmt(omset)}\nOmset Bersih: Rp ${fmt(omsetBersih)}\nCashless: Rp ${fmt(totalCashless)}\nTunai Rill: Rp ${fmt(Math.max(0, tunaiRill))}`,
        [{
          text: 'OK', onPress: () => {
            setBca(''); setBsi(''); setCimbBni(''); setQrisBca('');
            setMandiri(''); setVoucher(''); setJualMart(''); setJualAcc('');
            setManualPeng([{ jenis: '', harga: '' }, { jenis: '', harga: '' }, { jenis: '', harga: '' }]);
          }
        }],
      );
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  if (!latestOpen) {
    return (
      <SafeAreaView style={st.safeArea} edges={['top']}>
        <View style={st.header}>
          <Text style={st.headerTitle}>CLOSING HARIAN</Text>
          <Text style={st.headerSub}>Orange Carwash - Semarang 3</Text>
        </View>
        <View style={st.emptyBox}>
          <Ionicons name="document-outline" size={60} color="#D1D5DB" />
          <Text style={st.emptyTitle}>Belum Ada Closing Aktif</Text>
          <Text style={st.emptyDesc}>Input data layanan di tab Kasir terlebih dahulu</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safeArea} edges={['top']}>
      <View style={st.header}>
        <View>
          <Text style={st.headerTitle}>CLOSING HARIAN</Text>
          <Text style={st.headerSub}>{formatDateLong(latestOpen.tanggal)}</Text>
        </View>
        <View style={st.statusBadge}><Text style={st.statusTxt}>AKTIF</Text></View>
      </View>

      <ScrollView style={st.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Info Dasar ── */}
        <View style={st.card}>
          <IRow label="Kasir"              value={latestOpen.kasir} />
          <IRow label="Jumlah Kendaraan"   value={`${latestOpen.jumlahMobil}`} />
          <IRow label="Total Omset"        value={`Rp ${fmt(omset)}`} vc="#E85D04" large />
        </View>

        {/* ── Rekap Pendapatan ── */}
        <View style={st.card}>
          <Text style={st.cardTitle}>REKAP PENDAPATAN</Text>
          <Text style={st.cardDesc}>
            Total Harga Cuci − Total KAS = Pendapatan (Washer + TP)
          </Text>

          <View style={st.formulaRow}>
            <View style={st.formulaBox}>
              <Text style={st.formulaLbl}>Total Harga</Text>
              <Text style={st.formulaVal}>Rp {fmt(totalHargaCuci)}</Text>
            </View>
            <Text style={st.formulaOp}>−</Text>
            <View style={st.formulaBox}>
              <Text style={st.formulaLbl}>Total KAS</Text>
              <Text style={st.formulaVal}>Rp {fmt(totalKasItems)}</Text>
            </View>
            <Text style={st.formulaOp}>=</Text>
            <View style={[st.formulaBox, { backgroundColor: '#ECFDF5' }]}>
              <Text style={[st.formulaLbl, { color: '#065F46' }]}>Pendapatan</Text>
              <Text style={[st.formulaVal, { color: '#059669' }]}>Rp {fmt(totalPendapatan)}</Text>
            </View>
          </View>

          <View style={st.pendapatanRow}>
            <View style={[st.pendapatanBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="water" size={14} color="#059669" />
              <Text style={st.pendapatanLbl}>Washer</Text>
              <Text style={[st.pendapatanVal, { color: '#059669' }]}>Rp {fmt(totalPendapatanWasher)}</Text>
            </View>
            <View style={[st.pendapatanBox, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="star" size={14} color="#7C3AED" />
              <Text style={st.pendapatanLbl}>TP</Text>
              <Text style={[st.pendapatanVal, { color: '#7C3AED' }]}>Rp {fmt(totalPendapatanTP)}</Text>
            </View>
          </View>

          {/* Breakdown per TP */}
          {Object.keys(tpRekapMap).length > 0 && (
            <View style={st.tpBreakdown}>
              <Text style={st.tpBreakdownTitle}>Rincian per TP:</Text>
              {Object.entries(tpRekapMap).map(([nama, total]) => (
                <View key={nama} style={st.tpRow}>
                  <Ionicons name="person" size={13} color="#7C3AED" />
                  <Text style={st.tpName}>{nama}</Text>
                  <Text style={st.tpTotal}>Rp {fmt(total)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Detail Layanan ── */}
        {items && (items as any[]).length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>DETAIL LAYANAN</Text>
            <View style={st.tableHead}>
              <Text style={[st.th, { flex: 2.5 }]}>LAYANAN</Text>
              <Text style={[st.th, { width: 26, textAlign: 'center' }]}>QTY</Text>
              <Text style={[st.th, { width: 50, textAlign: 'center' }]}>KAS</Text>
              <Text style={[st.th, { width: 52, textAlign: 'center', color: '#7C3AED' }]}>TP</Text>
              <Text style={[st.th, { width: 60, textAlign: 'right' }]}>JUMLAH</Text>
            </View>
            {(items as any[]).map((item: any, i: number) => {
              const namaTP = item.namaTP || item.nama_tp || '';
              const pt = item.pendapatanTP || item.pendapatan_tp || 0;
              const kas = item.kas || 0;
              return (
                <View key={i} style={st.tableRow}>
                  <View style={{ flex: 2.5 }}>
                    <Text style={st.tdName} numberOfLines={2}>{item.serviceName || item.service_name}</Text>
                    {namaTP ? <Text style={st.tdTP}>TP: {namaTP} +{fmt(pt)}</Text> : null}
                  </View>
                  <Text style={[st.td, { width: 26, textAlign: 'center' }]}>{item.qty}</Text>
                  <Text style={[st.td, { width: 50, textAlign: 'center', color: '#6B7280' }]}>{fmt(kas)}</Text>
                  <Text style={[st.td, { width: 52, textAlign: 'center', color: '#7C3AED', fontWeight: '700' }]}>
                    {pt > 0 ? fmt(pt) : '-'}
                  </Text>
                  <Text style={[st.td, { width: 60, textAlign: 'right', color: '#059669', fontWeight: '700' }]}>
                    {fmt(item.jumlah)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Pengeluaran Otomatis ── */}
        <View style={st.card}>
          <Text style={st.cardTitle}>PENGELUARAN OTOMATIS</Text>
          <Text style={st.cardDesc}>Dihitung otomatis dari data antrian hari ini</Text>

          {autoPengeluaran.length === 0 ? (
            <View style={st.autoPengEmpty}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={st.autoPengEmptyTxt}>Tidak ada pengeluaran otomatis</Text>
            </View>
          ) : (
            autoPengeluaran.map((p, i) => (
              <View key={i} style={st.autoPengRow}>
                <View style={st.autoPengIcon}>
                  <Ionicons
                    name={p.jenis.includes('free') ? 'gift' : p.jenis.includes('big') ? 'car-sport' : 'star'}
                    size={14}
                    color={p.jenis.includes('free') ? '#DC2626' : p.jenis.includes('big') ? '#D97706' : '#7C3AED'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.autoPengJenis}>{p.jenis}</Text>
                  <Text style={st.autoPengKet}>{p.keterangan}</Text>
                </View>
                <Text style={st.autoPengHarga}>- Rp {fmt(p.harga)}</Text>
              </View>
            ))
          )}

          {/* Pengeluaran manual tambahan */}
          <Text style={[st.cardTitle, { marginTop: 14 }]}>PENGELUARAN MANUAL</Text>
          {manualPeng.map((p, i) => (
            <View key={i} style={st.pengRow}>
              <Text style={st.pengNo}>{i + 1}</Text>
              <TextInput
                style={[st.pengInput, { flex: 2 }]}
                placeholder="Jenis pengeluaran..."
                value={p.jenis}
                onChangeText={v => { const a = [...manualPeng]; a[i].jenis = v; setManualPeng(a); }}
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                style={[st.pengInput, { flex: 1 }]}
                placeholder="Harga"
                value={p.harga}
                onChangeText={v => { const a = [...manualPeng]; a[i].harga = v; setManualPeng(a); }}
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          ))}
          <TouchableOpacity
            style={st.addPengBtn}
            onPress={() => setManualPeng(prev => [...prev, { jenis: '', harga: '' }])}
          >
            <Ionicons name="add-circle-outline" size={16} color="#E85D04" />
            <Text style={st.addPengBtnTxt}>Tambah baris</Text>
          </TouchableOpacity>

          <View style={st.totalOutRow}>
            <View>
              <Text style={st.totalOutLabel}>TOTAL PENGELUARAN</Text>
              <Text style={st.totalOutSub}>Auto: {fmt(totalAutoOut)} + Manual: {fmt(totalManualOut)}</Text>
            </View>
            <Text style={st.totalOutValue}>Rp {fmt(totalOut)}</Text>
          </View>
        </View>

        {/* ── Pembayaran Cashless ── */}
        <View style={st.card}>
          <Text style={st.cardTitle}>PEMBAYARAN CASHLESS</Text>
          <Text style={st.cardDesc}>
            Total Cashless = (QRIS + Transfer) − Jual Mart − Jual ACC
          </Text>

          <View style={st.payGrid}>
            <PayField label="QRIS BCA" value={qrisBca} setter={setQrisBca} />
            <PayField label="BCA Transfer" value={bca} setter={setBca} />
            <PayField label="BSI" value={bsi} setter={setBsi} />
            <PayField label="CIMB / BNI" value={cimbBni} setter={setCimbBni} />
            <PayField label="Mandiri" value={mandiri} setter={setMandiri} />
            <PayField label="Voucher" value={voucher} setter={setVoucher} />
          </View>

          {/* Pengurang cashless */}
          <View style={[st.payGrid, { marginTop: 8 }]}>
            <View style={st.payField}>
              <Text style={[st.payLabel, { color: '#DC2626' }]}>− Jual Mart</Text>
              <TextInput
                style={[st.payInput, { borderColor: '#FECACA' }]}
                value={jualMart} onChangeText={setJualMart}
                keyboardType="numeric" placeholder="0" placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={st.payField}>
              <Text style={[st.payLabel, { color: '#DC2626' }]}>− Jual ACC</Text>
              <TextInput
                style={[st.payInput, { borderColor: '#FECACA' }]}
                value={jualAcc} onChangeText={setJualAcc}
                keyboardType="numeric" placeholder="0" placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={st.cashlessTotalRow}>
            <Text style={st.cashlessTotalLabel}>Total Cashless</Text>
            <Text style={st.cashlessTotalVal}>Rp {fmt(totalCashless)}</Text>
          </View>
        </View>

        {/* ── Rekap Akhir ── */}
        <View style={st.rekapBox}>
          <Text style={st.rekapTitle}>REKAP AKHIR</Text>

          <RRow label="Total Omset"      value={`Rp ${fmt(omset)}`} />
          <RRow label="Total Pengeluaran" value={`- Rp ${fmt(totalOut)}`} vc="#EF4444" />
          <View style={st.rekapDiv} />
          <RRow
            label="Omset Bersih"
            value={`Rp ${fmt(omsetBersih)}`}
            vc={omsetBersih >= 0 ? '#F59E0B' : '#EF4444'}
            bold
          />
          <View style={st.rekapDiv} />
          <RRow label="Total Cashless"    value={`- Rp ${fmt(totalCashless)}`} vc="#6B7280" />

          {/* Pendapatan Washer+TP untuk pembayaran ke karyawan */}
          <View style={[st.rekapDiv, { marginVertical: 8 }]} />
          <Text style={st.rekapSubTitle}>UNTUK PEMBAYARAN KARYAWAN</Text>
          <RRow label="💧 Upah Washer"  value={`Rp ${fmt(totalPendapatanWasher)}`} vc="#059669" />
          <RRow label="⭐ Upah TP"      value={`Rp ${fmt(totalPendapatanTP)}`}     vc="#7C3AED" />
          <View style={st.rekapDiv} />

          {/* Tunai Rill */}
          <View style={[st.rekapHighlight, { marginTop: 6 }]}>
            <View>
              <Text style={st.rekapHLLabel}>TUNAI RILL (LOKER)</Text>
              <Text style={st.rekapHLSub}>Omset Bersih − Cashless</Text>
            </View>
            <Text style={[st.rekapHLVal, tunaiRill < 0 && { color: '#FCA5A5' }]}>
              Rp {fmt(Math.abs(tunaiRill))}
              {tunaiRill < 0 ? ' ⚠' : ''}
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={st.footer}>
        <TouchableOpacity
          style={[st.closeBtn, closeMutation.isPending && st.closeBtnDis]}
          onPress={() => {
            Alert.alert('Konfirmasi Closing', 'Yakin ingin menutup closing hari ini?', [
              { text: 'Batal', style: 'cancel' },
              { text: 'Selesaikan', onPress: () => closeMutation.mutate() },
            ]);
          }}
          disabled={closeMutation.isPending}
        >
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={st.closeBtnTxt}>
            {closeMutation.isPending ? 'Menyimpan...' : 'SELESAIKAN CLOSING'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function IRow({ label, value, vc, large }: { label: string; value: string; vc?: string; large?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      <Text style={{ fontSize: 13, color: '#6B7280' }}>{label}</Text>
      <Text style={{ fontSize: large ? 16 : 13, fontWeight: large ? '900' : '600', color: vc || '#1F2937' }}>{value}</Text>
    </View>
  );
}

function RRow({ label, value, vc, bold }: { label: string; value: string; vc?: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ fontSize: bold ? 13 : 12, color: bold ? '#F3F4F6' : '#9CA3AF', fontWeight: bold ? '700' : '400' }}>{label}</Text>
      <Text style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? '900' : '600', color: vc || '#E5E7EB' }}>{value}</Text>
    </View>
  );
}

function PayField({ label, value, setter }: { label: string; value: string; setter: (v: string) => void }) {
  return (
    <View style={st.payField}>
      <Text style={st.payLabel}>{label}</Text>
      <TextInput
        style={st.payInput} value={value} onChangeText={setter}
        keyboardType="numeric" placeholder="0" placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

const st = StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: '#F9FAFB' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1F2937', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub:   { color: '#9CA3AF', fontSize: 11, marginTop: 1 },
  statusBadge: { backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTxt:   { color: '#fff', fontSize: 11, fontWeight: '700' },
  scroll:      { flex: 1 },
  emptyBox:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptyDesc:   { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  card:        { margin: 10, marginBottom: 0, backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  cardTitle:   { fontSize: 11, fontWeight: '800', color: '#1F2937', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  cardDesc:    { fontSize: 10, color: '#9CA3AF', marginBottom: 10 },

  // Formula row
  formulaRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  formulaBox:  { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, alignItems: 'center' },
  formulaLbl:  { fontSize: 9, color: '#6B7280', textAlign: 'center' },
  formulaVal:  { fontSize: 12, fontWeight: '800', color: '#1F2937', textAlign: 'center', marginTop: 2 },
  formulaOp:   { fontSize: 16, fontWeight: '900', color: '#9CA3AF' },

  // Pendapatan boxes
  pendapatanRow:{ flexDirection: 'row', gap: 8, marginBottom: 10 },
  pendapatanBox:{ flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', gap: 3 },
  pendapatanLbl:{ fontSize: 10, color: '#374151', fontWeight: '600' },
  pendapatanVal:{ fontSize: 14, fontWeight: '900' },

  // TP breakdown
  tpBreakdown: { backgroundColor: '#F5F3FF', borderRadius: 8, padding: 10 },
  tpBreakdownTitle: { fontSize: 11, fontWeight: '700', color: '#5B21B6', marginBottom: 6 },
  tpRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  tpName:      { flex: 1, fontSize: 13, color: '#374151', fontWeight: '600' },
  tpTotal:     { fontSize: 13, fontWeight: '800', color: '#7C3AED' },

  // Detail layanan table
  tableHead:   { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 6, padding: 6, marginBottom: 2 },
  th:          { fontSize: 9, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  tableRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  tdName:      { fontSize: 11, color: '#374151', fontWeight: '500' },
  tdTP:        { fontSize: 10, color: '#7C3AED', marginTop: 1 },
  td:          { fontSize: 11, color: '#374151' },

  // Auto pengeluaran
  autoPengEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', borderRadius: 8, padding: 10 },
  autoPengEmptyTxt: { fontSize: 12, color: '#065F46', fontWeight: '600' },
  autoPengRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  autoPengIcon:{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  autoPengJenis:{ fontSize: 12, fontWeight: '700', color: '#374151' },
  autoPengKet: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  autoPengHarga:{ fontSize: 13, fontWeight: '800', color: '#EF4444' },

  // Manual pengeluaran
  pengRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pengNo:      { fontSize: 13, fontWeight: '700', color: '#9CA3AF', width: 18 },
  pengInput:   { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 9, fontSize: 13, color: '#1F2937', backgroundColor: '#F9FAFB' },
  addPengBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  addPengBtnTxt:{ fontSize: 12, color: '#E85D04', fontWeight: '600' },
  totalOutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  totalOutLabel:{ fontSize: 13, fontWeight: '700', color: '#374151' },
  totalOutSub: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  totalOutValue:{ fontSize: 16, fontWeight: '900', color: '#EF4444' },

  // Cashless
  payGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  payField:    { width: '47%' },
  payLabel:    { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 4 },
  payInput:    { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, fontSize: 14, color: '#1F2937', backgroundColor: '#F9FAFB' },
  cashlessTotalRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  cashlessTotalLabel:{ fontSize: 13, fontWeight: '700', color: '#374151' },
  cashlessTotalVal:  { fontSize: 16, fontWeight: '900', color: '#059669' },

  // Rekap akhir
  rekapBox:    { margin: 10, backgroundColor: '#1F2937', borderRadius: 12, padding: 16 },
  rekapTitle:  { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  rekapSubTitle:{ color: '#9CA3AF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' },
  rekapDiv:    { height: 1, backgroundColor: '#374151', marginVertical: 6 },
  rekapHighlight:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E85D04', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, marginTop: 4 },
  rekapHLLabel:{ fontSize: 14, fontWeight: '800', color: '#fff' },
  rekapHLSub:  { fontSize: 10, color: '#FED7AA', marginTop: 2 },
  rekapHLVal:  { fontSize: 20, fontWeight: '900', color: '#fff' },

  footer:      { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingBottom: Platform.OS === 'ios' ? 24 : 16 },
  closeBtn:    { flexDirection: 'row', gap: 8, backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  closeBtnDis: { backgroundColor: '#6EE7B7' },
  closeBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
