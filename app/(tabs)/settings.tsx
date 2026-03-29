import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blink } from '@/lib/blink';

// ─── Warna ──────────────────────────────────────────────────────────────────
const C = {
  orange:    '#E85D04',
  orangeLight:'#FFF3E0',
  orangeDark: '#BF4800',
  bg:        '#F5F5F5',
  card:      '#FFFFFF',
  dark:      '#1A1A2E',
  slate:     '#374151',
  gray:      '#6B7280',
  grayLight: '#E5E7EB',
  grayBg:    '#F9FAFB',
  green:     '#059669',
  greenBg:   '#ECFDF5',
  red:       '#DC2626',
  redBg:     '#FEF2F2',
  purple:    '#7C3AED',
  purpleBg:  '#F5F3FF',
  yellow:    '#F59E0B',
  yellowBg:  '#FFFBEB',
  border:    '#E5E7EB',
  white:     '#FFFFFF',
};

function fmt(n: number) { return n.toLocaleString('id-ID'); }

// ─── Types ──────────────────────────────────────────────────────────────────
interface Karyawan { id: string; nama: string; peran: string; aktif: number }
interface CarModel  { id: string; nama: string; kategori: string; aktif: number }
interface AppSetting { key: string; value: string }

const PERAN_OPTIONS = [
  { value: 'washer', label: 'Washer',     icon: 'water',    color: C.green  },
  { value: 'tp',     label: 'Team Polisher', icon: 'star',  color: C.purple },
  { value: 'both',   label: 'Washer & TP',  icon: 'people', color: C.orange },
];

const KAT_OPTIONS = [
  { value: 'umum',    label: 'Umum/Medium', color: C.green  },
  { value: 'big',     label: 'Besar/Big',   color: C.red    },
  { value: 'premium', label: 'Premium',     color: C.purple },
];

