import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, FlatList, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import { ClosingReport } from '@/types/closing';

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
  yellowBg:'#FFFBEB',
  white:   '#FFFFFF',
  border:  '#E2E8F0',
};

function fmt(n: number) { return n.toLocaleString('id-ID'); }

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateLong(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export default function HistoryScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['closing_reports'],
    queryFn: async () => {
      const res = await blink.db.closingReports.list({ orderBy: { createdAt: 'desc' }, limit: 50 });
      return res as ClosingReport[];
    },
  });

  const { data: selectedItems } = useQuery({
    queryKey: ['closing_items', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      return await blink.db.closingItems.list({ where: { closingId: selectedId } });
    },
    enabled: !!selectedId,
  });

  const { data: selectedPengeluaran } = useQuery({
    queryKey: ['pengeluaran', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      return await blink.db.pengeluaran.list({ where: { closingId: selectedId } });
    },
    enabled: !!selectedId,
  });

  const selectedReport = reports?.find(r => r.id === selectedId);

  // Aggregate dari items
  const selectedTPRekap: Record<string, number> = {};
  let selWasher = 0, selTP = 0;
  if (selectedItems) {
    (selectedItems as any[]).forEach((it: any) => {
      selWasher += it.pendapatanWasher || it.pendapatan_washer || 0;
      selTP     += it.pendapatanTP     || it.pendapatan_tp     || 0;
      const namaTP = it.namaTP || it.nama_tp || '';
      const pt     = it.pendapatanTP || it.pendapatan_tp || 0;
      if (namaTP && pt > 0) selectedTPRekap[namaTP] = (selectedTPRekap[namaTP] || 0) + pt;
    });
  }

  const totalAll = reports?.length || 0;
  const omsetAll = reports?.reduce((s, r) => s + (r.totalOmset || 0), 0) || 0;
  const closedCount = reports?.filter(r => r.status === 'closed').length || 0;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <View>
          <Text style={st.headerTitle}>RIWAYAT CLOSING</Text>
          <Text style={st.headerSub}>Rekap harian & laporan kasir</Text>
        </View>
        <View style={st.headerIcon}>
          <Ionicons name="time-outline" size={20} color={C.white} />
        </View>
      </View>

      {/* Summary */}
      <View style={st.summaryRow}>
        <View style={[st.summaryCard, { backgroundColor: C.dark }]}>
          <Ionicons name="documents-outline" size={18} color="#94A3B8" />
          <Text style={st.sumVal}>{totalAll}</Text>
          <Text style={st.sumLbl}>Total</Text>
        </View>
        <View style={[st.summaryCard, { backgroundColor: C.green }]}>
          <Ionicons name="checkmark-done-circle-outline" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={[st.sumVal, { color: C.white }]}>{closedCount}</Text>
          <Text style={[st.sumLbl, { color: 'rgba(255,255,255,0.75)' }]}>Selesai</Text>
        </View>
        <View style={[st.summaryCard, { backgroundColor: C.orange, flex: 2 }]}>
          <Ionicons name="cash-outline" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={[st.sumVal, { color: C.white, fontSize: 15 }]}>Rp {fmt(omsetAll)}</Text>
          <Text style={[st.sumLbl, { color: 'rgba(255,255,255,0.75)' }]}>Total Omset</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={st.centerBox}>
          <Ionicons name="hourglass-outline" size={44} color={C.orange} />
          <Text style={st.emptyTxt}>Memuat data...</Text>
        </View>
      ) : !reports || reports.length === 0 ? (
        <View style={st.centerBox}>
          <Ionicons name="time-outline" size={64} color={C.grayL} />
          <Text style={st.emptyTitle}>Belum Ada Riwayat</Text>
          <Text style={st.emptyTxt}>Closing yang sudah disimpan akan tampil di sini</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const isClosed = item.status === 'closed';
            return (
              <TouchableOpacity
                style={st.card}
                onPress={() => setSelectedId(item.id)}
                activeOpacity={0.8}
              >
                {/* Card Header */}
                <View style={st.cardHead}>
                  <View style={[st.statusDot, { backgroundColor: isClosed ? C.green : C.yellow }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.cardDate}>{formatDate(item.tanggal)}</Text>
                    <Text style={st.cardMeta}>{item.kasir} · Shift {(item as any).shift || '-'} · {item.jumlahMobil} kendaraan</Text>
                  </View>
                  <View style={st.cardRight}>
                    <Text style={st.cardOmset}>Rp {fmt(item.totalOmset)}</Text>
                    <View style={[st.statusPill, { backgroundColor: isClosed ? C.greenBg : C.yellowBg }]}>
                      <Text style={[st.statusPillTxt, { color: isClosed ? C.green : C.yellow }]}>
                        {isClosed ? 'Selesai' : 'Aktif'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Card Stats (only closed) */}
                {isClosed && (
                  <View style={st.cardStats}>
                    <StatChip icon="card-outline" label="Cashless" value={`Rp ${fmt(item.totalCashless || 0)}`} color={C.slate} />
                    <StatChip icon="cash-outline" label="Tunai" value={`Rp ${fmt(item.kasTunai || 0)}`} color={C.green} />
                    <StatChip icon="arrow-down-circle-outline" label="Keluar" value={`Rp ${fmt(item.totalOut || 0)}`} color={C.red} />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Detail Modal ── */}
      <Modal visible={!!selectedId} animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <SafeAreaView style={st.modalSafe} edges={['top']}>
          {/* Modal Header */}
          <View style={st.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedId(null)} style={st.backBtn}>
              <Ionicons name="arrow-back" size={22} color={C.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={st.modalTitle}>Detail Closing</Text>
              {selectedReport && (
                <Text style={st.modalSub}>{formatDateLong(selectedReport.tanggal)}</Text>
              )}
            </View>
            {selectedReport && (
              <View style={[st.statusPill, { backgroundColor: selectedReport.status === 'closed' ? C.greenBg : C.yellowBg }]}>
                <Text style={[st.statusPillTxt, { color: selectedReport.status === 'closed' ? C.green : C.yellow }]}>
                  {selectedReport.status === 'closed' ? '✓ Selesai' : 'Aktif'}
                </Text>
              </View>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: 48 }}>
            {selectedReport && (
              <>
                {/* Info Dasar */}
                <View style={st.detCard}>
                  <Text style={st.detCardTitle}>INFORMASI CLOSING</Text>
                  <DR label="Kasir"            val={selectedReport.kasir} />
                  <DR label="Cabang"           val={selectedReport.cabang} />
                  <DR label="Jumlah Kendaraan" val={`${selectedReport.jumlahMobil} unit`} />
                  <DR label="Total Omset"      val={`Rp ${fmt(selectedReport.totalOmset)}`} vc={C.orange} bold />
                </View>

                {/* Rekap Omset */}
                <View style={[st.detCard, { backgroundColor: C.dark }]}>
                  <Text style={[st.detCardTitle, { color: C.white }]}>REKAP AKHIR</Text>
                  <RR label="Total Omset"      val={`Rp ${fmt(selectedReport.totalOmset)}`}          />
                  <RR label="Total Pengeluaran" val={`- Rp ${fmt(selectedReport.totalOut || 0)}`}   vc="#FCA5A5" />
                  <View style={st.detDiv} />
                  <RR label="Omset Bersih"     val={`Rp ${fmt(selectedReport.totalOmset - (selectedReport.totalOut || 0))}`} vc="#FCD34D" bold />
                  <View style={st.detDiv} />
                  <RR label="Total Cashless"   val={`- Rp ${fmt(selectedReport.totalCashless || 0)}`} vc="#94A3B8" />
                  <View style={[st.highlightRow, { marginTop: 10 }]}>
                    <View>
                      <Text style={st.hlLabel}>TUNAI RILL (LOKER)</Text>
                      <Text style={st.hlSub}>Omset Bersih − Cashless</Text>
                    </View>
                    <Text style={st.hlVal}>Rp {fmt(selectedReport.kasTunai || 0)}</Text>
                  </View>
                </View>

                {/* Rekap Pendapatan */}
                {(selWasher > 0 || selTP > 0) && (
                  <View style={st.detCard}>
                    <Text style={st.detCardTitle}>REKAP PENDAPATAN KARYAWAN</Text>
                    <View style={st.pendRow}>
                      <View style={[st.pendBox, { backgroundColor: C.greenBg }]}>
                        <Ionicons name="water-outline" size={18} color={C.green} />
                        <Text style={[st.pendLbl, { color: '#065F46' }]}>Washer</Text>
                        <Text style={[st.pendVal, { color: C.green }]}>Rp {fmt(selWasher)}</Text>
                      </View>
                      <View style={[st.pendBox, { backgroundColor: C.purpleBg }]}>
                        <Ionicons name="star-outline" size={18} color={C.purple} />
                        <Text style={[st.pendLbl, { color: '#4C1D95' }]}>TP Total</Text>
                        <Text style={[st.pendVal, { color: C.purple }]}>Rp {fmt(selTP)}</Text>
                      </View>
                    </View>
                    {Object.keys(selectedTPRekap).length > 0 && (
                      <View style={st.tpBreakdown}>
                        <Text style={st.tpBdTitle}>Rincian per Team Polisher:</Text>
                        {Object.entries(selectedTPRekap).map(([nama, total]) => (
                          <View key={nama} style={st.tpBdRow}>
                            <Ionicons name="person-outline" size={13} color={C.purple} />
                            <Text style={st.tpBdName}>{nama}</Text>
                            <Text style={st.tpBdVal}>Rp {fmt(total)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Detail Layanan */}
                {selectedItems && (selectedItems as any[]).length > 0 && (
                  <View style={st.detCard}>
                    <Text style={st.detCardTitle}>DETAIL LAYANAN</Text>
                    {(selectedItems as any[]).map((it: any, i: number) => {
                      const namaTP = it.namaTP || it.nama_tp || '';
                      const pt     = it.pendapatanTP || it.pendapatan_tp || 0;
                      return (
                        <View key={i} style={st.svcRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={st.svcName} numberOfLines={2}>{it.serviceName || it.service_name}</Text>
                            {namaTP ? (
                              <Text style={st.svcTP}>TP: {namaTP} · +{fmt(pt)}</Text>
                            ) : null}
                          </View>
                          <Text style={st.svcQty}>×{it.qty}</Text>
                          <Text style={st.svcJumlah}>Rp {fmt(it.jumlah)}</Text>
                        </View>
                      );
                    })}
                    <View style={st.svcTotal}>
                      <Text style={st.svcTotalLbl}>TOTAL OMSET</Text>
                      <Text style={st.svcTotalVal}>Rp {fmt(selectedReport.totalOmset)}</Text>
                    </View>
                  </View>
                )}

                {/* Pengeluaran */}
                {selectedPengeluaran && (selectedPengeluaran as any[]).length > 0 && (
                  <View style={st.detCard}>
                    <Text style={st.detCardTitle}>PENGELUARAN</Text>
                    {(selectedPengeluaran as any[]).map((p: any, i: number) => (
                      <View key={i} style={st.svcRow}>
                        <Text style={[st.svcName, { flex: 1 }]}>{p.jenis}</Text>
                        <Text style={[st.svcJumlah, { color: C.red }]}>- Rp {fmt(p.harga)}</Text>
                      </View>
                    ))}
                    <View style={st.svcTotal}>
                      <Text style={st.svcTotalLbl}>TOTAL KELUAR</Text>
                      <Text style={[st.svcTotalVal, { color: C.red }]}>- Rp {fmt(selectedReport.totalOut || 0)}</Text>
                    </View>
                  </View>
                )}

                {/* Rincian Pembayaran */}
                {selectedReport.status === 'closed' && (
                  <View style={st.detCard}>
                    <Text style={st.detCardTitle}>RINCIAN PEMBAYARAN</Text>
                    {selectedReport.kasQrisBca > 0   && <DR label="QRIS BCA"    val={`Rp ${fmt(selectedReport.kasQrisBca)}`}  />}
                    {selectedReport.kasBca > 0        && <DR label="BCA Transfer" val={`Rp ${fmt(selectedReport.kasBca)}`}     />}
                    {selectedReport.kasBsi > 0        && <DR label="BSI"          val={`Rp ${fmt(selectedReport.kasBsi)}`}     />}
                    {selectedReport.kasCimbBni > 0    && <DR label="CIMB / BNI"   val={`Rp ${fmt(selectedReport.kasCimbBni)}`}/>}
                    {selectedReport.kasMandiri > 0    && <DR label="Mandiri"       val={`Rp ${fmt(selectedReport.kasMandiri)}`}/>}
                    {selectedReport.kasVoucher > 0    && <DR label="Voucher"       val={`Rp ${fmt(selectedReport.kasVoucher)}`}/>}
                    <View style={[st.detDiv, { marginVertical: 6 }]} />
                    <DR label="Total Cashless" val={`Rp ${fmt(selectedReport.totalCashless || 0)}`} vc={C.slate} />
                    <View style={[st.highlightRow, { marginTop: 8 }]}>
                      <Text style={st.hlLabel}>TUNAI (LOKER)</Text>
                      <Text style={st.hlVal}>Rp {fmt(selectedReport.kasTunai || 0)}</Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function StatChip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={st.statChip}>
      <Ionicons name={icon as any} size={12} color={color} />
      <Text style={st.statChipLbl}>{label}</Text>
      <Text style={[st.statChipVal, { color }]}>{value}</Text>
    </View>
  );
}

function DR({ label, val, vc, bold }: { label: string; val: string; vc?: string; bold?: boolean }) {
  return (
    <View style={st.dr}>
      <Text style={[st.drLbl, bold && { fontWeight: '700', color: C.slate }]}>{label}</Text>
      <Text style={[st.drVal, bold && { fontWeight: '900', fontSize: 15 }, vc && { color: vc }]}>{val}</Text>
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
  safe:       { flex: 1, backgroundColor: C.bg },
  header:     { backgroundColor: C.dark, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:{ color: C.white, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  headerSub:  { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  headerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },

  summaryRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 4 },
  summaryCard:{ flex: 1, borderRadius: 14, padding: 12, gap: 4, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  sumVal:     { fontSize: 18, fontWeight: '900', color: C.white },
  sumLbl:     { fontSize: 10, fontWeight: '600', color: '#94A3B8' },

  centerBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.slate, marginTop: 14 },
  emptyTxt:   { fontSize: 13, color: C.gray, textAlign: 'center', marginTop: 6 },

  card:       { backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHead:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot:  { width: 10, height: 10, borderRadius: 5 },
  cardDate:   { fontSize: 14, fontWeight: '800', color: C.dark },
  cardMeta:   { fontSize: 11, color: C.gray, marginTop: 1 },
  cardRight:  { alignItems: 'flex-end', gap: 4 },
  cardOmset:  { fontSize: 14, fontWeight: '900', color: C.orange },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12 },
  statusPillTxt:{ fontSize: 10, fontWeight: '700' },
  cardStats:  { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, gap: 6 },
  statChip:   { flex: 1, alignItems: 'center', gap: 2 },
  statChipLbl:{ fontSize: 9, color: C.gray, fontWeight: '500' },
  statChipVal:{ fontSize: 10, fontWeight: '800' },

  modalSafe:  { flex: 1, backgroundColor: C.bg },
  modalHeader:{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.dark, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  modalSub:   { color: '#94A3B8', fontSize: 11, marginTop: 1 },

  detCard:    { backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  detCardTitle:{ fontSize: 11, fontWeight: '800', color: C.slate, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  detDiv:     { height: 1, backgroundColor: '#374151', marginVertical: 4 },
  dr:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  drLbl:      { fontSize: 13, color: C.gray },
  drVal:      { fontSize: 13, fontWeight: '600', color: C.dark },

  highlightRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.orange, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  hlLabel:    { fontSize: 12, fontWeight: '800', color: C.white },
  hlSub:      { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  hlVal:      { fontSize: 18, fontWeight: '900', color: C.white },

  pendRow:    { flexDirection: 'row', gap: 10, marginBottom: 10 },
  pendBox:    { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  pendLbl:    { fontSize: 11, fontWeight: '600' },
  pendVal:    { fontSize: 15, fontWeight: '900' },

  tpBreakdown:{ backgroundColor: C.purpleBg, borderRadius: 10, padding: 10 },
  tpBdTitle:  { fontSize: 11, fontWeight: '700', color: '#5B21B6', marginBottom: 6 },
  tpBdRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  tpBdName:   { flex: 1, fontSize: 13, color: C.slate, fontWeight: '600' },
  tpBdVal:    { fontSize: 13, fontWeight: '800', color: C.purple },

  svcRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  svcName:    { fontSize: 12, color: C.slate, fontWeight: '500' },
  svcTP:      { fontSize: 10, color: C.purple, marginTop: 2 },
  svcQty:     { fontSize: 12, fontWeight: '800', color: C.orange, marginHorizontal: 4 },
  svcJumlah:  { fontSize: 12, fontWeight: '700', color: C.green, minWidth: 90, textAlign: 'right' },
  svcTotal:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.grayL },
  svcTotalLbl:{ fontSize: 12, fontWeight: '800', color: C.slate },
  svcTotalVal:{ fontSize: 14, fontWeight: '900', color: C.orange },
});
