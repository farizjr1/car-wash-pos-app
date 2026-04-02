import React, { useState } from 'react';
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
  orangeL:   '#FFF3E0',
  orangeD:   '#BF4800',
  bg:        '#F4F5F7',
  card:      '#FFFFFF',
  dark:      '#0F172A',
  slate:     '#334155',
  gray:      '#64748B',
  grayL:     '#E2E8F0',
  grayBg:    '#F8FAFC',
  green:     '#059669',
  greenBg:   '#ECFDF5',
  red:       '#DC2626',
  redBg:     '#FEF2F2',
  purple:    '#7C3AED',
  purpleBg:  '#F5F3FF',
  yellow:    '#D97706',
  yellowBg:  '#FFFBEB',
  border:    '#E2E8F0',
  white:     '#FFFFFF',
};

function fmt(n: number) { return n.toLocaleString('id-ID'); }

// ─── Types ──────────────────────────────────────────────────────────────────
interface Karyawan { id: string; nama: string; peran: string; aktif: number }
interface CarModel  { id: string; nama: string; kategori: string; aktif: number }
interface AppSetting { key: string; value: string }
interface KasirItem { id: string; nama: string; aktif: number }

const PERAN_OPTIONS = [
  { value: 'washer', label: 'Washer',       icon: 'water-outline',   color: C.green,  desc: 'Petugas pencuci kendaraan'     },
  { value: 'tp',     label: 'Team Polisher', icon: 'star-outline',   color: C.purple, desc: 'Petugas poles/finishing'        },
  { value: 'both',   label: 'Washer & TP',  icon: 'people-outline',  color: C.orange, desc: 'Merangkap washer dan polisher'  },
];

