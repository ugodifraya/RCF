import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';
import { Injury, CycleTracking, User } from '../../src/types';
import PickerModal from '../../src/components/PickerModal';

/* ─── Constantes ─────────────────────────────────────────────────────────── */

const BODY_PARTS = ['Cheville', 'Genou', 'Cuisse', 'Dos', 'Épaule', 'Bras', 'Abducteurs', 'Mollet', 'Pied', 'Hanche', 'Nuque', 'Autre'];
const PAIN_HEX   = ['', '#22c55e','#4ade80','#a3e635','#facc15','#eab308','#fb923c','#f97316','#f87171','#ef4444','#dc2626'];
const painLabel  = (n: number) => n === 0 ? 'Aucune' : n <= 2 ? 'Légère' : n <= 4 ? 'Modérée' : n <= 6 ? 'Notable' : n <= 8 ? 'Forte' : 'Très forte';

interface HealthData {
  summary: { totalPlayers: number; injuredCount: number; inCycleCount: number; availableCount: number };
  activeInjuries:  (Injury      & { user: User })[];
  recentInjuries:  (Injury      & { user: User })[];
  activeCycles:    (CycleTracking & { user: User })[];
  recentCycles:    (CycleTracking & { user: User })[];
  allInjuries:     (Injury      & { user: User })[];
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function Avatar({ u, bg, fg }: { u: { firstName: string; lastName: string }; bg: string; fg: string }) {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 12 }}>{u.firstName[0]}{u.lastName[0]}</Text>
    </View>
  );
}

function KpiCard({ value, label, color, bg }: { value: number | string; label: string; color: string; bg: string }) {
  return (
    <View className="flex-1 rounded-2xl border items-center py-4" style={{ backgroundColor: bg, borderColor: bg }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color }}>{value}</Text>
      <Text className="text-xs text-gray-500 mt-0.5 text-center">{label}</Text>
    </View>
  );
}

function SheetModal({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: '92%' }}>
          <View className="w-10 h-1 bg-gray-200 rounded-full self-center mt-3 mb-1" />
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-gray-100">
            <Text className="font-bold text-gray-900 text-base">{title}</Text>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
              <Text className="text-gray-500 text-sm">✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            {children}
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PainPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
        {Array.from({ length: 11 }, (_, i) => i).map(n => (
          <TouchableOpacity key={n} onPress={() => onChange(n)}
            style={{ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
              backgroundColor: value === n ? (PAIN_HEX[n] || '#2563eb') : '#f3f4f6',
              borderWidth: value === n ? 0 : 1, borderColor: '#e5e7eb' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: value === n ? '#fff' : '#374151' }}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View className="flex-row justify-between">
        <Text className="text-xs text-gray-400">Aucune</Text>
        <Text className="text-xs font-medium" style={{ color: PAIN_HEX[value] || '#374151' }}>
          {value > 0 ? `${value}/10 — ${painLabel(value)}` : 'Pas de douleur'}
        </Text>
        <Text className="text-xs text-gray-400">Extrême</Text>
      </View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text className="text-xs font-semibold text-gray-500 uppercase">{label}</Text>
      {children}
    </View>
  );
}

function Btn({ onPress, disabled, color, children }: { onPress: () => void; disabled?: boolean; color?: string; children: string }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}
      className="flex-1 rounded-xl py-3 items-center"
      style={{ backgroundColor: disabled ? '#e5e7eb' : (color || '#2563eb') }}>
      <Text style={{ color: disabled ? '#9ca3af' : '#fff', fontWeight: '600' }}>{children}</Text>
    </TouchableOpacity>
  );
}

/* ─── Écran principal ────────────────────────────────────────────────────── */

