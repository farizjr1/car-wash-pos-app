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
 * 1. Pengeluaran OTOMATIS dari antrian:
 *    - FREE    → free/p.free  = upah_washer
 *    - Big     → big/p.big    = Rp 2.000 / mobil
 *    - Premium → prem/p.prem  = Rp 4.000 / mobil
 * 2. Total Cashless = QRIS + Transfer - Jual Mart - Jual ACC
 * 3. Pendapatan = Total Harga − Total KAS = Upah Washer + TP
 * 4. Omset Bersih = Total KAS − Total Pengeluaran
 * 5. Tunai Rill   = Omset Bersih − Cashless
 */

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  orange:  '#E85D04',
  orangeL: '#FFF3E0',
  orangeD: '#BF4800',
  bg:      '#F4F5F7',
  dark:    '#0F172A',
  slate:   '#334155',
  gray:    '#64748B',
  grayL:   '#E2E8F0',
  grayBg:  '#F8FAFC',
  green:   '#059669',
  greenBg: '#ECFDF5',
  red:     '#DC2626',
  redBg:   '#FEF2F2',
  purple:  '#7C3AED',
  purpleBg:'#F5F3FF',
  yellow:  '#D97706',
  white:   '#FFFFFF',
  border:  '#E2E8F0',
};

