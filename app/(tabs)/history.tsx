import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { blink } from '@/lib/blink';
import { ClosingReport } from '@/types/closing';

function formatRibuan(n: number): string {
  return n.toLocaleString('id-ID');
}

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateLong(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export default function HistoryScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['closing_reports'],
    queryFn: async () => {
      const res = await blink.db.closingReports.list({
        orderBy: { createdAt: 'desc' },
        limit: 50,
      });
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

  // Aggregate pendapatan from selectedItems
  const selectedTPRekap: Record<string, number> = {};
  let selPendapatanWasher = 0;
  let selPendapatanTP = 0;
  if (selectedItems) {
    (selectedItems as any[]).forEach((item: any) => {
      selPendapatanWasher += item.pendapatanWasher || item.pendapatan_washer || 0;
      selPendapatanTP += item.pendapatanTP || item.pendapatan_tp || 0;
      const namaTP = item.namaTP || item.nama_tp || '';
      const pt = item.pendapatanTP || item.pendapatan_tp || 0;
      if (namaTP && pt > 0) {
        selectedTPRekap[namaTP] = (selectedTPRekap[namaTP] || 0) + pt;
      }
    });
  }

  const { data: selectedPengeluaran } = useQuery({
    queryKey: ['pengeluaran', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      return await blink.db.pengeluaran.list({ where: { closingId: selectedId } });
    },
    enabled: !!selectedId,
  });

  const selectedReport = reports?.find(r => r.id === selectedId);

  const totalReports = reports?.length || 0;
  const totalOmsetAll = reports?.reduce((sum, r) => sum + (r.totalOmset || 0), 0) || 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>RIWAYAT CLOSING</Text>
        <Text style={styles.headerSub}>Orange Carwash - Semarang 3</Text>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{totalReports}</Text>
          <Text style={styles.statLabel}>Total Closing</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxOrange]}>
          <Text style={[styles.statVal, { color: '#fff' }]}>Rp {formatRibuan(totalOmsetAll)}</Text>
          <Text style={[styles.statLabel, { color: '#FED7AA' }]}>Total Omset</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <Ionicons name="hourglass" size={40} color="#E85D04" />
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      ) : !reports || reports.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="time-outline" size={60} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Belum Ada Riwayat</Text>
          <Text style={styles.emptyDesc}>Closing yang sudah disimpan akan tampil di sini</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelectedId(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <View style={[styles.statusDot, item.status === 'closed' ? styles.statusClosed : styles.statusOpen]} />
                  <View>
                    <Text style={styles.cardDate}>{formatDate(item.tanggal)}</Text>
                    <Text style={styles.cardKasir}>{item.kasir} · {item.jumlahMobil} kendaraan</Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardOmset}>Rp {formatRibuan(item.totalOmset)}</Text>
                  <Text style={[styles.cardStatus, item.status === 'closed' ? styles.statusClosedText : styles.statusOpenText]}>
                    {item.status === 'closed' ? 'Selesai' : 'Aktif'}
                  </Text>
                </View>
              </View>
              {item.status === 'closed' && (
                <View style={styles.cardBottom}>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardStatLabel}>Tunai</Text>
                    <Text style={styles.cardStatVal}>Rp {formatRibuan(item.kasTunai || 0)}</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardStatLabel}>Cashless</Text>
                    <Text style={styles.cardStatVal}>Rp {formatRibuan(item.totalCashless || 0)}</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardStatLabel}>Pengeluaran</Text>
                    <Text style={[styles.cardStatVal, { color: '#EF4444' }]}>Rp {formatRibuan(item.totalOut || 0)}</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedId} animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedId(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={styles.modalTitle}>Detail Closing</Text>
              {selectedReport && <Text style={styles.modalSub}>{formatDateLong(selectedReport.tanggal)}</Text>}
            </View>
            <View style={{ width: 38 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {selectedReport && (
              <>
                {/* Info */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>Informasi Closing</Text>
                  <DetailRow label="Kasir" value={selectedReport.kasir} />
                  <DetailRow label="Cabang" value={selectedReport.cabang} />
                  <DetailRow label="Jumlah Kendaraan" value={`${selectedReport.jumlahMobil}`} />
                  <DetailRow label="Status" value={selectedReport.status === 'closed' ? '✅ Selesai' : '🟡 Aktif'} />
                </View>

                {/* Layanan */}
                {selectedItems && selectedItems.length > 0 && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailSectionTitle}>Detail Layanan</Text>
                    {(selectedItems as any[]).map((item: any, i: number) => {
                      const namaTP = item.namaTP || item.nama_tp || '';
                      const pt = item.pendapatanTP || item.pendapatan_tp || 0;
                      return (
                        <View key={i} style={styles.itemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName} numberOfLines={2}>{item.serviceName || item.service_name}</Text>
                            {namaTP ? <Text style={{ fontSize: 10, color: '#7C3AED', marginTop: 1 }}>TP: {namaTP} · +{formatRibuan(pt)}</Text> : null}
                          </View>
                          <Text style={styles.itemQty}>x{item.qty}</Text>
                          <Text style={styles.itemJumlah}>Rp {formatRibuan(item.jumlah)}</Text>
                        </View>
                      );
                    })}
                    <View style={styles.itemTotal}>
                      <Text style={styles.itemTotalLabel}>TOTAL OMSET</Text>
                      <Text style={styles.itemTotalVal}>Rp {formatRibuan(selectedReport.totalOmset)}</Text>
                    </View>
                  </View>
                )}

                {/* Rekap Pendapatan */}
                {(selPendapatanWasher > 0 || selPendapatanTP > 0) && (
                  <View style={[styles.detailCard, { backgroundColor: '#1F2937' }]}>
                    <Text style={[styles.detailSectionTitle, { color: '#fff' }]}>REKAP PENDAPATAN</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                      <Text style={{ fontSize: 12, color: '#9CA3AF' }}>💧 Pendapatan Washer</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#34D399' }}>Rp {formatRibuan(selPendapatanWasher)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                      <Text style={{ fontSize: 12, color: '#9CA3AF' }}>⭐ Pendapatan TP</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#A78BFA' }}>Rp {formatRibuan(selPendapatanTP)}</Text>
                    </View>
                    {Object.keys(selectedTPRekap).length > 0 && (
                      <View style={{ backgroundColor: '#374151', borderRadius: 8, padding: 10, marginTop: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#A78BFA', marginBottom: 6 }}>RINCIAN PER TP:</Text>
                        {Object.entries(selectedTPRekap).map(([nama, total]) => (
                          <View key={nama} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                            <Text style={{ fontSize: 12, color: '#E5E7EB' }}>👤 {nama}</Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#A78BFA' }}>Rp {formatRibuan(total)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Pengeluaran */}
                {selectedPengeluaran && selectedPengeluaran.length > 0 && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailSectionTitle}>Pengeluaran</Text>
                    {(selectedPengeluaran as any[]).map((p: any, i: number) => (
                      <View key={i} style={styles.itemRow}>
                        <Text style={styles.itemName}>{p.jenis}</Text>
                        <Text style={[styles.itemJumlah, { color: '#EF4444' }]}>Rp {formatRibuan(p.harga)}</Text>
                      </View>
                    ))}
                    <View style={styles.itemTotal}>
                      <Text style={styles.itemTotalLabel}>TOTAL OUT</Text>
                      <Text style={[styles.itemTotalVal, { color: '#EF4444' }]}>Rp {formatRibuan(selectedReport.totalOut || 0)}</Text>
                    </View>
                  </View>
                )}

                {/* Pembayaran */}
                {selectedReport.status === 'closed' && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailSectionTitle}>Rincian Pembayaran</Text>
                    {selectedReport.kasBca > 0 && <DetailRow label="BCA" value={`Rp ${formatRibuan(selectedReport.kasBca)}`} />}
                    {selectedReport.kasBsi > 0 && <DetailRow label="BSI" value={`Rp ${formatRibuan(selectedReport.kasBsi)}`} />}
                    {selectedReport.kasCimbBni > 0 && <DetailRow label="CIMB/BNI" value={`Rp ${formatRibuan(selectedReport.kasCimbBni)}`} />}
                    {selectedReport.kasQrisBca > 0 && <DetailRow label="QRIS BCA" value={`Rp ${formatRibuan(selectedReport.kasQrisBca)}`} />}
                    {selectedReport.kasMandiri > 0 && <DetailRow label="Mandiri" value={`Rp ${formatRibuan(selectedReport.kasMandiri)}`} />}
                    {selectedReport.kasVoucher > 0 && <DetailRow label="Voucher" value={`Rp ${formatRibuan(selectedReport.kasVoucher)}`} />}
                    <View style={styles.divider} />
                    <DetailRow label="Total Cashless" value={`Rp ${formatRibuan(selectedReport.totalCashless || 0)}`} />
                    <View style={styles.highlightRow}>
                      <Text style={styles.highlightLabel}>TUNAI</Text>
                      <Text style={styles.highlightVal}>Rp {formatRibuan(selectedReport.kasTunai || 0)}</Text>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  label: { fontSize: 13, color: '#6B7280' },
  value: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#1F2937', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { color: '#9CA3AF', fontSize: 12 },
  statsRow: { flexDirection: 'row', padding: 12, gap: 10 },
  statBox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statBoxOrange: { backgroundColor: '#E85D04' },
  statVal: { fontSize: 18, fontWeight: '900', color: '#1F2937' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: '#6B7280', marginTop: 12 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusClosed: { backgroundColor: '#10B981' },
  statusOpen: { backgroundColor: '#F59E0B' },
  cardDate: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  cardKasir: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardOmset: { fontSize: 14, fontWeight: '800', color: '#E85D04' },
  cardStatus: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  statusClosedText: { color: '#10B981' },
  statusOpenText: { color: '#F59E0B' },
  cardBottom: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  cardStat: { flex: 1, alignItems: 'center' },
  cardStatLabel: { fontSize: 10, color: '#9CA3AF' },
  cardStatVal: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 2 },
  modalSafe: { flex: 1, backgroundColor: '#F9FAFB' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1F2937', paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  modalSub: { color: '#9CA3AF', fontSize: 11, textAlign: 'center' },
  detailCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  detailSectionTitle: { fontSize: 13, fontWeight: '800', color: '#1F2937', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  itemName: { flex: 1, fontSize: 12, color: '#374151' },
  itemQty: { fontSize: 12, fontWeight: '700', color: '#E85D04', marginHorizontal: 8 },
  itemJumlah: { fontSize: 12, fontWeight: '600', color: '#059669', minWidth: 90, textAlign: 'right' },
  itemTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  itemTotalLabel: { fontSize: 13, fontWeight: '800', color: '#374151' },
  itemTotalVal: { fontSize: 14, fontWeight: '900', color: '#E85D04' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 },
  highlightRow: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#E85D04',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8,
  },
  highlightLabel: { fontSize: 15, fontWeight: '800', color: '#fff' },
  highlightVal: { fontSize: 16, fontWeight: '900', color: '#fff' },
});