export default function HealthScreen() {
  const { isCoach } = useAuth();
  const [loading, setLoading] = useState(true);

  // Coach
  const [data,    setData]    = useState<HealthData | null>(null);
  const [players, setPlayers] = useState<User[]>([]);
  // Player
  const [cycles,   setCycles]   = useState<CycleTracking[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);

  const load = () => {
    setLoading(true);
    if (isCoach) {
      Promise.all([api.get('/health/dashboard'), api.get('/users/players')])
        .then(([h, p]) => { setData(h.data); setPlayers(p.data); })
        .catch(() => Alert.alert('Erreur', 'Impossible de charger les données.'))
        .finally(() => setLoading(false));
    } else {
      Promise.all([api.get('/health/my-cycles'), api.get('/injuries/my-injuries')])
        .then(([c, i]) => { setCycles(c.data); setInjuries(i.data); })
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => { load(); }, [isCoach]);

  if (loading) return (
    <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
      <ActivityIndicator size="large" color="#2563eb" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {isCoach
        ? <CoachView data={data} players={players} reload={load} />
        : <PlayerView cycles={cycles} injuries={injuries} reload={load} />
      }
    </SafeAreaView>
  );
}

/* ─── Vue Coach ──────────────────────────────────────────────────────────── */

function CoachView({ data, players, reload }: { data: HealthData | null; players: User[]; reload: () => void }) {
  const [tab,          setTab]          = useState<'overview' | 'injuries' | 'cycles' | 'history'>('overview');
  const [showDeclare,  setShowDeclare]  = useState(false);

  if (!data) return null;
  const { summary, activeInjuries, activeCycles, allInjuries, recentInjuries, recentCycles } = data;
  const newNotifs = recentInjuries.length + recentCycles.length;

  const markRecovered = (inj: Injury & { user: User }) =>
    Alert.alert('Confirmer', `Marquer ${inj.user.firstName} comme rétablie ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Rétablie ✓', onPress: async () => {
        await api.put(`/injuries/${inj.id}`, { userId: inj.userId, type: inj.type, bodyPart: inj.bodyPart, startDate: inj.startDate, endDate: new Date().toISOString().slice(0, 10), description: inj.description, status: 'RECOVERED' });
        reload();
      }},
    ]);

  const TABS = [
    { key: 'overview',  label: 'Vue d\'ensemble' },
    { key: 'injuries',  label: `Blessures (${activeInjuries.length})` },
    { key: 'cycles',    label: `Cycles (${activeCycles.length})` },
    { key: 'history',   label: 'Historique' },
  ] as const;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="text-2xl font-bold text-gray-900">🏥 Santé équipe</Text>
          <Text className="text-sm text-gray-500 mt-0.5">Blessures et cycles de l'équipe</Text>
        </View>
        <TouchableOpacity onPress={() => setShowDeclare(true)} className="bg-red-500 px-3 py-2 rounded-xl mt-1">
          <Text className="text-white text-sm font-semibold">+ Blessure</Text>
        </TouchableOpacity>
      </View>

      {/* Nouvelles déclarations */}
      {newNotifs > 0 && (
        <View className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3" style={{ gap: 8 }}>
          <Text className="text-sm font-bold text-amber-800">🔔 Nouvelles déclarations (48h)</Text>
          {recentInjuries.map(inj => (
            <View key={inj.id} className="flex-row items-center bg-white rounded-xl px-3 py-2.5 border border-red-100" style={{ gap: 8 }}>
              <Avatar u={inj.user} bg="#fee2e2" fg="#dc2626" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-900">{inj.user.firstName} {inj.user.lastName}</Text>
                <Text className="text-xs text-red-600">🤕 {inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}</Text>
              </View>
              <Text className="text-xs text-gray-400">{format(new Date(inj.createdAt), 'd MMM HH:mm', { locale: fr })}</Text>
            </View>
          ))}
          {recentCycles.map(c => (
            <View key={c.id} className="flex-row items-center bg-white rounded-xl px-3 py-2.5 border border-pink-100" style={{ gap: 8 }}>
              <Avatar u={c.user} bg="#fce7f3" fg="#db2777" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-900">{c.user.firstName} {c.user.lastName}</Text>
                <Text className="text-xs text-pink-600">🩸 Début le {format(new Date(c.startDate), 'd MMMM', { locale: fr })}{c.painLevel && c.painLevel > 0 ? ` · Douleur ${c.painLevel}/10` : ''}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* KPIs */}
      <View className="flex-row" style={{ gap: 8 }}>
        <KpiCard value={summary.availableCount} label="Disponibles" color="#16a34a" bg="#f0fdf4" />
        <KpiCard value={summary.injuredCount}   label="Blessées"    color={summary.injuredCount > 0 ? '#dc2626' : '#9ca3af'} bg={summary.injuredCount > 0 ? '#fef2f2' : '#f9fafb'} />
        <KpiCard value={summary.inCycleCount}   label="En période"  color={summary.inCycleCount > 0 ? '#db2777' : '#9ca3af'} bg={summary.inCycleCount > 0 ? '#fdf2f8' : '#f9fafb'} />
        <KpiCard value={summary.totalPlayers}   label="Joueuses"    color="#2563eb" bg="#eff6ff" />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row" style={{ gap: 6 }}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full border ${tab === t.key ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}>
              <Text className={`text-xs font-medium ${tab === t.key ? 'text-white' : 'text-gray-600'}`}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Vue d'ensemble */}
      {tab === 'overview' && (
        <View style={{ gap: 10 }}>
          <View className="bg-white rounded-2xl border border-gray-200 px-4 py-4" style={{ gap: 8 }}>
            <Text className="font-semibold text-gray-900">🤕 Blessées en ce moment</Text>
            {activeInjuries.length === 0
              ? <Text className="text-gray-400 text-sm text-center py-3">Aucune blessure active 💪</Text>
              : activeInjuries.map(inj => (
                <View key={inj.id} className="flex-row items-center justify-between bg-red-50 rounded-xl px-3 py-2.5" style={{ gap: 8 }}>
                  <Avatar u={inj.user} bg="#fee2e2" fg="#dc2626" />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900">{inj.user.firstName} {inj.user.lastName}</Text>
                    <Text className="text-xs text-red-600">{inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}</Text>
                    <Text className="text-xs text-gray-400">{differenceInDays(new Date(), new Date(inj.startDate))} jour(s)</Text>
                  </View>
                  <TouchableOpacity onPress={() => markRecovered(inj)} className="bg-green-100 border border-green-300 px-2.5 py-1 rounded-lg">
                    <Text className="text-xs text-green-700 font-medium">✓ Rétablie</Text>
                  </TouchableOpacity>
                </View>
              ))
            }
          </View>
          <View className="bg-white rounded-2xl border border-gray-200 px-4 py-4" style={{ gap: 8 }}>
            <Text className="font-semibold text-gray-900">🩸 Cycles actifs</Text>
            {activeCycles.length === 0
              ? <Text className="text-gray-400 text-sm text-center py-3">Aucun cycle actif déclaré</Text>
              : activeCycles.map(c => (
                <View key={c.id} className="flex-row items-center bg-pink-50 rounded-xl px-3 py-2.5" style={{ gap: 8 }}>
                  <Avatar u={c.user} bg="#fce7f3" fg="#db2777" />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900">{c.user.firstName} {c.user.lastName}</Text>
                    <Text className="text-xs text-gray-500">Jour {differenceInDays(new Date(), new Date(c.startDate)) + 1} · depuis {format(new Date(c.startDate), 'd MMM', { locale: fr })}</Text>
                  </View>
                  {c.painLevel != null && c.painLevel > 0 && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: PAIN_HEX[c.painLevel] }}>{c.painLevel}/10</Text>
                      <Text className="text-xs text-gray-400">{painLabel(c.painLevel)}</Text>
                    </View>
                  )}
                </View>
              ))
            }
          </View>
        </View>
      )}

      {/* Blessures actives */}
      {tab === 'injuries' && (
        <View style={{ gap: 10 }}>
          {activeInjuries.length === 0 ? (
            <View className="bg-white rounded-2xl border border-gray-200 items-center py-12" style={{ gap: 8 }}>
              <Text className="text-4xl">💪</Text><Text className="text-gray-400 text-sm">Aucune blessure active</Text>
            </View>
          ) : activeInjuries.map(inj => (
            <View key={inj.id} className="bg-white rounded-2xl border border-red-200 px-4 py-4">
              <View className="flex-row items-start" style={{ gap: 10 }}>
                <Avatar u={inj.user} bg="#fee2e2" fg="#dc2626" />
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900">{inj.user.firstName} {inj.user.lastName}</Text>
                  {inj.user.position && <Text className="text-xs text-gray-400">{inj.user.position}</Text>}
                  <Text className="text-sm font-medium text-red-600 mt-1">{inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}</Text>
                  <Text className="text-xs text-gray-500">Depuis le {format(new Date(inj.startDate), 'd MMMM yyyy', { locale: fr })} ({differenceInDays(new Date(), new Date(inj.startDate))} j)</Text>
                  {inj.endDate && <Text className="text-xs text-gray-400">Retour prévu : {format(new Date(inj.endDate), 'd MMM yyyy', { locale: fr })}</Text>}
                  {inj.description && <Text className="text-xs text-gray-500 italic mt-0.5">"{inj.description}"</Text>}
                  <Text className="text-xs text-gray-400 mt-0.5">{inj.reportedBy === 'PLAYER' ? '🙋 Auto-déclarée' : '👤 Staff'}</Text>
                </View>
                <TouchableOpacity onPress={() => markRecovered(inj)} className="bg-green-100 border border-green-300 px-2.5 py-1 rounded-lg">
                  <Text className="text-xs text-green-700 font-medium">✓ Rétablie</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Cycles actifs */}
      {tab === 'cycles' && (
        <View style={{ gap: 10 }}>
          {activeCycles.length === 0 ? (
            <View className="bg-white rounded-2xl border border-gray-200 items-center py-12" style={{ gap: 8 }}>
              <Text className="text-4xl">🌸</Text><Text className="text-gray-400 text-sm">Aucun cycle actif déclaré</Text>
            </View>
          ) : activeCycles.map(c => (
            <View key={c.id} className="bg-white rounded-2xl border border-pink-200 px-4 py-4">
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <Avatar u={c.user} bg="#fce7f3" fg="#db2777" />
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900">{c.user.firstName} {c.user.lastName}</Text>
                  <Text className="text-xs text-gray-500">Début {format(new Date(c.startDate), 'd MMMM yyyy', { locale: fr })} · Jour {differenceInDays(new Date(), new Date(c.startDate)) + 1}</Text>
                  {c.notes && <Text className="text-xs text-gray-500 italic mt-0.5">"{c.notes}"</Text>}
                </View>
                {c.painLevel != null && c.painLevel > 0 && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: PAIN_HEX[c.painLevel] }}>{c.painLevel}/10</Text>
                    <Text className="text-xs text-gray-400">{painLabel(c.painLevel)}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Historique */}
      {tab === 'history' && (
        <View className="bg-white rounded-2xl border border-gray-200 px-4 py-4" style={{ gap: 8 }}>
          <Text className="font-semibold text-gray-900">Historique des blessures</Text>
          {allInjuries.length === 0 ? (
            <Text className="text-gray-400 text-sm text-center py-4">Aucune blessure enregistrée</Text>
          ) : allInjuries.map(inj => (
            <View key={inj.id} className={`flex-row items-center justify-between px-3 py-2.5 rounded-xl ${inj.status === 'ACTIVE' ? 'bg-red-50' : 'bg-gray-50'}`} style={{ gap: 8 }}>
              <Avatar u={inj.user} bg={inj.status === 'ACTIVE' ? '#fee2e2' : '#f3f4f6'} fg={inj.status === 'ACTIVE' ? '#dc2626' : '#6b7280'} />
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-900">{inj.user.firstName} {inj.user.lastName} — {inj.bodyPart ? `${inj.bodyPart} / ` : ''}{inj.type}</Text>
                <Text className="text-xs text-gray-400">{format(new Date(inj.startDate), 'd MMM yyyy', { locale: fr })}{inj.endDate ? ` → ${format(new Date(inj.endDate), 'd MMM yyyy', { locale: fr })}` : ''}</Text>
              </View>
              <View className={`px-2.5 py-1 rounded-full ${inj.status === 'ACTIVE' ? 'bg-red-100' : 'bg-green-100'}`}>
                <Text className={`text-xs font-semibold ${inj.status === 'ACTIVE' ? 'text-red-700' : 'text-green-700'}`}>{inj.status === 'ACTIVE' ? 'Active' : 'Rétablie'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <DeclareInjurySheet visible={showDeclare} players={players} onClose={() => setShowDeclare(false)} onSaved={() => { setShowDeclare(false); reload(); }} />
    </ScrollView>
  );
}

/* ─── Vue Joueuse ────────────────────────────────────────────────────────── */

function PlayerView({ cycles, injuries, reload }: { cycles: CycleTracking[]; injuries: Injury[]; reload: () => void }) {
  const [tab,           setTab]           = useState<'cycle' | 'injury'>('cycle');
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [endingCycle,   setEndingCycle]   = useState<CycleTracking | null>(null);
  const [showInjForm,   setShowInjForm]   = useState(false);

  const activeInjuries = injuries.filter(i => i.status === 'ACTIVE');
  const activeCycle    = cycles.find(c => !c.endDate);

  const deleteCycle = (id: string) =>
    Alert.alert('Supprimer', 'Supprimer cette entrée ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await api.delete(`/health/cycles/${id}`); reload(); } },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <Text className="text-2xl font-bold text-gray-900">Santé personnelle</Text>

      {/* Alerte blessure active */}
      {activeInjuries.length > 0 && (
        <View className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3" style={{ gap: 4 }}>
          <Text className="text-sm font-semibold text-red-700">⚠️ Blessure(s) active(s)</Text>
          {activeInjuries.map(inj => (
            <Text key={inj.id} className="text-sm text-red-600">{inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}</Text>
          ))}
        </View>
      )}

      {/* Tabs */}
      <View className="flex-row bg-white rounded-xl border border-gray-200 p-1" style={{ gap: 4 }}>
        <TouchableOpacity onPress={() => setTab('cycle')} className={`flex-1 py-2 rounded-lg items-center ${tab === 'cycle' ? 'bg-pink-500' : ''}`}>
          <Text className={`text-sm font-medium ${tab === 'cycle' ? 'text-white' : 'text-gray-600'}`}>🩸 Cycle</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('injury')} className={`flex-1 py-2 rounded-lg items-center flex-row justify-center ${tab === 'injury' ? 'bg-red-500' : ''}`} style={{ gap: 4 }}>
          <Text className={`text-sm font-medium ${tab === 'injury' ? 'text-white' : 'text-gray-600'}`}>🤕 Blessures</Text>
          {activeInjuries.length > 0 && (
            <View className="bg-red-600 rounded-full px-1.5 py-0.5">
              <Text className="text-white text-xs font-bold">{activeInjuries.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Onglet Cycle */}
      {tab === 'cycle' && (
        <View style={{ gap: 10 }}>
          <View className="bg-pink-50 border border-pink-200 rounded-2xl px-4 py-3">
            <Text className="text-sm text-pink-800">🔒 Ces informations sont partagées avec votre coach pour adapter vos entraînements.</Text>
          </View>

          {activeCycle && (
            <View className="bg-pink-50 border border-pink-300 rounded-2xl px-4 py-4">
              <View className="flex-row items-start justify-between">
                <View>
                  <Text className="font-semibold text-pink-800">🩸 Règles en cours</Text>
                  <Text className="text-sm text-pink-600">Depuis le {format(new Date(activeCycle.startDate), 'd MMMM yyyy', { locale: fr })}</Text>
                  <Text className="text-sm text-pink-600">Jour {differenceInDays(new Date(), new Date(activeCycle.startDate)) + 1}</Text>
                  {activeCycle.painLevel != null && activeCycle.painLevel > 0 && (
                    <Text className="text-xs text-pink-600 mt-0.5">Douleur {activeCycle.painLevel}/10 — {painLabel(activeCycle.painLevel)}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => setEndingCycle(activeCycle)} className="bg-pink-600 px-3 py-2 rounded-xl">
                  <Text className="text-white text-xs font-semibold">Fin des règles</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setShowCycleForm(true)}
            disabled={!!activeCycle}
            className={`rounded-xl py-3 items-center ${activeCycle ? 'bg-pink-200' : 'bg-pink-500'}`}
          >
            <Text className="text-white font-semibold text-sm">+ Déclarer le début de mes règles</Text>
          </TouchableOpacity>

          {cycles.length === 0 ? (
            <View className="bg-white rounded-2xl border border-gray-200 items-center py-10" style={{ gap: 8 }}>
              <Text className="text-3xl">🌸</Text><Text className="text-gray-400 text-sm">Aucune période enregistrée</Text>
            </View>
          ) : cycles.map(c => {
            const duration = c.endDate ? differenceInDays(new Date(c.endDate), new Date(c.startDate)) + 1 : null;
            return (
              <View key={c.id} className={`bg-white rounded-2xl border px-4 py-3 ${!c.endDate ? 'border-pink-300 bg-pink-50' : 'border-gray-200'}`}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-start" style={{ gap: 10 }}>
                    <Text style={{ fontSize: 22 }}>🩸</Text>
                    <View>
                      <Text className="font-semibold text-gray-900">
                        {format(new Date(c.startDate), 'd MMMM yyyy', { locale: fr })}
                        {c.endDate ? ` → ${format(new Date(c.endDate), 'd MMMM yyyy', { locale: fr })}` : ''}
                      </Text>
                      <View className="flex-row flex-wrap mt-0.5" style={{ gap: 8 }}>
                        {duration && <Text className="text-xs text-gray-500">{duration} jour{duration > 1 ? 's' : ''}</Text>}
                        {!c.endDate && <View className="bg-pink-100 rounded-full px-2 py-0.5"><Text className="text-xs text-pink-700 font-medium">En cours</Text></View>}
                        {c.painLevel != null && c.painLevel > 0 && (
                          <Text className="text-xs text-gray-500">Douleur {c.painLevel}/10 — {painLabel(c.painLevel)}</Text>
                        )}
                      </View>
                      {c.notes && <Text className="text-xs text-gray-500 italic mt-0.5">"{c.notes}"</Text>}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => deleteCycle(c.id)}>
                    <Text className="text-gray-300 text-lg">✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Onglet Blessures */}
      {tab === 'injury' && (
        <View style={{ gap: 10 }}>
          <TouchableOpacity onPress={() => setShowInjForm(true)} className="bg-red-500 rounded-xl py-3 items-center">
            <Text className="text-white font-semibold text-sm">+ Signaler une douleur / blessure</Text>
          </TouchableOpacity>

          {injuries.length === 0 ? (
            <View className="bg-white rounded-2xl border border-gray-200 items-center py-10" style={{ gap: 8 }}>
              <Text className="text-3xl">💪</Text><Text className="text-gray-400 text-sm">Aucune blessure déclarée</Text>
            </View>
          ) : injuries.map(inj => (
            <View key={inj.id} className={`bg-white rounded-2xl border px-4 py-3 ${inj.status === 'ACTIVE' ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
                  <Text style={{ fontSize: 22 }}>{inj.status === 'ACTIVE' ? '🤕' : '✅'}</Text>
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900">{inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}</Text>
                    <Text className="text-xs text-gray-500">Depuis le {format(new Date(inj.startDate), 'd MMMM yyyy', { locale: fr })}</Text>
                    {inj.endDate && <Text className="text-xs text-gray-400">Retour prévu : {format(new Date(inj.endDate), 'd MMM', { locale: fr })}</Text>}
                    {inj.description && <Text className="text-xs text-gray-400 italic mt-0.5">"{inj.description}"</Text>}
                    <Text className="text-xs text-gray-400 mt-0.5">{inj.reportedBy === 'PLAYER' ? 'Auto-déclarée' : 'Déclarée par le staff'}</Text>
                  </View>
                </View>
                <View className={`px-2.5 py-1 rounded-full shrink-0 ${inj.status === 'ACTIVE' ? 'bg-red-100' : 'bg-green-100'}`}>
                  <Text className={`text-xs font-semibold ${inj.status === 'ACTIVE' ? 'text-red-700' : 'text-green-700'}`}>{inj.status === 'ACTIVE' ? 'Active' : 'Rétablie'}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Sheets */}
      <CycleStartSheet visible={showCycleForm} onClose={() => setShowCycleForm(false)} onSaved={() => { setShowCycleForm(false); reload(); }} />
      <CycleEndSheet   cycle={endingCycle}     onClose={() => setEndingCycle(null)}    onSaved={() => { setEndingCycle(null);    reload(); }} />
      <InjurySelfSheet visible={showInjForm}   onClose={() => setShowInjForm(false)}   onSaved={() => { setShowInjForm(false);  reload(); }} />
    </ScrollView>
  );
}

/* ─── Sheets ─────────────────────────────────────────────────────────────── */

function DeclareInjurySheet({ visible, players, onClose, onSaved }: {
  visible: boolean; players: User[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ userId: '', type: '', bodyPart: '', startDate: '', endDate: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showPart,   setShowPart]   = useState(false);
  const set = (f: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [f]: v }));
  const reset = () => setForm({ userId: '', type: '', bodyPart: '', startDate: '', endDate: '', description: '' });
  const canSave = !!form.userId && !!form.type && !!form.startDate;

  const handleSave = async () => {
    setSaving(true);
    try { await api.post('/injuries', form); reset(); onSaved(); }
    catch { Alert.alert('Erreur', 'Impossible de déclarer la blessure.'); }
    finally { setSaving(false); }
  };

  const playerName = (id: string) => { const p = players.find(pl => pl.id === id); return p ? `${p.firstName} ${p.lastName}` : ''; };

  return (
    <SheetModal visible={visible} title="Déclarer une blessure / douleur" onClose={() => { reset(); onClose(); }}>
      <Row label="Joueuse *">
        <TouchableOpacity onPress={() => setShowPlayer(true)} className="bg-gray-100 rounded-xl px-4 py-3 flex-row items-center justify-between">
          <Text className={form.userId ? 'text-gray-900' : 'text-gray-400'}>{form.userId ? playerName(form.userId) : 'Choisir une joueuse…'}</Text>
          <Text className="text-gray-400">›</Text>
        </TouchableOpacity>
      </Row>
      <View className="flex-row" style={{ gap: 8 }}>
        <View className="flex-1">
          <Row label="Zone du corps">
            <TouchableOpacity onPress={() => setShowPart(true)} className="bg-gray-100 rounded-xl px-4 py-3 flex-row items-center justify-between">
              <Text className={form.bodyPart ? 'text-gray-900 text-sm' : 'text-gray-400 text-sm'}>{form.bodyPart || 'Choisir…'}</Text>
              <Text className="text-gray-400">›</Text>
            </TouchableOpacity>
          </Row>
        </View>
        <View className="flex-1">
          <Row label="Type *">
            <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-sm" placeholder="Entorse, douleur…" value={form.type} onChangeText={set('type')} />
          </Row>
        </View>
      </View>
      <View className="flex-row" style={{ gap: 8 }}>
        <View className="flex-1"><Row label="Date début *"><TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-sm" placeholder="AAAA-MM-JJ" value={form.startDate} onChangeText={set('startDate')} /></Row></View>
        <View className="flex-1"><Row label="Retour prévu"><TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-sm" placeholder="AAAA-MM-JJ" value={form.endDate} onChangeText={set('endDate')} /></Row></View>
      </View>
      <Row label="Description">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-sm" multiline numberOfLines={3} textAlignVertical="top" placeholder="Contexte, gravité…" value={form.description} onChangeText={set('description')} style={{ minHeight: 72 }} />
      </Row>
      <View className="flex-row" style={{ gap: 8 }}>
        <Btn onPress={() => { reset(); onClose(); }} color="#e5e7eb">Annuler</Btn>
        <Btn onPress={handleSave} disabled={saving || !canSave} color="#ef4444">{saving ? 'Envoi…' : 'Déclarer'}</Btn>
      </View>
      <PickerModal visible={showPlayer} title="Joueuse" options={players.map(p => `${p.firstName} ${p.lastName}`)} selected={playerName(form.userId)} onSelect={label => { const p = players.find(pl => `${pl.firstName} ${pl.lastName}` === label); if (p) set('userId')(p.id); }} onClose={() => setShowPlayer(false)} />
      <PickerModal visible={showPart}   title="Zone du corps" options={BODY_PARTS} selected={form.bodyPart} onSelect={set('bodyPart')} onClose={() => setShowPart(false)} />
    </SheetModal>
  );
}

function CycleStartSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [date,  setDate]  = useState(new Date().toISOString().slice(0, 10));
  const [pain,  setPain]  = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!date) return;
    setSaving(true);
    try { await api.post('/health/cycles', { startDate: date, painLevel: pain, notes }); setDate(new Date().toISOString().slice(0, 10)); setPain(0); setNotes(''); onSaved(); }
    catch { Alert.alert('Erreur', 'Impossible d\'enregistrer.'); }
    finally { setSaving(false); }
  };

  return (
    <SheetModal visible={visible} title="Début de mes règles" onClose={onClose}>
      <Row label="Date de début *">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="AAAA-MM-JJ" value={date} onChangeText={setDate} />
      </Row>
      <Row label={`Niveau de douleur : ${pain}/10 — ${painLabel(pain)}`}>
        <PainPicker value={pain} onChange={setPain} />
      </Row>
      <Row label="Notes (optionnel)">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" multiline numberOfLines={2} textAlignVertical="top" placeholder="Symptômes, ressenti…" value={notes} onChangeText={setNotes} style={{ minHeight: 60 }} />
      </Row>
      <View className="flex-row" style={{ gap: 8 }}>
        <Btn onPress={onClose} color="#e5e7eb">Annuler</Btn>
        <Btn onPress={handleSave} disabled={saving || !date} color="#ec4899">{saving ? 'Enregistrement…' : 'Déclarer le début'}</Btn>
      </View>
    </SheetModal>
  );
}