function fmt(n: number) { return n.toLocaleString('id-ID'); }
function getTodayStr() { return new Date().toISOString().split('T')[0]; }
function fmtDateLong(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

const UPAH_BY_KAT: Record<string, number> = { umum: 11000, big: 13000, premium: 15000 };

interface AutoPeng { jenis: string; harga: number; ket: string }
interface PengItem  { jenis: string; harga: string }

export default function ClosingScreen() {
  const qc = useQueryClient();

  const { data: reports } = useQuery({
    queryKey: ['closing_reports'],
    queryFn: async () => {
      const res = await blink.db.closingReports.list({ orderBy: { createdAt: 'desc' }, limit: 10 });
      return res as ClosingReport[];
    },
  });

  const latestOpen = reports?.find(r => r.status === 'open');

  const { data: items } = useQuery({
    queryKey: ['closing_items', latestOpen?.id],
    queryFn: async () => {
      if (!latestOpen?.id) return [];
      return await blink.db.closingItems.list({ where: { closingId: latestOpen.id } });
    },
    enabled: !!latestOpen?.id,
  });

  const today = latestOpen?.tanggal || getTodayStr();
  const { data: antrian } = useQuery({
    queryKey: ['antrian_closing', today],
    queryFn: async () => {
      const res = await blink.db.antrian.list({ where: { tanggal: today } });
      return res as any[];
    },
    enabled: !!latestOpen,
  });

  const { data: savedPeng } = useQuery({
    queryKey: ['pengeluaran', latestOpen?.id],
    queryFn: async () => {
      if (!latestOpen?.id) return [];
      return await blink.db.pengeluaran.list({ where: { closingId: latestOpen.id } });
    },
    enabled: !!latestOpen?.id,
  });

  // ── Auto pengeluaran ──
  const autoPeng = useMemo<AutoPeng[]>(() => {
    if (!antrian) return [];
    let totalFree = 0, countBig = 0, countPrem = 0;
    for (const a of antrian) {
      const isFree   = Number(a.isFree || a.is_free || 0) > 0;
      const kat      = a.kategoriMobil || a.kategori_mobil || 'umum';
      const upah     = UPAH_BY_KAT[kat] || 11000;
      if (isFree)                                           totalFree += upah;
      if (!isFree && kat === 'big')                         countBig++;
      if (!isFree && (a.kategori || '') === 'Premium')      countPrem++;
    }
    const result: AutoPeng[] = [];
    if (totalFree > 0) result.push({ jenis: 'free/p.free', harga: totalFree,       ket: `Cuci free (upah washer)` });
    if (countBig > 0)  result.push({ jenis: 'big/p.big',   harga: countBig * 2000, ket: `${countBig} mobil big × Rp 2.000` });
    if (countPrem > 0) result.push({ jenis: 'prem/p.prem', harga: countPrem * 4000, ket: `${countPrem} mobil premium × Rp 4.000` });
    return result;
  }, [antrian]);

  // ── Rekap closing items ──
  const { totalHarga, totalKas, totalPendWasher, totalPendTP, tpMap } = useMemo(() => {
    let totalHarga = 0, totalKas = 0, totalPendWasher = 0, totalPendTP = 0;
    const tpMap: Record<string, number> = {};
    if (items) {
      (items as any[]).forEach((it: any) => {
        totalHarga     += it.jumlah || 0;
        totalKas       += it.kas    || 0;
        totalPendWasher+= it.pendapatanWasher || it.pendapatan_washer || 0;
        totalPendTP    += it.pendapatanTP     || it.pendapatan_tp     || 0;
        const nm = it.namaTP || it.nama_tp || '';
        const pt = it.pendapatanTP || it.pendapatan_tp || 0;
        if (nm && pt > 0) tpMap[nm] = (tpMap[nm] || 0) + pt;
      });
    }
    return { totalHarga, totalKas, totalPendWasher, totalPendTP, tpMap };
  }, [items]);

  // ── Payment state ──
  const [qrisBca,  setQrisBca]  = useState('');
  const [bca,      setBca]      = useState('');
  const [bsi,      setBsi]      = useState('');
  const [cimbBni,  setCimbBni]  = useState('');
  const [mandiri,  setMandiri]  = useState('');
  const [voucher,  setVoucher]  = useState('');
  const [jualMart, setJualMart] = useState('');
  const [jualAcc,  setJualAcc]  = useState('');
  const [manualPeng, setManualPeng] = useState<PengItem[]>([
    { jenis: '', harga: '' }, { jenis: '', harga: '' }, { jenis: '', harga: '' },
  ]);

  const parseN = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;

  const totalCashlessGross = parseN(qrisBca) + parseN(bca) + parseN(bsi) +
    parseN(cimbBni) + parseN(mandiri) + parseN(voucher);
  const totalCashless = Math.max(0, totalCashlessGross - parseN(jualMart) - parseN(jualAcc));

  const totalAutoOut   = autoPeng.reduce((s, p) => s + p.harga, 0);
  const totalManualOut = manualPeng.reduce((s, p) => s + parseN(p.harga), 0);
  const totalSavedOut  = (savedPeng as any[])?.reduce((s: number, p: any) => s + (p.harga || 0), 0) || 0;
  const totalOut       = totalAutoOut + totalManualOut + totalSavedOut;

  const omset      = latestOpen?.totalOmset || 0;
  const omsetBersih = omset - totalOut;
  const tunaiRill  = omsetBersih - totalCashless;
  const totalPend  = totalHarga - totalKas;

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!latestOpen?.id) throw new Error('Tidak ada closing aktif');
      for (const p of autoPeng) {
        await blink.db.pengeluaran.create({
          id:        `peng_auto_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          closingId: latestOpen.id,
          jenis:     p.jenis,
          harga:     p.harga,
        });
      }
      for (const p of manualPeng) {
        if (p.jenis.trim() && parseN(p.harga) > 0) {
          await blink.db.pengeluaran.create({
            id:        `peng_m_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            closingId: latestOpen.id,
            jenis:     p.jenis,
            harga:     parseN(p.harga),
          });
        }
      }
      await blink.db.closingReports.update(latestOpen.id, {
        status:       'closed',
        kasBca:       parseN(bca),
        kasBsi:       parseN(bsi),
        kasCimbBni:   parseN(cimbBni),
        kasQrisBca:   parseN(qrisBca),
        kasMandiri:   parseN(mandiri),
        kasVoucher:   parseN(voucher),
        kasTunai:     tunaiRill,
        totalCashless,
        totalOut,
        updatedAt:    new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['closing_reports'] });
      qc.invalidateQueries({ queryKey: ['pengeluaran', latestOpen?.id] });
      Alert.alert('Closing Berhasil ✅',
        `Omset: Rp ${fmt(omset)}\nOmset Bersih: Rp ${fmt(omsetBersih)}\nCashless: Rp ${fmt(totalCashless)}\nTunai Rill: Rp ${fmt(Math.max(0, tunaiRill))}`,
        [{
          text: 'OK', onPress: () => {
            setBca(''); setBsi(''); setCimbBni(''); setQrisBca('');
            setMandiri(''); setVoucher(''); setJualMart(''); setJualAcc('');
            setManualPeng([{ jenis: '', harga: '' }, { jenis: '', harga: '' }, { jenis: '', harga: '' }]);
          },
        }],
      );
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  // ── EMPTY STATE ──
  if (!latestOpen) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <View style={st.header}>
          <View>
            <Text style={st.headerTitle}>CLOSING HARIAN</Text>
            <Text style={st.headerSub}>Rekap & tutup shift</Text>
          </View>
          <View style={st.headerIcon}>
            <Ionicons name="document-text-outline" size={20} color={C.white} />
          </View>
        </View>
        <View style={st.emptyBox}>
          <View style={st.emptyIconBox}>
            <Ionicons name="document-outline" size={48} color={C.grayL} />
          </View>
          <Text style={st.emptyTitle}>Belum Ada Closing Aktif</Text>
          <Text style={st.emptyDesc}>Input data layanan di tab Kasir terlebih dahulu untuk memulai shift</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={st.header}>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>CLOSING HARIAN</Text>
          <Text style={st.headerSub}>{fmtDateLong(latestOpen.tanggal)}</Text>
        </View>
        <View style={st.activeBadge}>
          <View style={st.activeDot} />
          <Text style={st.activeTxt}>AKTIF</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* ── Info Dasar ── */}
        <View style={st.card}>
          <View style={st.cardTitleRow}>
            <Ionicons name="person-circle-outline" size={16} color={C.orange} />
            <Text style={st.cardTitle}>INFO SHIFT</Text>
          </View>
          <View style={st.infoGrid}>
            <InfoBox icon="person-outline" label="Kasir" val={latestOpen.kasir} />
            <InfoBox icon="car-outline"    label="Kendaraan" val={`${latestOpen.jumlahMobil}`} />
            <InfoBox icon="cash-outline"   label="Total Omset" val={`Rp ${fmt(omset)}`} vc={C.orange} />
          </View>
        </View>

        {/* ── Rekap Pendapatan ── */}
        <View style={st.card}>
          <View style={st.cardTitleRow}>
            <Ionicons name="people-outline" size={16} color={C.purple} />
            <Text style={st.cardTitle}>PENDAPATAN KARYAWAN</Text>
          </View>
          <Text style={st.cardDesc}>Total Harga − Total KAS = Upah Washer + TP</Text>

          {/* Formula */}
          <View style={st.formulaRow}>
            <View style={[st.formulaBox, { backgroundColor: C.grayBg }]}>
              <Text style={st.fLbl}>Total Harga</Text>
              <Text style={st.fVal}>Rp {fmt(totalHarga)}</Text>
            </View>
            <Text style={st.fOp}>−</Text>
            <View style={[st.formulaBox, { backgroundColor: C.grayBg }]}>
              <Text style={st.fLbl}>Total KAS</Text>
              <Text style={st.fVal}>Rp {fmt(totalKas)}</Text>
            </View>
            <Text style={st.fOp}>=</Text>
            <View style={[st.formulaBox, { backgroundColor: C.greenBg }]}>
              <Text style={[st.fLbl, { color: '#065F46' }]}>Pendapatan</Text>
              <Text style={[st.fVal, { color: C.green }]}>Rp {fmt(totalPend)}</Text>
            </View>
          </View>

          {/* Washer + TP boxes */}
          <View style={st.pendRow}>
            <View style={[st.pendBox, { backgroundColor: C.greenBg }]}>
              <Ionicons name="water-outline" size={18} color={C.green} />
              <Text style={[st.pendLbl, { color: '#065F46' }]}>Washer</Text>
              <Text style={[st.pendVal, { color: C.green }]}>Rp {fmt(totalPendWasher)}</Text>
            </View>
            <View style={[st.pendBox, { backgroundColor: C.purpleBg }]}>
              <Ionicons name="star-outline" size={18} color={C.purple} />
              <Text style={[st.pendLbl, { color: '#4C1D95' }]}>TP</Text>
              <Text style={[st.pendVal, { color: C.purple }]}>Rp {fmt(totalPendTP)}</Text>
            </View>
          </View>

          {/* TP breakdown */}
          {Object.keys(tpMap).length > 0 && (
            <View style={st.tpBreakdown}>
              <Text style={st.tpBdTitle}>Rincian per Team Polisher:</Text>
              {Object.entries(tpMap).map(([nama, total]) => (
                <View key={nama} style={st.tpBdRow}>
                  <Ionicons name="person-outline" size={13} color={C.purple} />
                  <Text style={st.tpBdName}>{nama}</Text>
                  <Text style={st.tpBdVal}>Rp {fmt(total)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Detail Layanan ── */}
        {items && (items as any[]).length > 0 && (
          <View style={st.card}>
            <View style={st.cardTitleRow}>
              <Ionicons name="list-outline" size={16} color={C.slate} />
              <Text style={st.cardTitle}>DETAIL LAYANAN</Text>
            </View>
            <View style={st.tableHead}>
              <Text style={[st.th, { flex: 2.5 }]}>LAYANAN</Text>
              <Text style={[st.th, { width: 28, textAlign: 'center' }]}>QTY</Text>
              <Text style={[st.th, { width: 50, textAlign: 'center' }]}>KAS</Text>
              <Text style={[st.th, { width: 55, textAlign: 'center', color: '#A78BFA' }]}>TP</Text>
              <Text style={[st.th, { width: 60, textAlign: 'right' }]}>JUMLAH</Text>
            </View>
            {(items as any[]).map((it: any, i: number) => {
              const namaTP = it.namaTP || it.nama_tp || '';
              const pt     = it.pendapatanTP || it.pendapatan_tp || 0;
              return (
                <View key={i} style={st.tableRow}>
                  <View style={{ flex: 2.5 }}>
                    <Text style={st.tdName} numberOfLines={2}>{it.serviceName || it.service_name}</Text>
                    {namaTP ? <Text style={st.tdTP}>TP: {namaTP} +{fmt(pt)}</Text> : null}
                  </View>
                  <Text style={[st.td, { width: 28, textAlign: 'center' }]}>{it.qty}</Text>
                  <Text style={[st.td, { width: 50, textAlign: 'center', color: C.gray }]}>{fmt(it.kas || 0)}</Text>
                  <Text style={[st.td, { width: 55, textAlign: 'center', color: C.purple, fontWeight: '700' }]}>
                    {pt > 0 ? fmt(pt) : '−'}
                  </Text>
                  <Text style={[st.td, { width: 60, textAlign: 'right', color: C.green, fontWeight: '800' }]}>
                    {fmt(it.jumlah)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Pengeluaran ── */}
        <View style={st.card}>
          <View style={st.cardTitleRow}>
            <Ionicons name="arrow-down-circle-outline" size={16} color={C.red} />
            <Text style={st.cardTitle}>PENGELUARAN</Text>
          </View>

          {/* Auto */}
          <Text style={st.subTitle}>OTOMATIS (dari antrian)</Text>
          {autoPeng.length === 0 ? (
            <View style={st.autoPengEmpty}>
              <Ionicons name="checkmark-circle" size={18} color={C.green} />
              <Text style={st.autoPengEmptyTxt}>Tidak ada pengeluaran otomatis</Text>
            </View>
          ) : (
            autoPeng.map((p, i) => (
              <View key={i} style={st.autoPengRow}>
                <View style={[st.autoPengIcon, {
                  backgroundColor: p.jenis.includes('free') ? C.redBg : p.jenis.includes('big') ? '#FFFBEB' : C.purpleBg,
                }]}>
                  <Ionicons
                    name={p.jenis.includes('free') ? 'gift-outline' : p.jenis.includes('big') ? 'car-sport-outline' : 'star-outline'}
                    size={14}
                    color={p.jenis.includes('free') ? C.red : p.jenis.includes('big') ? C.yellow : C.purple}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.autoPengJenis}>{p.jenis}</Text>
                  <Text style={st.autoPengKet}>{p.ket}</Text>
                </View>
                <Text style={st.autoPengHarga}>− Rp {fmt(p.harga)}</Text>
              </View>
            ))
          )}

          {/* Manual */}
          <Text style={[st.subTitle, { marginTop: 14 }]}>MANUAL TAMBAHAN</Text>
          {manualPeng.map((p, i) => (
            <View key={i} style={st.pengRow}>
              <Text style={st.pengNo}>{i + 1}.</Text>
              <TextInput
                style={[st.pengInput, { flex: 2 }]}
                placeholder="Jenis pengeluaran..."
                value={p.jenis}
                onChangeText={v => { const a = [...manualPeng]; a[i].jenis = v; setManualPeng(a); }}
                placeholderTextColor={C.gray}
              />
              <TextInput
                style={[st.pengInput, { flex: 1 }]}
                placeholder="Harga"
                value={p.harga}
                onChangeText={v => { const a = [...manualPeng]; a[i].harga = v; setManualPeng(a); }}
                keyboardType="numeric"
                placeholderTextColor={C.gray}
              />
            </View>
          ))}
          <TouchableOpacity
            style={st.addPengBtn}
            onPress={() => setManualPeng(prev => [...prev, { jenis: '', harga: '' }])}
          >
            <Ionicons name="add-circle-outline" size={16} color={C.orange} />
            <Text style={st.addPengTxt}>Tambah baris</Text>
          </TouchableOpacity>

          {/* Total Out */}
          <View style={st.totalOutRow}>
            <View>
              <Text style={st.totalOutLbl}>TOTAL PENGELUARAN</Text>
              <Text style={st.totalOutSub}>Auto: {fmt(totalAutoOut)} + Manual: {fmt(totalManualOut)}</Text>
            </View>
            <Text style={st.totalOutVal}>Rp {fmt(totalOut)}</Text>
          </View>
        </View>

        {/* ── Cashless ── */}
        <View style={st.card}>
          <View style={st.cardTitleRow}>
            <Ionicons name="card-outline" size={16} color={C.slate} />
            <Text style={st.cardTitle}>PEMBAYARAN CASHLESS</Text>
          </View>
          <Text style={st.cardDesc}>Total Cashless = (QRIS + Transfer) − Jual Mart − Jual ACC</Text>

          <View style={st.payGrid}>
            <PayF label="QRIS BCA"    val={qrisBca}  set={setQrisBca}  />
            <PayF label="BCA Transfer" val={bca}     set={setBca}      />
            <PayF label="BSI"          val={bsi}     set={setBsi}      />
            <PayF label="CIMB / BNI"   val={cimbBni} set={setCimbBni}  />
            <PayF label="Mandiri"      val={mandiri} set={setMandiri}  />
            <PayF label="Voucher"      val={voucher} set={setVoucher}  />
          </View>

          {/* Pengurang */}
          <View style={[st.payGrid, { marginTop: 6 }]}>
            <View style={st.payField}>
              <Text style={[st.payLbl, { color: C.red }]}>− Jual Mart</Text>
              <TextInput style={[st.payInput, { borderColor: '#FECACA' }]}
                value={jualMart} onChangeText={setJualMart}
                keyboardType="numeric" placeholder="0" placeholderTextColor={C.gray} />
            </View>
            <View style={st.payField}>
              <Text style={[st.payLbl, { color: C.red }]}>− Jual ACC</Text>
              <TextInput style={[st.payInput, { borderColor: '#FECACA' }]}
                value={jualAcc} onChangeText={setJualAcc}
                keyboardType="numeric" placeholder="0" placeholderTextColor={C.gray} />
            </View>
          </View>

          <View style={st.cashlessTotalRow}>
            <Text style={st.cashlessTotalLbl}>Total Cashless</Text>
            <Text style={st.cashlessTotalVal}>Rp {fmt(totalCashless)}</Text>
          </View>
        </View>

        {/* ── Rekap Akhir ── */}
        <View style={st.rekapCard}>
          <View style={st.rekapTitleRow}>
            <Ionicons name="calculator-outline" size={18} color={C.white} />
            <Text style={st.rekapTitle}>REKAP AKHIR</Text>
          </View>

          <RR label="Total Omset"       val={`Rp ${fmt(omset)}`}       />
          <RR label="Total Pengeluaran" val={`− Rp ${fmt(totalOut)}`}  vc="#FCA5A5" />
          <View style={st.rekapDiv} />
          <RR label="Omset Bersih"      val={`Rp ${fmt(omsetBersih)}`} vc="#FCD34D" bold />
          <View style={st.rekapDiv} />
          <RR label="Total Cashless"    val={`− Rp ${fmt(totalCashless)}`} vc="#94A3B8" />

          <View style={st.rekapSep} />
          <Text style={st.rekapSubTitle}>UNTUK PEMBAYARAN KARYAWAN</Text>
          <RR label="💧 Upah Washer"    val={`Rp ${fmt(totalPendWasher)}`}  vc="#34D399" />
          <RR label="⭐ Upah TP"        val={`Rp ${fmt(totalPendTP)}`}      vc="#A78BFA" />

          <View style={[st.rekapHighlight, tunaiRill < 0 && { backgroundColor: C.red }]}>
            <View>
              <Text style={st.hlLabel}>TUNAI RILL (LOKER)</Text>
              <Text style={st.hlSub}>Omset Bersih − Cashless</Text>
            </View>
            <Text style={[st.hlVal, tunaiRill < 0 && { color: '#FCA5A5' }]}>
              Rp {fmt(Math.abs(tunaiRill))}{tunaiRill < 0 ? ' ⚠' : ''}
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Footer Button ── */}
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
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={22} color={C.white} />
          <Text style={st.closeBtnTxt}>
            {closeMutation.isPending ? 'Menyimpan...' : 'SELESAIKAN CLOSING'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────
function InfoBox({ icon, label, val, vc }: { icon: string; label: string; val: string; vc?: string }) {
  return (
    <View style={st.infoBox}>
      <Ionicons name={icon as any} size={14} color={vc || C.gray} />
      <Text style={st.infoLbl}>{label}</Text>
      <Text style={[st.infoVal, vc && { color: vc }]}>{val}</Text>
    </View>
  );
}

function PayF({ label, val, set }: { label: string; val: string; set: (v: string) => void }) {
  return (
    <View style={st.payField}>
      <Text style={st.payLbl}>{label}</Text>
      <TextInput
        style={st.payInput}
        value={val}
        onChangeText={set}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={C.gray}
      />
    </View>
  );
}

function RR({ label, val, vc, bold }: { label: string; val: string; vc?: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ fontSize: bold ? 13 : 12, color: bold ? '#E2E8F0' : '#94A3B8', fontWeight: bold ? '700' : '400' }}>{label}</Text>
      <Text style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? '900' : '600', color: vc || '#E2E8F0' }}>{val}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.dark, paddingHorizontal: 18, paddingVertical: 16 },
  headerTitle:  { color: C.white, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  headerSub:    { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  headerIcon:   { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  activeBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#065F46', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  activeDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },
  activeTxt:    { fontSize: 11, fontWeight: '800', color: C.white },

  emptyBox:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIconBox: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.grayBg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: C.slate },
  emptyDesc:    { fontSize: 13, color: C.gray, textAlign: 'center', lineHeight: 20 },

  card:         { margin: 10, marginBottom: 0, backgroundColor: C.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardTitle:    { fontSize: 11, fontWeight: '800', color: C.slate, letterSpacing: 0.8, textTransform: 'uppercase', flex: 1 },
  cardDesc:     { fontSize: 11, color: C.gray, marginTop: -6, marginBottom: 10 },
  subTitle:     { fontSize: 10, fontWeight: '800', color: C.gray, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },

  infoGrid:     { flexDirection: 'row', gap: 8 },
  infoBox:      { flex: 1, backgroundColor: C.grayBg, borderRadius: 10, padding: 10, alignItems: 'center', gap: 3 },
  infoLbl:      { fontSize: 9, color: C.gray, fontWeight: '600', textAlign: 'center' },
  infoVal:      { fontSize: 12, fontWeight: '800', color: C.dark, textAlign: 'center' },

  formulaRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  formulaBox:   { flex: 1, borderRadius: 10, padding: 8, alignItems: 'center' },
  fLbl:         { fontSize: 9, color: C.gray, textAlign: 'center' },
  fVal:         { fontSize: 11, fontWeight: '800', color: C.dark, textAlign: 'center', marginTop: 2 },
  fOp:          { fontSize: 16, fontWeight: '900', color: '#CBD5E1' },

  pendRow:      { flexDirection: 'row', gap: 10, marginBottom: 10 },
  pendBox:      { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  pendLbl:      { fontSize: 11, fontWeight: '600' },
  pendVal:      { fontSize: 15, fontWeight: '900' },

  tpBreakdown:  { backgroundColor: C.purpleBg, borderRadius: 10, padding: 10 },
  tpBdTitle:    { fontSize: 11, fontWeight: '700', color: '#5B21B6', marginBottom: 6 },
  tpBdRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  tpBdName:     { flex: 1, fontSize: 13, color: C.slate, fontWeight: '600' },
  tpBdVal:      { fontSize: 13, fontWeight: '800', color: C.purple },

  tableHead:    { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 7, marginBottom: 4 },
  th:           { fontSize: 9, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  tableRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  tdName:       { fontSize: 11, color: C.slate, fontWeight: '500' },
  tdTP:         { fontSize: 10, color: C.purple, marginTop: 1 },
  td:           { fontSize: 11, color: C.slate },

  autoPengEmpty:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenBg, borderRadius: 10, padding: 10 },
  autoPengEmptyTxt:{ fontSize: 12, color: '#065F46', fontWeight: '600' },
  autoPengRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  autoPengIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  autoPengJenis:{ fontSize: 12, fontWeight: '700', color: C.slate },
  autoPengKet:  { fontSize: 10, color: C.gray, marginTop: 1 },
  autoPengHarga:{ fontSize: 13, fontWeight: '800', color: C.red },

  pengRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pengNo:       { fontSize: 12, fontWeight: '700', color: C.gray, width: 20 },
  pengInput:    { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, padding: 9, fontSize: 13, color: C.dark, backgroundColor: C.grayBg },
  addPengBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addPengTxt:   { fontSize: 12, color: C.orange, fontWeight: '600' },
  totalOutRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: C.border },
  totalOutLbl:  { fontSize: 13, fontWeight: '700', color: C.slate },
  totalOutSub:  { fontSize: 10, color: C.gray, marginTop: 2 },
  totalOutVal:  { fontSize: 16, fontWeight: '900', color: C.red },

  payGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  payField:     { width: '47%' },
  payLbl:       { fontSize: 11, fontWeight: '700', color: C.slate, marginBottom: 5 },
  payInput:     { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, padding: 9, fontSize: 14, color: C.dark, backgroundColor: C.grayBg },
  cashlessTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1.5, borderTopColor: C.border },
  cashlessTotalLbl: { fontSize: 13, fontWeight: '700', color: C.slate },
  cashlessTotalVal: { fontSize: 16, fontWeight: '900', color: C.green },

  rekapCard:    { margin: 10, marginBottom: 0, backgroundColor: C.dark, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  rekapTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  rekapTitle:   { color: C.white, fontSize: 13, fontWeight: '900', letterSpacing: 1, flex: 1 },
  rekapDiv:     { height: 1, backgroundColor: '#1E293B', marginVertical: 6 },
  rekapSep:     { height: 1, backgroundColor: '#334155', marginVertical: 10 },
  rekapSubTitle:{ color: '#64748B', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4, textTransform: 'uppercase' },
  rekapHighlight:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.orange, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginTop: 14 },
  hlLabel:      { fontSize: 13, fontWeight: '800', color: C.white },
  hlSub:        { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  hlVal:        { fontSize: 20, fontWeight: '900', color: C.white },

  footer:       { padding: 14, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS === 'ios' ? 28 : 14 },
  closeBtn:     { flexDirection: 'row', gap: 10, backgroundColor: C.green, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  closeBtnDis:  { backgroundColor: '#6EE7B7' },
  closeBtnTxt:  { color: C.white, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
});