const KAT_OPTIONS = [
  { value: 'umum',    label: 'Umum / Medium', color: C.green,  desc: 'Express 25K · Hidrolik 35K'  },
  { value: 'big',     label: 'Besar / Big',   color: C.red,    desc: 'Express 30K · Hidrolik 40K'  },
  { value: 'premium', label: 'Premium',       color: C.purple, desc: 'Express 50K · Hidrolik 60K'  },
];

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState<'kasir' | 'karyawan' | 'mobil' | 'pendapatan'>('kasir');

  const { data: settings, isLoading: loadSettings } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const res = await blink.db.appSettings.list();
      const map: Record<string, string> = {};
      (res as AppSetting[]).forEach(s => { map[s.key] = s.value; });
      return map;
    },
    staleTime: 1000 * 10,
  });

  const setSetting = async (key: string, value: string) => {
    try {
      await blink.db.appSettings.upsert({ key, value });
      await qc.invalidateQueries({ queryKey: ['app_settings'] });
    } catch (e) {
      console.log('setSetting error', e);
    }
  };

  const kasirAktif = settings?.kasir_aktif || '';
  const shiftAktif = settings?.shift_aktif || '1';
  const cabang     = settings?.cabang || '';

  const NAV_TABS = [
    { key: 'kasir',      label: 'Kasir',    icon: 'person-circle-outline'   },
    { key: 'karyawan',   label: 'Karyawan', icon: 'people-outline'           },
    { key: 'mobil',      label: 'Mobil',    icon: 'car-outline'              },
    { key: 'pendapatan', label: 'Tarif',    icon: 'pricetag-outline'         },
  ] as const;

  if (loadSettings) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>PENGATURAN</Text>
            <Text style={s.headerSub}>{cabang || 'Orange Carwash'}</Text>
          </View>
          <View style={s.headerIcon}>
            <Ionicons name="settings-outline" size={20} color={C.white} />
          </View>
        </View>
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={C.orange} />
          <Text style={s.loadingTxt}>Memuat pengaturan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>PENGATURAN</Text>
          <Text style={s.headerSub}>{cabang || 'Orange Carwash'}</Text>
        </View>
        <View style={{ gap: 4, alignItems: 'flex-end' }}>
          {kasirAktif ? (
            <View style={s.kasirBadge}>
              <Ionicons name="person" size={10} color={C.white} />
              <Text style={s.kasirBadgeTxt}>{kasirAktif}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[s.shiftPill, { backgroundColor: shiftAktif === '1' ? '#F97316' : '#7C3AED' }]}
            onPress={() => setSetting('shift_aktif', shiftAktif === '1' ? '2' : '1')}
          >
            <Text style={s.shiftPillTxt}>SHIFT {shiftAktif}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Nav Tabs ── */}
      <View style={s.navBar}>
        {NAV_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.navTab, activeSection === tab.key && s.navTabActive]}
            onPress={() => setActiveSection(tab.key)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeSection === tab.key ? C.orange : C.gray}
            />
            <Text style={[s.navTabTxt, activeSection === tab.key && s.navTabTxtActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content ── */}
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {activeSection === 'kasir'      && <KasirSection settings={settings || {}} setSetting={setSetting} />}
        {activeSection === 'karyawan'   && <KaryawanSection />}
        {activeSection === 'mobil'      && <MobilSection />}
        {activeSection === 'pendapatan' && <PendapatanSection settings={settings || {}} setSetting={setSetting} />}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Kasir Section ────────────────────────────────────────────────────────────
function KasirSection({
  settings, setSetting,
}: {
  settings: Record<string, string>;
  setSetting: (k: string, v: string) => void;
}) {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<KasirItem | null>(null);
  const [formNama, setFormNama] = useState('');

  const kasirAktif = settings.kasir_aktif || '';
  const shiftAktif = settings.shift_aktif || '1';
  const cabang     = settings.cabang || '';

  // Kasir dikelola di tabel karyawan dengan peran 'kasir'
  const { data: kasirList, isLoading } = useQuery({
    queryKey: ['kasir_list'],
    queryFn: async () => {
      const res = await blink.db.karyawan.list({ where: { peran: 'kasir' }, orderBy: { nama: 'asc' } });
      return res as KasirItem[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formNama.trim()) throw new Error('Masukkan nama kasir');
      if (editItem) {
        await blink.db.karyawan.update(editItem.id, { nama: formNama.trim() });
      } else {
        await blink.db.karyawan.create({
          id: `kas_${Date.now()}`,
          nama: formNama.trim(),
          peran: 'kasir',
          aktif: 1,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kasir_list'] });
      setModalVisible(false);
      setFormNama('');
      setEditItem(null);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => blink.db.karyawan.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kasir_list'] }),
  });

  const openAdd  = () => { setEditItem(null); setFormNama(''); setModalVisible(true); };
  const openEdit = (k: KasirItem) => { setEditItem(k); setFormNama(k.nama); setModalVisible(true); };

  return (
    <View style={s.section}>
      {/* Status Card */}
      <View style={[s.statusCard, { borderLeftColor: kasirAktif ? C.green : C.grayL }]}>
        <View style={s.statusCardTop}>
          <View style={[s.statusIcon, { backgroundColor: kasirAktif ? C.greenBg : C.grayBg }]}>
            <Ionicons name="person" size={18} color={kasirAktif ? C.green : C.gray} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.statusLabel}>STATUS KASIR</Text>
            {kasirAktif ? (
              <Text style={[s.statusVal, { color: C.green }]}>✓ {kasirAktif}</Text>
            ) : (
              <Text style={[s.statusVal, { color: C.gray }]}>Belum login</Text>
            )}
          </View>
          <View style={[s.shiftBadge, { backgroundColor: shiftAktif === '1' ? C.orangeL : C.purpleBg }]}>
            <Text style={[s.shiftBadgeTxt, { color: shiftAktif === '1' ? C.orange : C.purple }]}>
              SHIFT {shiftAktif}
            </Text>
          </View>
        </View>
        {kasirAktif ? (
          <TouchableOpacity style={s.logoutBtn} onPress={() => setSetting('kasir_aktif', '')}>
            <Ionicons name="log-out-outline" size={15} color={C.red} />
            <Text style={s.logoutTxt}>Logout Kasir</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Daftar Kasir */}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>DAFTAR KASIR</Text>
        <TouchableOpacity style={s.addPillBtn} onPress={openAdd}>
          <Ionicons name="add" size={15} color={C.white} />
          <Text style={s.addPillTxt}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator color={C.orange} style={{ marginVertical: 16 }} />}

      {(!kasirList || kasirList.length === 0) && !isLoading ? (
        <View style={s.emptyBox}>
          <Ionicons name="person-outline" size={40} color={C.grayL} />
          <Text style={s.emptyTxt}>Belum ada kasir</Text>
          <Text style={s.emptyDesc}>Tap Tambah untuk mendaftarkan nama kasir</Text>
        </View>
      ) : (
        <View style={{ gap: 6, marginBottom: 14 }}>
          {(kasirList || []).map(k => (
            <TouchableOpacity
              key={k.id}
              style={[s.kasirRow, kasirAktif === k.nama && s.kasirRowActive]}
              onPress={() => setSetting('kasir_aktif', kasirAktif === k.nama ? '' : k.nama)}
              activeOpacity={0.75}
            >
              <View style={[s.kasirAvatar, { backgroundColor: kasirAktif === k.nama ? C.orange : C.orangeL }]}>
                <Text style={[s.kasirAvatarTxt, { color: kasirAktif === k.nama ? C.white : C.orange }]}>
                  {k.nama.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[s.kasirNama, kasirAktif === k.nama && { color: C.orange, fontWeight: '800' }]}>
                {k.nama}
              </Text>
              {kasirAktif === k.nama && (
                <View style={s.loginPill}>
                  <Ionicons name="checkmark-circle" size={12} color={C.white} />
                  <Text style={s.loginPillTxt}>Login</Text>
                </View>
              )}
              <TouchableOpacity style={s.rowAction} onPress={() => openEdit(k)}>
                <Ionicons name="create-outline" size={18} color={C.orange} />
              </TouchableOpacity>
              <TouchableOpacity style={s.rowAction} onPress={() =>
                Alert.alert('Hapus Kasir', `Hapus "${k.nama}"?`, [
                  { text: 'Batal', style: 'cancel' },
                  { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate(k.id) },
                ])
              }>
                <Ionicons name="trash-outline" size={17} color={C.red} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Shift */}
      <Text style={s.sectionTitle}>PILIH SHIFT</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {['1', '2'].map(sh => {
          const isActive = shiftAktif === sh;
          return (
            <TouchableOpacity
              key={sh}
              style={[s.shiftBtn, isActive && s.shiftBtnActive]}
              onPress={() => {
                setSetting('shift_aktif', sh);
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="time-outline" size={22}
                color={isActive ? C.white : C.gray} />
              <Text style={[s.shiftBtnTxt, isActive && { color: C.white }]}>SHIFT {sh}</Text>
              <Text style={[s.shiftBtnSub, isActive && { color: 'rgba(255,255,255,0.75)' }]}>
                {sh === '1' ? '08:00 – 15:00' : '15:00 – 22:00'}
              </Text>
              {isActive && (
                <Ionicons name="checkmark-circle" size={18} color={C.white} style={{ marginTop: 2 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Cabang */}
      <Text style={s.sectionTitle}>NAMA CABANG</Text>
      <View style={s.inputWrap}>
        <Ionicons name="business-outline" size={16} color={C.gray} />
        <TextInput
          style={s.inputInner}
          value={cabang}
          onChangeText={v => setSetting('cabang', v)}
          placeholder="Nama cabang..."
          placeholderTextColor={C.gray}
        />
      </View>

      {/* Modal Tambah/Edit Kasir */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editItem ? 'Edit Kasir' : 'Tambah Kasir'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={C.gray} />
              </TouchableOpacity>
            </View>
            <Text style={s.fieldLabel}>Nama Kasir</Text>
            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={16} color={C.gray} />
              <TextInput
                style={s.inputInner}
                value={formNama}
                onChangeText={setFormNama}
                placeholder="Nama lengkap kasir..."
                placeholderTextColor={C.gray}
                autoFocus
              />
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

// ─── Karyawan Section ─────────────────────────────────────────────────────────
function KaryawanSection() {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<Karyawan | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formPeran, setFormPeran] = useState('washer');

  const { data: karyawan, isLoading } = useQuery({
    queryKey: ['karyawan'],
    queryFn: async () => {
      const res = await blink.db.karyawan.list({ orderBy: { nama: 'asc' } });
      // Filter: hanya tampilkan washer, tp, both (bukan kasir)
      return (res as Karyawan[]).filter(k => k.peran !== 'kasir');
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['karyawan'] });
      setModalVisible(false);
    },
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

  const openAdd  = () => { setEditItem(null); setFormNama(''); setFormPeran('washer'); setModalVisible(true); };
  const openEdit = (k: Karyawan) => { setEditItem(k); setFormNama(k.nama); setFormPeran(k.peran); setModalVisible(true); };

  return (
    <View style={s.section}>
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>DAFTAR KARYAWAN</Text>
        <TouchableOpacity style={s.addPillBtn} onPress={openAdd}>
          <Ionicons name="add" size={15} color={C.white} />
          <Text style={s.addPillTxt}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator color={C.orange} style={{ marginVertical: 16 }} />}

      {/* Info kosong */}
      {(!karyawan || karyawan.length === 0) && !isLoading && (
        <View style={s.emptyBox}>
          <Ionicons name="people-outline" size={48} color={C.grayL} />
          <Text style={s.emptyTxt}>Belum ada karyawan</Text>
          <Text style={s.emptyDesc}>Tap Tambah untuk mendaftarkan washer & TP</Text>
        </View>
      )}

      {/* Grup per peran */}
      {PERAN_OPTIONS.map(opt => {
        const list = (karyawan || []).filter(k => k.peran === opt.value);
        if (list.length === 0) return null;
        return (
          <View key={opt.value} style={{ marginBottom: 10 }}>
            <View style={[s.peranGroupHeader, { backgroundColor: opt.color + '15' }]}>
              <Ionicons name={opt.icon as any} size={14} color={opt.color} />
              <Text style={[s.peranGroupTxt, { color: opt.color }]}>{opt.label.toUpperCase()}</Text>
              <View style={[s.peranCountPill, { backgroundColor: opt.color }]}>
                <Text style={s.peranCountTxt}>{list.length}</Text>
              </View>
            </View>
            {list.map(k => (
              <KaryawanRow
                key={k.id} k={k} opt={opt}
                onEdit={() => openEdit(k)}
                onToggle={() => toggleAktif.mutate({ id: k.id, aktif: Number(k.aktif) > 0 ? 0 : 1 })}
                onDelete={() => Alert.alert('Hapus', `Hapus "${k.nama}"?`, [
                  { text: 'Batal', style: 'cancel' },
                  { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate(k.id) },
                ])}
              />
            ))}
          </View>
        );
      })}

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editItem ? 'Edit Karyawan' : 'Tambah Karyawan'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={C.gray} />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>Nama Lengkap</Text>
            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={16} color={C.gray} />
              <TextInput
                style={s.inputInner}
                value={formNama}
                onChangeText={setFormNama}
                placeholder="Nama karyawan..."
                placeholderTextColor={C.gray}
                autoFocus
              />
            </View>

            <Text style={s.fieldLabel}>Peran</Text>
            <View style={{ gap: 8, marginBottom: 6 }}>
              {PERAN_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.peranBtn, formPeran === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '10' }]}
                  onPress={() => setFormPeran(opt.value)}
                  activeOpacity={0.8}
                >
                  <View style={[s.peranBtnIcon, { backgroundColor: opt.color }]}>
                    <Ionicons name={opt.icon as any} size={15} color={C.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.peranBtnTxt, formPeran === opt.value && { color: opt.color, fontWeight: '800' }]}>
                      {opt.label}
                    </Text>
                    <Text style={s.peranBtnDesc}>{opt.desc}</Text>
                  </View>
                  {formPeran === opt.value && <Ionicons name="checkmark-circle" size={20} color={opt.color} />}
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

function KaryawanRow({
  k, opt, onEdit, onToggle, onDelete,
}: {
  k: Karyawan;
  opt: typeof PERAN_OPTIONS[number];
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const aktif = Number(k.aktif) > 0;
  return (
    <View style={[s.karyawanRow, !aktif && { opacity: 0.5 }]}>
      <View style={[s.karyawanAvatar, { backgroundColor: opt.color + '20' }]}>
        <Text style={[s.karyawanAvatarTxt, { color: opt.color }]}>
          {k.nama.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.karyawanNama, !aktif && { textDecorationLine: 'line-through', color: C.gray }]}>
          {k.nama}
        </Text>
        <View style={[s.peranPill, { backgroundColor: opt.color + '15' }]}>
          <Text style={[s.peranPillTxt, { color: opt.color }]}>{opt.label}</Text>
        </View>
      </View>
      <TouchableOpacity style={s.rowAction} onPress={onToggle}>
        <Ionicons
          name={aktif ? 'toggle' : 'toggle-outline'}
          size={26} color={aktif ? C.green : C.grayL}
        />
      </TouchableOpacity>
      <TouchableOpacity style={s.rowAction} onPress={onEdit}>
        <Ionicons name="create-outline" size={19} color={C.orange} />
      </TouchableOpacity>
      <TouchableOpacity style={s.rowAction} onPress={onDelete}>
        <Ionicons name="trash-outline" size={17} color={C.red} />
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
  const [formKat,  setFormKat]  = useState('umum');
  const [search,   setSearch]   = useState('');
  const [filterKat, setFilterKat] = useState<string | null>(null);

  const { data: cars, isLoading } = useQuery({
    queryKey: ['car_models'],
    queryFn: async () => (await blink.db.carModels.list({ orderBy: { nama: 'asc' } })) as CarModel[],
  });

  const filtered = (cars || []).filter(c => {
    const matchSearch = !search || c.nama.toLowerCase().includes(search.toLowerCase());
    const matchKat    = !filterKat || c.kategori === filterKat;
    return matchSearch && matchKat;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formNama.trim()) throw new Error('Masukkan nama mobil');
      if (editItem) {
        await blink.db.carModels.update(editItem.id, { nama: formNama.trim(), kategori: formKat });
      } else {
        await blink.db.carModels.create({
          id:       `car_${Date.now()}`,
          nama:     formNama.trim(),
          kategori: formKat,
          aktif:    1,
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['car_models'] }); setModalVisible(false); },
    onError:   (e: any) => Alert.alert('Error', e.message),
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

  const openAdd  = () => { setEditItem(null); setFormNama(''); setFormKat('umum'); setModalVisible(true); };
  const openEdit = (c: CarModel) => { setEditItem(c); setFormNama(c.nama); setFormKat(c.kategori); setModalVisible(true); };

  // Count per kategori
  const countByKat = (kat: string) => (cars || []).filter(c => c.kategori === kat).length;

  return (
    <View style={s.section}>
      {/* Header */}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>DAFTAR MOBIL</Text>
        <TouchableOpacity style={s.addPillBtn} onPress={openAdd}>
          <Ionicons name="add" size={15} color={C.white} />
          <Text style={s.addPillTxt}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {/* Kategori Filter Chips */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <TouchableOpacity
          style={[s.filterChip, !filterKat && s.filterChipActive]}
          onPress={() => setFilterKat(null)}
        >
          <Text style={[s.filterChipTxt, !filterKat && s.filterChipTxtActive]}>
            Semua ({cars?.length || 0})
          </Text>
        </TouchableOpacity>
        {KAT_OPTIONS.map(o => (
          <TouchableOpacity
            key={o.value}
            style={[s.filterChip, filterKat === o.value && { borderColor: o.color, backgroundColor: o.color + '15' }]}
            onPress={() => setFilterKat(filterKat === o.value ? null : o.value)}
          >
            <View style={[s.filterDot, { backgroundColor: o.color }]} />
            <Text style={[s.filterChipTxt, filterKat === o.value && { color: o.color, fontWeight: '700' }]}>
              {o.label} ({countByKat(o.value)})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={C.gray} />
        <TextInput
          style={s.searchInput}
          placeholder="Cari nama mobil..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={C.gray}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.gray} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading && <ActivityIndicator color={C.orange} style={{ marginVertical: 16 }} />}

      {filtered.length === 0 && !isLoading && (
        <View style={s.emptyBox}>
          <Ionicons name="car-outline" size={48} color={C.grayL} />
          <Text style={s.emptyTxt}>{search || filterKat ? 'Tidak ditemukan' : 'Belum ada mobil'}</Text>
          <Text style={s.emptyDesc}>Tap Tambah untuk mendaftarkan model mobil baru</Text>
        </View>
      )}

      {filtered.map(c => {
        const opt   = KAT_OPTIONS.find(o => o.value === c.kategori) || KAT_OPTIONS[0];
        const aktif = Number(c.aktif) > 0;
        return (
          <View key={c.id} style={[s.mobilRow, !aktif && { opacity: 0.45 }]}>
            <View style={[s.mobilKatDot, { backgroundColor: opt.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.mobilNama, !aktif && { textDecorationLine: 'line-through', color: C.gray }]}>
                {c.nama}
              </Text>
              <View style={[s.katBadge, { backgroundColor: opt.color + '20' }]}>
                <Text style={[s.katBadgeTxt, { color: opt.color }]}>{opt.label}</Text>
              </View>
            </View>
            <TouchableOpacity style={s.rowAction} onPress={() => toggleAktif.mutate({ id: c.id, aktif: aktif ? 0 : 1 })}>
              <Ionicons name={aktif ? 'toggle' : 'toggle-outline'} size={26} color={aktif ? C.green : C.grayL} />
            </TouchableOpacity>
            <TouchableOpacity style={s.rowAction} onPress={() => openEdit(c)}>
              <Ionicons name="create-outline" size={19} color={C.orange} />
            </TouchableOpacity>
            <TouchableOpacity style={s.rowAction} onPress={() =>
              Alert.alert('Hapus', `Hapus "${c.nama}"?`, [
                { text: 'Batal', style: 'cancel' },
                { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate(c.id) },
              ])
            }>
              <Ionicons name="trash-outline" size={17} color={C.red} />
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editItem ? 'Edit Mobil' : 'Tambah Mobil'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={C.gray} />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>Nama / Model Mobil</Text>
            <View style={s.inputWrap}>
              <Ionicons name="car-outline" size={16} color={C.gray} />
              <TextInput
                style={s.inputInner}
                value={formNama}
                onChangeText={setFormNama}
                placeholder="Contoh: Avanza, Innova, X-Trail..."
                placeholderTextColor={C.gray}
                autoFocus
              />
            </View>

            <Text style={s.fieldLabel}>Kategori Harga</Text>
            <View style={{ gap: 8, marginBottom: 6 }}>
              {KAT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.peranBtn, formKat === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '10' }]}
                  onPress={() => setFormKat(opt.value)}
                  activeOpacity={0.8}
                >
                  <View style={[s.mobilKatDot, { backgroundColor: opt.color, width: 16, height: 16, borderRadius: 8 }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.peranBtnTxt, formKat === opt.value && { color: opt.color, fontWeight: '800' }]}>
                      {opt.label}
                    </Text>
                    <Text style={s.peranBtnDesc}>{opt.desc}</Text>
                  </View>
                  {formKat === opt.value && <Ionicons name="checkmark-circle" size={20} color={opt.color} />}
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
function PendapatanSection({
  settings, setSetting,
}: {
  settings: Record<string, string>;
  setSetting: (k: string, v: string) => void;
}) {
  const upahGroups = [
    {
      label: 'UMUM / MEDIUM',
      color: C.green,
      items: [
        { key: 'upah_washer_umum_express',  label: 'Express'  },
        { key: 'upah_washer_umum_hidrolik', label: 'Hidrolik' },
      ],
    },
    {
      label: 'BESAR / BIG',
      color: C.red,
      items: [
        { key: 'upah_washer_big_express',   label: 'Express'  },
        { key: 'upah_washer_big_hidrolik',  label: 'Hidrolik' },
      ],
    },
    {
      label: 'PREMIUM',
      color: C.purple,
      items: [
        { key: 'upah_washer_premium_express',  label: 'Express'  },
        { key: 'upah_washer_premium_hidrolik', label: 'Hidrolik' },
      ],
    },
  ];

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>UPAH WASHER (REGULER)</Text>
      <Text style={s.sectionDesc}>
        Upah per kendaraan berdasarkan kategori dan jenis cuci
      </Text>

      {upahGroups.map(group => (
        <View key={group.label} style={[s.upahCard, { borderLeftColor: group.color }]}>
          <Text style={[s.upahCardTitle, { color: group.color }]}>{group.label}</Text>
          {group.items.map(u => (
            <View key={u.key} style={s.upahRow}>
              <Text style={s.upahLabel}>{u.label}</Text>
              <View style={s.upahInputWrap}>
                <Text style={s.upahRp}>Rp</Text>
                <TextInput
                  style={s.upahInput}
                  value={settings[u.key] || '0'}
                  onChangeText={v => setSetting(u.key, v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={C.gray}
                />
              </View>
            </View>
          ))}
        </View>
      ))}

      <View style={s.infoBox}>
        <Ionicons name="information-circle-outline" size={18} color={C.orange} />
        <Text style={s.infoTxt}>
          Tarif Poles, Premium & Paket dihitung otomatis dari selisih Harga − KAS yang terdaftar di sistem.
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  loadingBox:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingTxt:    { fontSize: 14, color: C.gray },

  // Header
  header:        { backgroundColor: C.dark, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:   { color: C.white, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  headerSub:     { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  headerIcon:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  kasirBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.green, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  kasirBadgeTxt: { fontSize: 10, fontWeight: '700', color: C.white },
  shiftPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  shiftPillTxt:  { fontSize: 10, fontWeight: '800', color: C.white },

  // Nav
  navBar:        { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1.5, borderBottomColor: C.border },
  navTab:        { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  navTabActive:  { borderBottomColor: C.orange },
  navTabTxt:     { fontSize: 10, color: C.gray, fontWeight: '600' },
  navTabTxtActive:{ color: C.orange, fontWeight: '800' },

  scroll:        { flex: 1 },
  section:       { padding: 16 },
  sectionTitle:  { fontSize: 10, fontWeight: '800', color: C.slate, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  sectionDesc:   { fontSize: 12, color: C.gray, marginBottom: 14, marginTop: -4 },
  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },

  // Status Card
  statusCard:    { backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 16, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statusCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusLabel:   { fontSize: 10, fontWeight: '700', color: C.gray, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  statusVal:     { fontSize: 18, fontWeight: '800', color: C.dark },
  shiftBadge:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  shiftBadgeTxt: { fontSize: 11, fontWeight: '800' },
  logoutBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  logoutTxt:     { fontSize: 13, color: C.red, fontWeight: '600' },

  // Kasir Row
  kasirRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: C.border },
  kasirRowActive: { borderColor: C.orange, backgroundColor: C.orangeL },
  kasirAvatar:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  kasirAvatarTxt: { fontSize: 16, fontWeight: '800' },
  kasirNama:      { flex: 1, fontSize: 14, fontWeight: '600', color: C.slate },
  loginPill:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.orange, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  loginPillTxt:   { fontSize: 10, fontWeight: '700', color: C.white },

  // Shift
  shiftBtn:        { flex: 1, alignItems: 'center', backgroundColor: C.white, borderRadius: 14, paddingVertical: 16, borderWidth: 2, borderColor: C.border, gap: 4 },
  shiftBtnActive:  { borderColor: C.orange, backgroundColor: C.orange },
  shiftBtnTxt:     { fontSize: 15, fontWeight: '800', color: C.gray },
  shiftBtnSub:     { fontSize: 10, color: C.gray },

  // Input
  inputWrap:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1.5, borderColor: C.border, marginBottom: 12 },
  inputInner:    { flex: 1, fontSize: 14, color: C.dark },

  addPillBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.orange, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addPillTxt:    { color: C.white, fontSize: 12, fontWeight: '700' },
  saveBtn:       { backgroundColor: C.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  saveBtnDis:    { backgroundColor: '#FCA97A' },
  saveBtnTxt:    { color: C.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  rowAction:     { padding: 7 },
  fieldLabel:    { fontSize: 12, fontWeight: '700', color: C.slate, marginBottom: 6 },

  // Karyawan
  peranGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginBottom: 5 },
  peranGroupTxt:    { flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  peranCountPill:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  peranCountTxt:    { fontSize: 10, fontWeight: '800', color: C.white },
  karyawanRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 10, padding: 10, marginBottom: 5, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  karyawanAvatar:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  karyawanAvatarTxt:{ fontSize: 16, fontWeight: '800' },
  karyawanNama:     { fontSize: 14, fontWeight: '700', color: C.dark, marginBottom: 3 },
  peranPill:        { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  peranPillTxt:     { fontSize: 10, fontWeight: '700' },
  peranBtn:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.grayBg },
  peranBtnIcon:     { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  peranBtnTxt:      { fontSize: 13, fontWeight: '600', color: C.slate },
  peranBtnDesc:     { fontSize: 10, color: C.gray, marginTop: 1 },

  // Mobil
  filterChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  filterChipActive: { backgroundColor: C.dark, borderColor: C.dark },
  filterChipTxt:    { fontSize: 11, fontWeight: '600', color: C.gray },
  filterChipTxtActive: { color: C.white, fontWeight: '800' },
  filterDot:        { width: 7, height: 7, borderRadius: 3.5 },
  searchBox:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1.5, borderColor: C.border, marginBottom: 10 },
  searchInput:      { flex: 1, fontSize: 13, color: C.dark },
  mobilRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 10, padding: 10, marginBottom: 5, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  mobilKatDot:      { width: 12, height: 12, borderRadius: 6 },
  mobilNama:        { fontSize: 13, fontWeight: '600', color: C.dark, marginBottom: 3 },
  katBadge:         { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  katBadgeTxt:      { fontSize: 9, fontWeight: '700' },

  // Upah
  upahCard:      { backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  upahCardTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 10 },
  upahRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border },
  upahLabel:     { flex: 1, fontSize: 13, color: C.slate, fontWeight: '500' },
  upahInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.grayBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
  upahRp:        { fontSize: 11, color: C.gray, fontWeight: '600' },
  upahInput:     { fontSize: 14, fontWeight: '700', color: C.dark, minWidth: 75, textAlign: 'right' },
  infoBox:       { flexDirection: 'row', gap: 10, backgroundColor: C.orangeL, borderRadius: 12, padding: 14, marginTop: 8 },
  infoTxt:       { flex: 1, fontSize: 12, color: C.orangeD, lineHeight: 18 },

  // Empty
  emptyBox:      { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTxt:      { fontSize: 16, fontWeight: '700', color: C.gray },
  emptyDesc:     { fontSize: 12, color: C.gray, textAlign: 'center' },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 38 : 22, maxHeight: '92%' },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle:    { fontSize: 17, fontWeight: '800', color: C.dark },
});
