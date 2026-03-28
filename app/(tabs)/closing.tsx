import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import { ClosingReport } from '@/types/closing';

function fmt(n: number): string { return n.toLocaleString('id-ID'); }
function formatDateLong(s: string): string {
  return new Date(s).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

interface PengItem { jenis: string; harga: string }

export default function ClosingScreen() {
  const queryClient = useQueryClient();

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

  // Aggregate per nama TP
  const tpRekapMap: Record<string, number> = {};
  let totalPendapatanWasher = 0;
  let totalPendapatanTP = 0;
  if (items) {
    (items as any[]).forEach((item: any) => {
      const pw = item.pendapatanWasher || item.pendapatan_washer || 0;
      const pt = item.pendapatanTP || item.pendapatan_tp || 0;
      const namaTP = item.namaTP || item.nama_tp || '';
      totalPendapatanWasher += pw;
      totalPendapatanTP += pt;
      if (namaTP && pt > 0) {
        tpRekapMap[namaTP] = (tpRekapMap[namaTP] || 0) + pt;
      }
    });
  }

  // Payment state
  const [bca, setBca] = useState('');
  const [bsi, setBsi] = useState('');
  const [cimbBni, setCimbBni] = useState('');
  const [qrisBca, setQrisBca] = useState('');
  const [mandiri, setMandiri] = useState('');
  const [voucher, setVoucher] = useState('');
  const [pengeluaran, setPengeluaran] = useState<PengItem[]>([
    { jenis: '', harga: '' }, { jenis: '', harga: '' }, { jenis: '', harga: '' },
  ]);

  const parseNum = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  const totalCashless = parseNum(bca) + parseNum(bsi) + parseNum(cimbBni) + parseNum(qrisBca) + parseNum(mandiri) + parseNum(voucher);
  const totalOut = pengeluaran.reduce((sum, p) => sum + parseNum(p.harga), 0);
  const omset = latestOpen?.totalOmset || 0;
  const tunai = omset - totalCashless;

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!latestOpen?.id) throw new Error('Tidak ada closing aktif');
      for (const p of pengeluaran) {
        if (p.jenis.trim() && parseNum(p.harga) > 0) {
          await blink.db.pengeluaran.create({
            id: `peng_${Date.now()}_${Math.random()}`,
            closingId: latestOpen.id,
            jenis: p.jenis,
            harga: parseNum(p.harga),
          });
        }
      }
      await blink.db.closingReports.update(latestOpen.id, {
        status: 'closed',
        kasBca: parseNum(bca),
        kasBsi: parseNum(bsi),
        kasCimbBni: parseNum(cimbBni),
        kasQrisBca: parseNum(qrisBca),
        kasMandiri: parseNum(mandiri),
        kasVoucher: parseNum(voucher),
        kasTunai: tunai,
        totalCashless,
        totalOut,
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closing_reports'] });
      Alert.alert('Berhasil', 'Closing harian berhasil disimpan!');
      setBca(''); setBsi(''); setCimbBni(''); setQrisBca(''); setMandiri(''); setVoucher('');
      setPengeluaran([{ jenis: '', harga: '' }, { jenis: '', harga: '' }, { jenis: '', harga: '' }]);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  if (!latestOpen) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CLOSING HARIAN</Text>
          <Text style={styles.headerSub}>Orange Carwash - Semarang 3</Text>
        </View>
        <View style={styles.emptyBox}>
          <Ionicons name="document-outline" size={60} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Belum Ada Closing Aktif</Text>
          <Text style={styles.emptyDesc}>Input data layanan di tab Kasir terlebih dahulu</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>CLOSING HARIAN</Text>
          <Text style={styles.headerSub}>{formatDateLong(latestOpen.tanggal)}</Text>
        </View>
        <View style={styles.statusBadge}><Text style={styles.statusText}>AKTIF</Text></View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Info card */}
        <View style={styles.card}>
          <InfoRow label="Kasir" value={latestOpen.kasir} />
          <InfoRow label="Jumlah Kendaraan" value={`${latestOpen.jumlahMobil}`} />
          <InfoRow label="Total Omset" value={`Rp ${fmt(omset)}`} valueColor="#E85D04" large />
        </View>

        {/* Rekap Pendapatan */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>REKAP PENDAPATAN</Text>

          {/* Pendapatan Washer */}
          <View style={styles.rekapRow}>
            <View style={styles.rekapIcon}>
              <Ionicons name="water" size={16} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rekapLabel}>Total Pendapatan Washer</Text>
              <Text style={styles.rekapSub}>(Reguler: Harga − KAS)</Text>
            </View>
            <Text style={[styles.rekapVal, { color: '#059669' }]}>Rp {fmt(totalPendapatanWasher)}</Text>
          </View>

          {/* Pendapatan TP */}
          <View style={[styles.rekapRow, { marginTop: 4 }]}>
            <View style={[styles.rekapIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="star" size={16} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rekapLabel}>Total Pendapatan TP</Text>
              <Text style={styles.rekapSub}>(Premium/Paket: Harga − KAS)</Text>
            </View>
            <Text style={[styles.rekapVal, { color: '#7C3AED' }]}>Rp {fmt(totalPendapatanTP)}</Text>
          </View>

          {/* Breakdown per TP */}
          {Object.keys(tpRekapMap).length > 0 && (
            <View style={styles.tpBreakdown}>
              <Text style={styles.tpBreakdownTitle}>Rincian per TP:</Text>
              {Object.entries(tpRekapMap).map(([nama, total]) => (
                <View key={nama} style={styles.tpBreakdownRow}>
                  <Ionicons name="person" size={13} color="#7C3AED" />
                  <Text style={styles.tpName}>{nama}</Text>
                  <Text style={styles.tpTotal}>Rp {fmt(total)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Detail layanan */}
        {items && (items as any[]).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>DETAIL LAYANAN</Text>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2.5 }]}>LAYANAN</Text>
              <Text style={[styles.th, { width: 28, textAlign: 'center' }]}>QTY</Text>
              <Text style={[styles.th, { width: 50, textAlign: 'center' }]}>KAS</Text>
              <Text style={[styles.th, { width: 55, textAlign: 'center', color: '#7C3AED' }]}>TP</Text>
              <Text style={[styles.th, { width: 60, textAlign: 'right' }]}>JUMLAH</Text>
            </View>
            {(items as any[]).map((item: any, i: number) => {
              const namaTP = item.namaTP || item.nama_tp || '';
              const pt = item.pendapatanTP || item.pendapatan_tp || 0;
              const kas = item.kas || 0;
              return (
                <View key={i} style={styles.tableRow}>
                  <View style={{ flex: 2.5 }}>
                    <Text style={styles.tdName} numberOfLines={2}>{item.serviceName || item.service_name}</Text>
                    {namaTP ? (
                      <Text style={styles.tdTP}>TP: {namaTP} +{fmt(pt)}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.td, { width: 28, textAlign: 'center' }]}>{item.qty}</Text>
                  <Text style={[styles.td, { width: 50, textAlign: 'center', color: '#6B7280' }]}>{fmt(kas)}</Text>
                  <Text style={[styles.td, { width: 55, textAlign: 'center', color: '#7C3AED', fontWeight: '700' }]}>
                    {pt > 0 ? fmt(pt) : '-'}
                  </Text>
                  <Text style={[styles.td, { width: 60, textAlign: 'right', color: '#059669', fontWeight: '700' }]}>
                    {fmt(item.jumlah)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Pengeluaran */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PENGELUARAN</Text>
          {pengeluaran.map((p, i) => (
            <View key={i} style={styles.pengRow}>
              <Text style={styles.pengNo}>{i + 1}</Text>
              <TextInput
                style={[styles.pengInput, { flex: 2 }]}
                placeholder="Jenis pengeluaran..."
                value={p.jenis}
                onChangeText={v => { const a = [...pengeluaran]; a[i].jenis = v; setPengeluaran(a); }}
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                style={[styles.pengInput, { flex: 1 }]}
                placeholder="Harga"
                value={p.harga}
                onChangeText={v => { const a = [...pengeluaran]; a[i].harga = v; setPengeluaran(a); }}
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          ))}
          <View style={styles.totalOutRow}>
            <Text style={styles.totalOutLabel}>TOTAL OUT</Text>
            <Text style={styles.totalOutValue}>Rp {fmt(totalOut)}</Text>
          </View>
        </View>

        {/* Pembayaran Cashless */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PEMBAYARAN CASHLESS</Text>
          <View style={styles.payGrid}>
            {[
              { label: 'BCA', value: bca, setter: setBca },
              { label: 'BSI', value: bsi, setter: setBsi },
              { label: 'CIMB/BNI', value: cimbBni, setter: setCimbBni },
              { label: 'QRIS BCA', value: qrisBca, setter: setQrisBca },
              { label: 'MANDIRI', value: mandiri, setter: setMandiri },
              { label: 'VOUCHER', value: voucher, setter: setVoucher },
            ].map(({ label, value, setter }) => (
              <View key={label} style={styles.payField}>
                <Text style={styles.payLabel}>{label}</Text>
                <TextInput
                  style={styles.payInput} value={value} onChangeText={setter}
                  keyboardType="numeric" placeholder="0" placeholderTextColor="#9CA3AF"
                />
              </View>
            ))}
          </View>
        </View>

        {/* Rekap Akhir */}
        <View style={styles.rekapBox}>
          <Text style={styles.rekapBoxTitle}>REKAP AKHIR</Text>
          <RekapRow label="Total Omset" value={`Rp ${fmt(omset)}`} />
          <RekapRow label="Total Out" value={`- Rp ${fmt(totalOut)}`} valueColor="#EF4444" />
          <View style={styles.rekapDivider} />
          <RekapRow label="Total Cashless" value={`Rp ${fmt(totalCashless)}`} />
          <RekapRow label="Pendapatan Washer" value={`Rp ${fmt(totalPendapatanWasher)}`} valueColor="#059669" />
          <RekapRow label="Pendapatan TP" value={`Rp ${fmt(totalPendapatanTP)}`} valueColor="#A78BFA" />
          <View style={[styles.rekapHighlight, { marginTop: 10 }]}>
            <Text style={styles.rekapLabelBold}>TUNAI</Text>
            <Text style={styles.rekapValueBold}>Rp {fmt(Math.max(0, tunai))}</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.closeBtn, closeMutation.isPending && styles.closeBtnDisabled]}
          onPress={() => closeMutation.mutate()}
          disabled={closeMutation.isPending}
        >
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.closeBtnText}>
            {closeMutation.isPending ? 'Menyimpan...' : 'SELESAIKAN CLOSING'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, valueColor, large }: { label: string; value: string; valueColor?: string; large?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      <Text style={{ fontSize: 13, color: '#6B7280' }}>{label}</Text>
      <Text style={{ fontSize: large ? 16 : 13, fontWeight: large ? '900' : '600', color: valueColor || '#1F2937' }}>{value}</Text>
    </View>
  );
}

function RekapRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: valueColor || '#E5E7EB' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1F2937', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { color: '#9CA3AF', fontSize: 11, marginTop: 1 },
  statusBadge: { backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  scroll: { flex: 1 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  card: { margin: 10, marginBottom: 0, backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  cardTitle: { fontSize: 11, fontWeight: '800', color: '#1F2937', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  rekapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rekapIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  rekapLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  rekapSub: { fontSize: 10, color: '#9CA3AF' },
  rekapVal: { fontSize: 14, fontWeight: '800' },
  tpBreakdown: { marginTop: 10, backgroundColor: '#F5F3FF', borderRadius: 8, padding: 10 },
  tpBreakdownTitle: { fontSize: 11, fontWeight: '700', color: '#5B21B6', marginBottom: 6 },
  tpBreakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  tpName: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '600' },
  tpTotal: { fontSize: 13, fontWeight: '800', color: '#7C3AED' },
  tableHead: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 6, padding: 6, marginBottom: 2 },
  th: { fontSize: 9, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  tdName: { fontSize: 11, color: '#374151', fontWeight: '500' },
  tdTP: { fontSize: 10, color: '#7C3AED', marginTop: 1 },
  td: { fontSize: 11, color: '#374151' },
  pengRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pengNo: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', width: 18 },
  pengInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 9, fontSize: 13, color: '#1F2937', backgroundColor: '#F9FAFB' },
  totalOutRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  totalOutLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  totalOutValue: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  payGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  payField: { width: '47%' },
  payLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 4 },
  payInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, fontSize: 14, color: '#1F2937', backgroundColor: '#F9FAFB' },
  rekapBox: { margin: 10, backgroundColor: '#1F2937', borderRadius: 12, padding: 16 },
  rekapBoxTitle: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  rekapDivider: { height: 1, backgroundColor: '#374151', marginVertical: 6 },
  rekapHighlight: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#E85D04', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4 },
  rekapLabelBold: { fontSize: 15, fontWeight: '800', color: '#fff' },
  rekapValueBold: { fontSize: 18, fontWeight: '900', color: '#fff' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingBottom: Platform.OS === 'ios' ? 24 : 16 },
  closeBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  closeBtnDisabled: { backgroundColor: '#6EE7B7' },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