function CycleEndSheet({ cycle, onClose, onSaved }: { cycle: CycleTracking | null; onClose: () => void; onSaved: () => void }) {
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    if (!cycle) return;
    setSaving(true);
    try { await api.put(`/health/cycles/${cycle.id}`, { startDate: cycle.startDate, endDate, painLevel: cycle.painLevel, notes: cycle.notes }); onSaved(); }
    catch { Alert.alert('Erreur', 'Impossible de mettre à jour.'); }
    finally { setSaving(false); }
  };

  return (
    <SheetModal visible={!!cycle} title="Fin de mes règles" onClose={onClose}>
      {cycle && <Text className="text-sm text-gray-600">Début le {format(new Date(cycle.startDate), 'd MMMM yyyy', { locale: fr })}</Text>}
      <Row label="Date de fin *">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="AAAA-MM-JJ" value={endDate} onChangeText={setEndDate} />
      </Row>
      <View className="flex-row" style={{ gap: 8 }}>
        <Btn onPress={onClose} color="#e5e7eb">Annuler</Btn>
        <Btn onPress={handleSave} disabled={saving} color="#ec4899">{saving ? 'Enregistrement…' : 'Confirmer la fin'}</Btn>
      </View>
    </SheetModal>
  );
}

function InjurySelfSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: '', bodyPart: '', startDate: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [showPart, setShowPart] = useState(false);
  const set = (f: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [f]: v }));
  const reset = () => setForm({ type: '', bodyPart: '', startDate: '', description: '' });

  const handleSave = async () => {
    setSaving(true);
    try { await api.post('/injuries/self-report', form); reset(); onSaved(); }
    catch { Alert.alert('Erreur', 'Impossible de signaler la blessure.'); }
    finally { setSaving(false); }
  };

  return (
    <SheetModal visible={visible} title="Signaler une douleur / blessure" onClose={() => { reset(); onClose(); }}>
      <Row label="Zone concernée">
        <TouchableOpacity onPress={() => setShowPart(true)} className="bg-gray-100 rounded-xl px-4 py-3 flex-row items-center justify-between">
          <Text className={form.bodyPart ? 'text-gray-900' : 'text-gray-400'}>{form.bodyPart || 'Choisir…'}</Text>
          <Text className="text-gray-400">›</Text>
        </TouchableOpacity>
      </Row>
      <Row label="Type de douleur / blessure *">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="Douleur, entorse, contracture…" value={form.type} onChangeText={set('type')} />
      </Row>
      <Row label="Date d'apparition *">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="AAAA-MM-JJ" value={form.startDate} onChangeText={set('startDate')} />
      </Row>
      <Row label="Description">
        <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" multiline numberOfLines={3} textAlignVertical="top" placeholder="Décrivez vos symptômes…" value={form.description} onChangeText={set('description')} style={{ minHeight: 72 }} />
      </Row>
      <View className="flex-row" style={{ gap: 8 }}>
        <Btn onPress={() => { reset(); onClose(); }} color="#e5e7eb">Annuler</Btn>
        <Btn onPress={handleSave} disabled={saving || !form.type || !form.startDate} color="#ef4444">{saving ? 'Envoi…' : 'Signaler'}</Btn>
      </View>
      <PickerModal visible={showPart} title="Zone du corps" options={BODY_PARTS} selected={form.bodyPart} onSelect={set('bodyPart')} onClose={() => setShowPart(false)} />
    </SheetModal>
  );
}
