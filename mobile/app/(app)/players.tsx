import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../src/services/api';
import { User, Injury } from '../../src/types';
import PickerModal from '../../src/components/PickerModal';

const POSITIONS = [
  'Gardienne', 'Défenseure centrale', 'Latérale droite', 'Latérale gauche',
  'Milieu défensif', 'Milieu central', 'Milieu offensif',
  'Ailière droite', 'Ailière gauche', 'Attaquante', 'Avant-centre',
];

function getAge(birthDate?: string | null) {
  if (!birthDate) return null;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export default function PlayersScreen() {
  const [players,   setPlayers]   = useState<User[]>([]);
  const [injuries,  setInjuries]  = useState<Injury[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [posFilter, setPosFilter] = useState('');

  const [showAdd,  setShowAdd]  = useState(false);
  const [editPlayer, setEditPlayer] = useState<User | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/users'), api.get('/injuries')])
      .then(([u, inj]) => {
        setPlayers(u.data.filter((p: User) => p.role === 'PLAYER'));
        setInjuries(inj.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const activeInjuries = useMemo(
    () => injuries.filter(i => i.status === 'ACTIVE'),
    [injuries]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return players.filter(p => {
      const matchName = !q ||
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q);
      const matchPos = !posFilter || p.position === posFilter;
      return matchName && matchPos;
    });
  }, [players, search, posFilter]);

  const presentPositions = useMemo(
    () => POSITIONS.filter(pos => players.some(p => p.position === pos)),
    [players]
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">

      {/* Header */}
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Joueuses</Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              Effectif · {players.length} joueuse{players.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowAdd(true)} className="bg-blue-600 px-3 py-2 rounded-xl mt-1">
            <Text className="text-white text-sm font-semibold">+ Ajouter</Text>
          </TouchableOpacity>
        </View>

        {/* Recherche */}
        <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 mt-3" style={{ gap: 8 }}>
          <Text className="text-gray-400">🔍</Text>
          <TextInput
            className="flex-1 py-2.5 text-gray-900 text-sm"
            placeholder="Rechercher une joueuse…"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Filtres postes */}
      {presentPositions.length > 0 && (
        <View className="mb-2">
          <FlatList
            horizontal
            data={['', ...presentPositions]}
            keyExtractor={item => item || '_all'}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setPosFilter(item)}
                className={`px-3 py-1.5 rounded-full border ${
                  posFilter === item ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                }`}
              >
                <Text className={`text-xs font-medium ${posFilter === item ? 'text-white' : 'text-gray-600'}`}>
                  {item || 'Tous les postes'}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Liste */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-4xl mb-3">👥</Text>
              <Text className="text-gray-400 text-sm text-center">
                {search || posFilter
                  ? 'Aucun résultat pour ce filtre.'
                  : "Aucune joueuse dans l'effectif."}
              </Text>
            </View>
          }
          renderItem={({ item: p }) => {
            const playerInjuries = activeInjuries.filter(i => i.userId === p.id);
            const age     = getAge(p.birthDate);
            const initials = `${p.firstName[0]}${p.lastName[0]}`.toUpperCase();
            const injured  = playerInjuries.length > 0;

            return (
              <View className={`bg-white rounded-2xl border px-4 py-3 ${injured ? 'border-red-200' : 'border-gray-200'}`}>
                <View className="flex-row items-center" style={{ gap: 12 }}>

                  {/* Avatar initiales */}
                  <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
                    <Text className="text-blue-700 font-bold text-base">{initials}</Text>
                  </View>

                  {/* Infos */}
                  <View className="flex-1 min-w-0">
                    <Text className="font-semibold text-gray-900">{p.firstName} {p.lastName}</Text>
                    <View className="flex-row items-center mt-0.5" style={{ gap: 8 }}>
                      {p.position && <Text className="text-xs text-gray-500" numberOfLines={1}>{p.position}</Text>}
                      {age != null && <Text className="text-xs text-gray-400">{age} ans</Text>}
                    </View>
                    {p.email && <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>{p.email}</Text>}
                  </View>

                  {/* Badge + modifier */}
                  <View className="items-end" style={{ gap: 4 }}>
                    <View className={`px-2.5 py-1 rounded-full ${injured ? 'bg-red-100' : 'bg-green-100'}`}>
                      <Text className={`text-xs font-semibold ${injured ? 'text-red-700' : 'text-green-700'}`}>
                        {injured ? 'Blessée' : 'Fit'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setEditPlayer(p)}>
                      <Text className="text-xs text-blue-600">Modifier</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Détail blessures */}
                {injured && (
                  <View className="mt-3 pt-3 border-t border-gray-100" style={{ gap: 2 }}>
                    {playerInjuries.map(inj => (
                      <Text key={inj.id} className="text-xs text-red-600">
                        ⚠️ {inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <AddPlayerModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={() => { setShowAdd(false); load(); }}
      />
      <EditPlayerModal
        player={editPlayer}
        onClose={() => setEditPlayer(null)}
        onSaved={() => { setEditPlayer(null); load(); }}
      />
    </SafeAreaView>
  );
}

/* ─── Helpers UI ─────────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text className="text-xs font-semibold text-gray-500 uppercase">{label}</Text>
      {children}
    </View>
  );
}

function SheetModal({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: '90%' }}>
          <View className="w-10 h-1 bg-gray-200 rounded-full self-center mt-3 mb-1" />
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-gray-100">
            <Text className="text-lg font-bold text-gray-900">{title}</Text>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
              <Text className="text-gray-500 text-sm">✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── AddPlayerModal ─────────────────────────────────────────────────────── */

function AddPlayerModal({ visible, onClose, onAdded }: {
  visible: boolean; onClose: () => void; onAdded: () => void;
}) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', position: '', birthDate: '' });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [showPos, setShowPos] = useState(false);

  const set = (f: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [f]: v }));
  const reset = () => setForm({ firstName: '', lastName: '', email: '', password: '', position: '', birthDate: '' });

  const canSave = !!form.firstName && !!form.lastName && !!form.email && !!form.password;

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await api.post('/users', form);
      reset(); onAdded();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || 'Erreur lors de la création.');
    } finally { setSaving(false); }
  };

  return (
    <SheetModal visible={visible} title="Ajouter une joueuse" onClose={() => { reset(); onClose(); }}>
      <View className="flex-row" style={{ gap: 10 }}>
        <View className="flex-1">
          <Field label="Prénom *">
            <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="Marie" value={form.firstName} onChangeText={set('firstName')} />
          </Field>
        </View>
        <View className="flex-1">
          <Field label="Nom *">
            <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="Dupont" value={form.lastName} onChangeText={set('lastName')} />
          </Field>
        </View>
      </View>

      <Field label="Email *">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="marie@club.fr" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={set('email')} />
      </Field>

      <Field label="Mot de passe temporaire *">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="Elle pourra le changer" secureTextEntry value={form.password} onChangeText={set('password')} />
      </Field>

      <Field label="Date de naissance">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="AAAA-MM-JJ" value={form.birthDate} onChangeText={set('birthDate')} />
      </Field>

      <Field label="Poste">
        <TouchableOpacity className="bg-gray-100 rounded-xl px-4 py-3 flex-row items-center justify-between" onPress={() => setShowPos(true)}>
          <Text className={form.position ? 'text-gray-900' : 'text-gray-400'}>{form.position || 'Choisir un poste…'}</Text>
          <Text className="text-gray-400">›</Text>
        </TouchableOpacity>
      </Field>

      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}

      <View className="flex-row" style={{ gap: 8 }}>
        <TouchableOpacity onPress={() => { reset(); onClose(); }} className="flex-1 bg-gray-100 rounded-xl py-3 items-center">
          <Text className="text-gray-700 font-semibold">Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} disabled={saving || !canSave} className={`flex-1 rounded-xl py-3 items-center ${canSave ? 'bg-blue-600' : 'bg-blue-200'}`}>
          <Text className="text-white font-semibold">{saving ? 'Création...' : 'Créer le compte'}</Text>
        </TouchableOpacity>
      </View>

      <PickerModal visible={showPos} title="Poste" options={POSITIONS} selected={form.position} onSelect={set('position')} onClose={() => setShowPos(false)} />
    </SheetModal>
  );
}

/* ─── EditPlayerModal ────────────────────────────────────────────────────── */

function EditPlayerModal({ player, onClose, onSaved }: {
  player: User | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', position: '', birthDate: '' });
  const [saving,  setSaving]  = useState(false);
  const [showPos, setShowPos] = useState(false);

  useEffect(() => {
    if (player) setForm({
      firstName: player.firstName,
      lastName:  player.lastName,
      email:     player.email || '',
      position:  player.position || '',
      birthDate: player.birthDate ? player.birthDate.slice(0, 10) : '',
    });
  }, [player]);

  const set = (f: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!player) return;
    setSaving(true);
    try {
      await api.patch(`/users/${player.id}`, form);
      onSaved();
    } catch {
      Alert.alert('Erreur', 'Impossible de modifier cette joueuse.');
    } finally { setSaving(false); }
  };

  return (
    <SheetModal visible={!!player} title={player ? `Modifier — ${player.firstName} ${player.lastName}` : ''} onClose={onClose}>
      <View className="flex-row" style={{ gap: 10 }}>
        <View className="flex-1">
          <Field label="Prénom">
            <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" value={form.firstName} onChangeText={set('firstName')} />
          </Field>
        </View>
        <View className="flex-1">
          <Field label="Nom">
            <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" value={form.lastName} onChangeText={set('lastName')} />
          </Field>
        </View>
      </View>

      <Field label="Email">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={set('email')} />
      </Field>

      <Field label="Date de naissance">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="AAAA-MM-JJ" value={form.birthDate} onChangeText={set('birthDate')} />
      </Field>

      <Field label="Poste">
        <TouchableOpacity className="bg-gray-100 rounded-xl px-4 py-3 flex-row items-center justify-between" onPress={() => setShowPos(true)}>
          <Text className={form.position ? 'text-gray-900' : 'text-gray-400'}>{form.position || 'Non défini'}</Text>
          <Text className="text-gray-400">›</Text>
        </TouchableOpacity>
      </Field>

      <View className="flex-row" style={{ gap: 8 }}>
        <TouchableOpacity onPress={onClose} className="flex-1 bg-gray-100 rounded-xl py-3 items-center">
          <Text className="text-gray-700 font-semibold">Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} disabled={saving} className={`flex-1 rounded-xl py-3 items-center ${saving ? 'bg-blue-300' : 'bg-blue-600'}`}>
          <Text className="text-white font-semibold">{saving ? 'Sauvegarde...' : 'Sauvegarder'}</Text>
        </TouchableOpacity>
      </View>

      <PickerModal visible={showPos} title="Poste" options={POSITIONS} selected={form.position} onSelect={set('position')} onClose={() => setShowPos(false)} />
    </SheetModal>
  );
}