const KASIR_LIST = ['Andi', 'Budi', 'Candra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hendra'];

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const qc = useQueryClient();

  // ── Global State ──
  const [activeSection, setActiveSection] = useState<'kasir' | 'karyawan' | 'mobil' | 'pendapatan'>('kasir');

  // ── Fetch settings ──
  const { data: settings, isLoading: loadSettings } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const res = await blink.db.appSettings.list();
      const map: Record<string, string> = {};
      (res as AppSetting[]).forEach(s => { map[s.key] = s.value; });
      return map;
    },
  });

  const setSetting = async (key: string, value: string) => {
    try {
      await blink.db.appSettings.upsert({ key, value });
      qc.invalidateQueries({ queryKey: ['app_settings'] });
    } catch {}
  };

  if (loadSettings) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={C.orange} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>PENGATURAN</Text>
          <Text style={s.headerSub}>{settings?.cabang || 'Orange Carwash'}</Text>
        </View>
        <View style={s.headerIcon}>
          <Ionicons name="settings" size={22} color={C.white} />
        </View>
      </View>

      {/* Nav Tabs */}
      <View style={s.navBar}>
        {([
          { key: 'kasir',     label: 'Kasir',     icon: 'person'    },
          { key: 'karyawan',  label: 'Karyawan',  icon: 'people'    },
          { key: 'mobil',     label: 'Mobil',     icon: 'car'       },
          { key: 'pendapatan',label: 'Tarif',     icon: 'pricetag'  },
        ] as const).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.navTab, activeSection === tab.key && s.navTabActive]}
            onPress={() => setActiveSection(tab.key)}
          >
            <Ionicons name={tab.icon as any} size={16}
              color={activeSection === tab.key ? C.orange : C.gray} />
            <Text style={[s.navTabTxt, activeSection === tab.key && s.navTabTxtActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {activeSection === 'kasir'      && <KasirSection settings={settings || {}} setSetting={setSetting} />}
        {activeSection === 'karyawan'   && <KaryawanSection />}
        {activeSection === 'mobil'      && <MobilSection />}
        {activeSection === 'pendapatan' && <PendapatanSection settings={settings || {}} setSetting={setSetting} />}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Kasir Section ────────────────────────────────────────────────────────────
function KasirSection({ settings, setSetting }: { settings: Record<string, string>; setSetting: (k: string, v: string) => void }) {
  const [customKasir, setCustomKasir] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const kasirAktif = settings.kasir_aktif || settings.kasirAktif || '';
  const shiftAktif = settings.shift_aktif || settings.shiftAktif || '1';
  const cabang     = settings.cabang || '';

  const handleKasirPilih = (nama: string) => {
    setSetting('kasir_aktif', nama);
    setShowCustom(false);
  };

  return (
    <View style={s.section}>
      {/* Status Login */}
      <View style={[s.card, { borderLeftWidth: 4, borderLeftColor: kasirAktif ? C.green : C.grayLight }]}>
        <View style={s.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardLabel}>STATUS KASIR</Text>
            {kasirAktif ? (
              <Text style={[s.cardValue, { color: C.green, fontSize: 20 }]}>✓ {kasirAktif}</Text>
            ) : (
              <Text style={[s.cardValue, { color: C.gray }]}>Belum login</Text>
            )}
          </View>
          <View style={[s.shiftBadge, { backgroundColor: shiftAktif === '1' ? C.orangeLight : C.purpleBg }]}>
            <Text style={[s.shiftBadgeTxt, { color: shiftAktif === '1' ? C.orange : C.purple }]}>
              SHIFT {shiftAktif}
            </Text>
          </View>
        </View>
        {kasirAktif ? (
          <TouchableOpacity style={s.logoutBtn} onPress={() => setSetting('kasir_aktif', '')}>
            <Ionicons name="log-out-outline" size={16} color={C.red} />
            <Text style={s.logoutTxt}>Logout Kasir</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Pilih Kasir */}
      <Text style={s.sectionTitle}>PILIH KASIR</Text>
      <View style={s.chipWrap}>
        {KASIR_LIST.map(k => (
          <TouchableOpacity
            key={k}
            style={[s.chip, kasirAktif === k && s.chipActive]}
            onPress={() => handleKasirPilih(k)}
          >
            <Ionicons name="person" size={13} color={kasirAktif === k ? C.white : C.gray} />
            <Text style={[s.chipTxt, kasirAktif === k && s.chipTxtActive]}>{k}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.chip, showCustom && s.chipActive]}
          onPress={() => { setShowCustom(v => !v); }}
        >
          <Ionicons name="add" size={13} color={showCustom ? C.white : C.gray} />
          <Text style={[s.chipTxt, showCustom && s.chipTxtActive]}>Lainnya</Text>
        </TouchableOpacity>
      </View>
      {showCustom && (
        <View style={s.inputRow}>
          <TextInput style={[s.input, { flex: 1 }]} placeholder="Nama kasir..."
            value={customKasir} onChangeText={setCustomKasir} placeholderTextColor={C.gray} />
          <TouchableOpacity style={s.inputBtn} onPress={() => { if (customKasir.trim()) handleKasirPilih(customKasir.trim()); }}>
            <Text style={s.inputBtnTxt}>OK</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pilih Shift */}
      <Text style={s.sectionTitle}>SHIFT</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {['1', '2'].map(sh => (
          <TouchableOpacity
            key={sh}
            style={[s.shiftBtn, shiftAktif === sh && s.shiftBtnActive]}
            onPress={() => setSetting('shift_aktif', sh)}
          >
            <Ionicons name="time" size={20} color={shiftAktif === sh ? C.white : C.gray} />
            <Text style={[s.shiftBtnTxt, shiftAktif === sh && s.shiftBtnTxtActive]}>SHIFT {sh}</Text>
            <Text style={[s.shiftBtnSub, shiftAktif === sh && { color: '#FED7AA' }]}>
              {sh === '1' ? '08:00 – 15:00' : '15:00 – 22:00'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cabang */}
      <Text style={s.sectionTitle}>NAMA CABANG</Text>
      <TextInput
        style={s.input}
        value={cabang}
        onChangeText={v => setSetting('cabang', v)}
        placeholder="Nama cabang..."
        placeholderTextColor={C.gray}
      />
    </View>
  );
}

// ─── Karyawan Section ─────────────────────────────────────────────────────────
function KaryawanSection() {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<Karyawan | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formPeran, setFormPeran] = useState('washer');

  const { data: karyawan, isLoading } = useQuery({
    queryKey: ['karyawan'],
    queryFn: async () => (await blink.db.karyawan.list({ orderBy: { nama: 'asc' } })) as Karyawan[],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formNama.trim()) throw new Error('Masukkan nama karyawan');
      if (editItem) {
        await blink.db.karyawan.update(editItem.id, { nama: formNama.trim(), peran: formPeran });
      } else {
        await blink.db.karyawan.create({
          id: `kar_${Date.now()}`,
          nama: formNama.trim(),
          peran: formPeran,
          aktif: 1,
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['karyawan'] }); closeModal(); },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const toggleAktif = useMutation({
    mutationFn: async ({ id, aktif }: { id: string; aktif: number }) =>
      blink.db.karyawan.update(id, { aktif }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['karyawan'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => blink.db.karyawan.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['karyawan'] }),
  });

  const openAdd = () => { setEditItem(null); setFormNama(''); setFormPeran('washer'); setModalVisible(true); };
  const openEdit = (k: Karyawan) => { setEditItem(k); setFormNama(k.nama); setFormPeran(k.peran); setModalVisible(true); };
  const closeModal = () => setModalVisible(false);

  const byPeran = (peran: string) =>
    (karyawan || []).filter(k => k.peran === peran || k.peran === 'both');

  return (
    <View style={s.section}>
      <View style={s.sectionHeaderRow}>
        <Text style={s.sectionTitle}>DAFTAR KARYAWAN</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={18} color={C.white} />
          <Text style={s.addBtnTxt}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator color={C.orange} style={{ marginTop: 20 }} />}

      {['washer', 'tp', 'both'].map(peran => {
        const opt = PERAN_OPTIONS.find(o => o.value === peran)!;
        const list = (karyawan || []).filter(k => k.peran === peran);
        if (list.length === 0) return null;
        return (
          <View key={peran} style={{ marginBottom: 8 }}>
            <View style={[s.peranHeader, { backgroundColor: opt.color + '18' }]}>
              <Ionicons name={opt.icon as any} size={14} color={opt.color} />
              <Text style={[s.peranHeaderTxt, { color: opt.color }]}>{opt.label.toUpperCase()}</Text>
              <Text style={[s.peranCount, { color: opt.color }]}>{list.length} orang</Text>
            </View>
            {list.map(k => (
              <KaryawanRow
                key={k.id} k={k}
                onEdit={() => openEdit(k)}
                onToggle={() => toggleAktif.mutate({ id: k.id, aktif: Number(k.aktif) > 0 ? 0 : 1 })}
                onDelete={() => Alert.alert('Hapus', `Hapus ${k.nama}?`, [
                  { text: 'Batal', style: 'cancel' },
                  { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate(k.id) },
                ])}
              />
            ))}
          </View>
        );
      })}

      {(!karyawan || karyawan.length === 0) && !isLoading && (
        <View style={s.emptyBox}>
          <Ionicons name="people-outline" size={48} color={C.grayLight} />
          <Text style={s.emptyTxt}>Belum ada karyawan</Text>
          <Text style={s.emptyDesc}>Tap Tambah untuk menambahkan washer & TP</Text>
        </View>
      )}

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editItem ? 'Edit Karyawan' : 'Tambah Karyawan'}</Text>
              <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={22} color={C.gray} /></TouchableOpacity>
            </View>
            <Text style={s.fieldLabel}>Nama</Text>
            <TextInput style={s.input} value={formNama} onChangeText={setFormNama}
              placeholder="Nama lengkap..." placeholderTextColor={C.gray} autoFocus />
            <Text style={s.fieldLabel}>Peran</Text>
            <View style={{ gap: 8 }}>
              {PERAN_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value}
                  style={[s.peranBtn, formPeran === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '15' }]}
                  onPress={() => setFormPeran(opt.value)}
                >
                  <View style={[s.peranBtnDot, { backgroundColor: opt.color }]}>
                    <Ionicons name={opt.icon as any} size={14} color={C.white} />
                  </View>
                  <Text style={[s.peranBtnTxt, formPeran === opt.value && { color: opt.color, fontWeight: '700' }]}>
                    {opt.label}
                  </Text>
                  {formPeran === opt.value && <Ionicons name="checkmark-circle" size={18} color={opt.color} />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.saveBtn, saveMutation.isPending && s.saveBtnDis]}
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Text style={s.saveBtnTxt}>{saveMutation.isPending ? 'Menyimpan...' : 'SIMPAN'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function KaryawanRow({ k, onEdit, onToggle, onDelete }: { k: Karyawan; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const opt = PERAN_OPTIONS.find(o => o.value === k.peran) || PERAN_OPTIONS[0];
  const aktif = Number(k.aktif) > 0;
  return (
    <View style={[s.karyawanRow, !aktif && { opacity: 0.5 }]}>
      <View style={[s.karyawanAvatar, { backgroundColor: opt.color + '20' }]}>
        <Text style={[s.karyawanAvatarTxt, { color: opt.color }]}>
          {k.nama.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.karyawanNama}>{k.nama}</Text>
        <View style={[s.peranPill, { backgroundColor: opt.color + '15' }]}>
          <Text style={[s.peranPillTxt, { color: opt.color }]}>{opt.label}</Text>
        </View>
      </View>
      <TouchableOpacity style={s.rowAction} onPress={onToggle}>
        <Ionicons name={aktif ? 'toggle' : 'toggle-outline'} size={22} color={aktif ? C.green : C.gray} />
      </TouchableOpacity>
      <TouchableOpacity style={s.rowAction} onPress={onEdit}>
        <Ionicons name="create-outline" size={20} color={C.orange} />
      </TouchableOpacity>
      <TouchableOpacity style={s.rowAction} onPress={onDelete}>
        <Ionicons name="trash-outline" size={18} color={C.red} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Mobil Section ────────────────────────────────────────────────────────────
function MobilSection() {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<CarModel | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formKat, setFormKat] = useState('umum');
  const [search, setSearch] = useState('');

  const { data: cars, isLoading } = useQuery({
    queryKey: ['car_models'],
    queryFn: async () => (await blink.db.carModels.list({ orderBy: { nama: 'asc' } })) as CarModel[],
  });

  const filtered = (cars || []).filter(c =>
    !search || c.nama.toLowerCase().includes(search.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formNama.trim()) throw new Error('Masukkan nama mobil');
      if (editItem) {
        await blink.db.carModels.update(editItem.id, { nama: formNama.trim(), kategori: formKat });
      } else {
        await blink.db.carModels.create({
          id: `car_${Date.now()}`,
          nama: formNama.trim(),
          kategori: formKat,
          aktif: 1,
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['car_models'] }); closeModal(); },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const toggleAktif = useMutation({
    mutationFn: async ({ id, aktif }: { id: string; aktif: number }) =>
      blink.db.carModels.update(id, { aktif }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['car_models'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => blink.db.carModels.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['car_models'] }),
  });

  const openAdd = () => { setEditItem(null); setFormNama(''); setFormKat('umum'); setModalVisible(true); };
  const openEdit = (c: CarModel) => { setEditItem(c); setFormNama(c.nama); setFormKat(c.kategori); setModalVisible(true); };
  const closeModal = () => setModalVisible(false);

  return (
    <View style={s.section}>
      <View style={s.sectionHeaderRow}>
        <Text style={s.sectionTitle}>DAFTAR MOBIL</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={18} color={C.white} />
          <Text style={s.addBtnTxt}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {/* Kategori legend */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        {KAT_OPTIONS.map(o => (
          <View key={o.value} style={[s.katLegend, { backgroundColor: o.color + '18', borderColor: o.color + '40' }]}>
            <View style={[s.katDot, { backgroundColor: o.color }]} />
            <Text style={[s.katLegendTxt, { color: o.color }]}>{o.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={C.gray} />
        <TextInput style={s.searchInput} placeholder="Cari nama mobil..."
          value={search} onChangeText={setSearch} placeholderTextColor={C.gray} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.gray} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading && <ActivityIndicator color={C.orange} style={{ marginTop: 20 }} />}

      {filtered.map(c => {
        const opt = KAT_OPTIONS.find(o => o.value === c.kategori) || KAT_OPTIONS[0];
        const aktif = Number(c.aktif) > 0;
        return (
          <View key={c.id} style={[s.mobilRow, !aktif && { opacity: 0.45 }]}>
            <View style={[s.katDotLg, { backgroundColor: opt.color }]} />
            <Text style={[s.mobilNama, !aktif && { textDecorationLine: 'line-through', color: C.gray }]}>
              {c.nama}
            </Text>
            <View style={[s.katBadge, { backgroundColor: opt.color + '20' }]}>
              <Text style={[s.katBadgeTxt, { color: opt.color }]}>{opt.label}</Text>
            </View>
            <TouchableOpacity style={s.rowAction} onPress={() => toggleAktif.mutate({ id: c.id, aktif: aktif ? 0 : 1 })}>
              <Ionicons name={aktif ? 'toggle' : 'toggle-outline'} size={22} color={aktif ? C.green : C.gray} />
            </TouchableOpacity>
            <TouchableOpacity style={s.rowAction} onPress={() => openEdit(c)}>
              <Ionicons name="create-outline" size={18} color={C.orange} />
            </TouchableOpacity>
            <TouchableOpacity style={s.rowAction} onPress={() => Alert.alert('Hapus', `Hapus ${c.nama}?`, [
              { text: 'Batal', style: 'cancel' },
              { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate(c.id) },
            ])}>
              <Ionicons name="trash-outline" size={18} color={C.red} />
            </TouchableOpacity>
          </View>
        );
      })}

      {filtered.length === 0 && !isLoading && (
        <View style={s.emptyBox}>
          <Ionicons name="car-outline" size={48} color={C.grayLight} />
          <Text style={s.emptyTxt}>{search ? 'Tidak ditemukan' : 'Belum ada mobil'}</Text>
          <Text style={s.emptyDesc}>Tap Tambah untuk mendaftarkan model mobil</Text>
        </View>
      )}

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editItem ? 'Edit Mobil' : 'Tambah Mobil'}</Text>
              <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={22} color={C.gray} /></TouchableOpacity>
            </View>
            <Text style={s.fieldLabel}>Nama / Model Mobil</Text>
            <TextInput style={s.input} value={formNama} onChangeText={setFormNama}
              placeholder="Contoh: Avanza, Innova..." placeholderTextColor={C.gray} autoFocus />
            <Text style={s.fieldLabel}>Kategori Harga</Text>
            <View style={{ gap: 8 }}>
              {KAT_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value}
                  style={[s.peranBtn, formKat === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '12' }]}
                  onPress={() => setFormKat(opt.value)}
                >
                  <View style={[s.katDot, { backgroundColor: opt.color, width: 14, height: 14, borderRadius: 7 }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.peranBtnTxt, formKat === opt.value && { color: opt.color, fontWeight: '700' }]}>
                      {opt.label}
                    </Text>
                    <Text style={s.peranBtnSub}>
                      {opt.value === 'umum' ? 'Express 25K / Hidrolik 35K' :
                       opt.value === 'big'  ? 'Express 30K / Hidrolik 40K' :
                                              'Express 50K / Hidrolik 60K'}
                    </Text>
                  </View>
                  {formKat === opt.value && <Ionicons name="checkmark-circle" size={18} color={opt.color} />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.saveBtn, saveMutation.isPending && s.saveBtnDis]}
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Text style={s.saveBtnTxt}>{saveMutation.isPending ? 'Menyimpan...' : 'SIMPAN'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Pendapatan / Tarif Section ───────────────────────────────────────────────
function PendapatanSection({ settings, setSetting }: { settings: Record<string, string>; setSetting: (k: string, v: string) => void }) {
  const upahKeys = [
    { key: 'upah_washer_umum_express',    label: 'Umum – Express',    color: C.green  },
    { key: 'upah_washer_umum_hidrolik',   label: 'Umum – Hidrolik',   color: C.green  },
    { key: 'upah_washer_big_express',     label: 'Big – Express',     color: C.red    },
    { key: 'upah_washer_big_hidrolik',    label: 'Big – Hidrolik',    color: C.red    },
    { key: 'upah_washer_premium_express', label: 'Premium – Express', color: C.purple },
    { key: 'upah_washer_premium_hidrolik',label: 'Premium – Hidrolik',color: C.purple },
  ];

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>UPAH WASHER (REGULER)</Text>
      <Text style={s.sectionDesc}>Upah washer per kendaraan berdasar kategori & jenis cuci</Text>

      {upahKeys.map(u => {
        const rawVal = settings[u.key] || '0';
        return (
          <View key={u.key} style={s.upahRow}>
            <View style={[s.upahDot, { backgroundColor: u.color }]} />
            <Text style={s.upahLabel}>{u.label}</Text>
            <View style={s.upahInputWrap}>
              <Text style={s.upahRp}>Rp</Text>
              <TextInput
                style={s.upahInput}
                value={rawVal}
                onChangeText={v => setSetting(u.key, v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={C.gray}
              />
            </View>
          </View>
        );
      })}

      <View style={s.infoBox}>
        <Ionicons name="information-circle" size={16} color={C.orange} />
        <Text style={s.infoTxt}>
          Untuk tarif Poles, Premium & Paket — dihitung otomatis dari rumus Harga − KAS yang sudah terdaftar di sistem layanan.
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  loadingBox:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:        { backgroundColor: C.dark, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:   { color: C.white, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  headerSub:     { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  headerIcon:    { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },

  navBar:        { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  navTab:        { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  navTabActive:  { borderBottomColor: C.orange },
  navTabTxt:     { fontSize: 10, color: C.gray, fontWeight: '600' },
  navTabTxtActive:{ color: C.orange, fontWeight: '800' },

  scroll:        { flex: 1 },
  section:       { padding: 14 },
  sectionTitle:  { fontSize: 11, fontWeight: '800', color: C.slate, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginTop: 6 },
  sectionDesc:   { fontSize: 12, color: C.gray, marginBottom: 12, marginTop: -6 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },

  card:          { backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardLabel:     { fontSize: 10, fontWeight: '700', color: C.gray, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  cardValue:     { fontSize: 16, fontWeight: '800', color: C.dark },
  rowBetween:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  shiftBadge:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  shiftBadgeTxt: { fontSize: 12, fontWeight: '800' },
  logoutBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.grayLight },
  logoutTxt:     { fontSize: 13, color: C.red, fontWeight: '600' },

  shiftBtn:      { flex: 1, alignItems: 'center', backgroundColor: C.white, borderRadius: 12, paddingVertical: 14, borderWidth: 2, borderColor: C.border, gap: 4 },
  shiftBtnActive:{ borderColor: C.orange, backgroundColor: C.orange },
  shiftBtnTxt:   { fontSize: 15, fontWeight: '800', color: C.gray },
  shiftBtnTxtActive:{ color: C.white },
  shiftBtnSub:   { fontSize: 10, color: C.gray },

  chipWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.grayBg, borderWidth: 1, borderColor: C.border },
  chipActive:    { backgroundColor: C.orange, borderColor: C.orange },
  chipTxt:       { fontSize: 12, fontWeight: '600', color: C.gray },
  chipTxtActive: { color: C.white },

  input:         { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.dark, backgroundColor: C.white, marginBottom: 12 },
  inputRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  inputBtn:      { backgroundColor: C.orange, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  inputBtnTxt:   { color: C.white, fontWeight: '700', fontSize: 14 },
  fieldLabel:    { fontSize: 12, fontWeight: '700', color: C.slate, marginBottom: 6 },

  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.orange, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnTxt:     { color: C.white, fontSize: 13, fontWeight: '700' },
  saveBtn:       { backgroundColor: C.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnDis:    { backgroundColor: '#FCA97A' },
  saveBtnTxt:    { color: C.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  peranHeader:   { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 4 },
  peranHeaderTxt:{ fontSize: 11, fontWeight: '800', flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  peranCount:    { fontSize: 11, fontWeight: '600' },

  karyawanRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 10, padding: 10, marginBottom: 6, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  karyawanAvatar:{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  karyawanAvatarTxt:{ fontSize: 16, fontWeight: '800' },
  karyawanNama:  { fontSize: 14, fontWeight: '700', color: C.dark, marginBottom: 3 },
  peranPill:     { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  peranPillTxt:  { fontSize: 10, fontWeight: '700' },
  rowAction:     { padding: 6 },

  peranBtn:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.grayBg },
  peranBtnDot:   { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  peranBtnTxt:   { flex: 1, fontSize: 14, fontWeight: '600', color: C.slate },
  peranBtnSub:   { fontSize: 10, color: C.gray, marginTop: 1 },

  mobilRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 10, padding: 10, marginBottom: 5, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  mobilNama:     { flex: 1, fontSize: 13, fontWeight: '600', color: C.dark },
  katBadge:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  katBadgeTxt:   { fontSize: 10, fontWeight: '700' },
  katDot:        { width: 10, height: 10, borderRadius: 5 },
  katDotLg:      { width: 12, height: 12, borderRadius: 6 },

  katLegend:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  katLegendTxt:  { fontSize: 10, fontWeight: '700' },

  searchBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  searchInput:   { flex: 1, fontSize: 13, color: C.dark },

  upahRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 10, padding: 12, marginBottom: 6 },
  upahDot:       { width: 8, height: 8, borderRadius: 4 },
  upahLabel:     { flex: 1, fontSize: 13, color: C.slate, fontWeight: '500' },
  upahInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.grayBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  upahRp:        { fontSize: 11, color: C.gray, fontWeight: '600' },
  upahInput:     { fontSize: 14, fontWeight: '700', color: C.dark, minWidth: 70, textAlign: 'right' },

  infoBox:       { flexDirection: 'row', gap: 8, backgroundColor: C.orangeLight, borderRadius: 10, padding: 12, marginTop: 12 },
  infoTxt:       { flex: 1, fontSize: 11, color: C.orangeDark, lineHeight: 16 },

  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, maxHeight: '90%' },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle:    { fontSize: 17, fontWeight: '800', color: C.dark },

  emptyBox:      { alignItems: 'center', paddingVertical: 40 },
  emptyTxt:      { fontSize: 16, fontWeight: '700', color: C.gray, marginTop: 12 },
  emptyDesc:     { fontSize: 12, color: C.gray, marginTop: 4, textAlign: 'center' },
});
