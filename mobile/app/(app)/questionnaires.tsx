import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';
import { Questionnaire, Question, QuestionType } from '../../src/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PickerModal from '../../src/components/PickerModal';

/* ─── Types locaux ───────────────────────────────────────────────────────── */

interface QuestionDraft { text: string; type: QuestionType; options: string[]; order: number }

const QTYPES: { key: QuestionType; label: string }[] = [
  { key: 'TEXT',            label: 'Texte libre'     },
  { key: 'SCALE',           label: 'Échelle (1-10)'  },
  { key: 'YES_NO',          label: 'Oui / Non'       },
  { key: 'MULTIPLE_CHOICE', label: 'Choix multiple'  },
];

const EMPTY_DRAFT: QuestionDraft = { text: '', type: 'TEXT', options: [], order: 1 };

/* ─── Écran principal ────────────────────────────────────────────────────── */

export default function QuestionnairesScreen() {
  const { user, isCoach } = useAuth();
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [selected,       setSelected]       = useState<Questionnaire | null>(null);
  const [showCreate,     setShowCreate]     = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/questionnaires').then(r => setQuestionnaires(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = (id: string) =>
    Alert.alert('Désactiver', 'Désactiver ce questionnaire ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Désactiver', style: 'destructive', onPress: async () => { await api.delete(`/questionnaires/${id}`); load(); } },
    ]);

  const openDetail = (q: Questionnaire) => {
    api.get(`/questionnaires/${q.id}`).then(r => setSelected(r.data));
  };

  const active   = questionnaires.filter(q => q.isActive);
  const inactive = questionnaires.filter(q => !q.isActive);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Questionnaires</Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              {isCoach ? 'Créez et suivez les questionnaires' : 'Questionnaires de votre coach'}
            </Text>
          </View>
          {isCoach && (
            <TouchableOpacity onPress={() => setShowCreate(true)} className="bg-blue-600 px-3 py-2 rounded-xl mt-1">
              <Text className="text-white text-sm font-semibold">+ Nouveau</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View className="items-center py-16"><ActivityIndicator size="large" color="#2563eb" /></View>
        ) : (
          <>
            {/* Actifs */}
            {active.length === 0 ? (
              <View className="bg-white rounded-2xl border border-gray-200 items-center py-12" style={{ gap: 8 }}>
                <Text className="text-4xl">📋</Text>
                <Text className="text-gray-400 text-sm">Aucun questionnaire actif</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {active.map(q => {
                  const hasAnswered = !isCoach && (q.responses?.length ?? 0) > 0;
                  return (
                    <TouchableOpacity key={q.id} onPress={() => openDetail(q)}
                      className="bg-white rounded-2xl border border-gray-200 px-4 py-4">
                      <View className="flex-row items-start" style={{ gap: 12 }}>
                        <View className="w-10 h-10 bg-orange-100 rounded-xl items-center justify-center">
                          <Text style={{ fontSize: 20 }}>📋</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="font-semibold text-gray-900">{q.title}</Text>
                          {q.description && <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={2}>{q.description}</Text>}
                          <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
                            <Text className="text-xs text-gray-400">{q._count?.questions ?? 0} question(s)</Text>
                            {isCoach && <Text className="text-xs text-gray-400">· {q._count?.responses ?? 0} réponse(s)</Text>}
                            <Text className="text-xs text-gray-400">· {format(new Date(q.createdAt), 'd MMM yyyy', { locale: fr })}</Text>
                          </View>
                        </View>
                        <View className="items-end" style={{ gap: 6 }}>
                          {!isCoach && (
                            <View className={`px-2.5 py-1 rounded-full ${hasAnswered ? 'bg-green-100' : 'bg-yellow-100'}`}>
                              <Text className={`text-xs font-semibold ${hasAnswered ? 'text-green-700' : 'text-yellow-700'}`}>
                                {hasAnswered ? '✓ Fait' : 'À faire'}
                              </Text>
                            </View>
                          )}
                          {isCoach && (
                            <TouchableOpacity onPress={() => handleDelete(q.id)}>
                              <Text className="text-xs text-red-400">Désactiver</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Désactivés (coach) */}
            {isCoach && inactive.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text className="text-sm font-medium text-gray-500">Désactivés</Text>
                {inactive.map(q => (
                  <View key={q.id} className="bg-white rounded-2xl border border-gray-200 px-4 py-3 opacity-60">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center" style={{ gap: 10 }}>
                        <Text style={{ fontSize: 18 }}>📋</Text>
                        <View>
                          <Text className="text-sm font-medium text-gray-700">{q.title}</Text>
                          <Text className="text-xs text-gray-400">{q._count?.responses ?? 0} réponse(s)</Text>
                        </View>
                      </View>
                      <View className="bg-gray-100 px-2.5 py-1 rounded-full">
                        <Text className="text-xs text-gray-500 font-medium">Désactivé</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Sheets */}
      <DetailSheet questionnaire={selected} user={user} isCoach={isCoach} onClose={() => { setSelected(null); load(); }} />
      <CreateSheet visible={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
    </SafeAreaView>
  );
}

/* ─── DetailSheet ────────────────────────────────────────────────────────── */

function DetailSheet({ questionnaire: q, user, isCoach, onClose }: {
  questionnaire: Questionnaire | null;
  user: ReturnType<typeof useAuth>['user'];
  isCoach: boolean;
  onClose: () => void;
}) {
  const [answers,    setAnswers]    = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  useEffect(() => {
    if (!q) return;
    const mine = q.responses?.find(r => r.userId === user?.id);
    if (mine) {
      const ans: Record<string, string> = {};
      mine.answers?.forEach(a => { ans[a.questionId] = a.answer; });
      setAnswers(ans);
      setSubmitted(true);
    } else {
      setAnswers({});
      setSubmitted(false);
    }
  }, [q, user?.id]);

  const handleSubmit = async () => {
    if (!q) return;
    const answerList = q.questions?.map(qu => ({ questionId: qu.id, answer: answers[qu.id] || '' })) || [];
    setSubmitting(true);
    try {
      await api.post(`/questionnaires/${q.id}/respond`, { answers: answerList });
      setSubmitted(true);
      const r = await api.get(`/questionnaires/${q.id}`);
      const mine = r.data.responses?.find((res: { userId: string }) => res.userId === user?.id);
      if (mine) {
        const ans: Record<string, string> = {};
        mine.answers?.forEach((a: { questionId: string; answer: string }) => { ans[a.questionId] = a.answer; });
        setAnswers(ans);
      }
    } catch { Alert.alert('Erreur', "Impossible d'envoyer les réponses."); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal visible={!!q} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: '92%' }}>
          {/* Handle + header */}
          <View className="w-10 h-1 bg-gray-200 rounded-full self-center mt-3 mb-1" />
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-gray-100">
            <Text className="font-bold text-gray-900 text-base flex-1 mr-3" numberOfLines={1}>{q?.title}</Text>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
              <Text className="text-gray-500 text-sm">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
            {/* Meta */}
            {q?.description && <Text className="text-gray-600 text-sm">{q.description}</Text>}
            {q?.dueDate && (
              <View className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2">
                <Text className="text-orange-700 text-sm">⏰ Avant le {format(new Date(q.dueDate), 'd MMM yyyy', { locale: fr })}</Text>
              </View>
            )}

            {/* Vue joueuse — répondre */}
            {!isCoach && q?.questions && (
              <>
                {submitted && (
                  <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <Text className="text-green-700 text-sm">✓ Vous avez déjà répondu à ce questionnaire</Text>
                  </View>
                )}
                {q.questions.map((question, i) => (
                  <QuestionField
                    key={question.id}
                    question={question}
                    index={i}
                    value={answers[question.id] || ''}
                    onChange={v => setAnswers(prev => ({ ...prev, [question.id]: v }))}
                    disabled={submitted}
                  />
                ))}
                {!submitted && (
                  <TouchableOpacity onPress={handleSubmit} disabled={submitting} className="bg-blue-600 rounded-xl py-3.5 items-center">
                    <Text className="text-white font-semibold">{submitting ? 'Envoi...' : 'Soumettre mes réponses'}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Vue coach — voir les réponses */}
            {isCoach && (
              <>
                <Text className="font-semibold text-gray-900">Réponses ({q?.responses?.length ?? 0})</Text>
                {(q?.responses?.length ?? 0) === 0 ? (
                  <View className="items-center py-8">
                    <Text className="text-gray-400 text-sm">Aucune réponse pour l'instant</Text>
                  </View>
                ) : (
                  q?.responses?.map(response => (
                    <View key={response.id} className="bg-gray-50 rounded-2xl px-4 py-4" style={{ gap: 10 }}>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                          <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center">
                            <Text className="text-blue-700 text-xs font-bold">
                              {response.user?.firstName?.[0]}{response.user?.lastName?.[0]}
                            </Text>
                          </View>
                          <Text className="font-medium text-gray-900 text-sm">{response.user?.firstName} {response.user?.lastName}</Text>
                        </View>
                        <Text className="text-xs text-gray-400">{format(new Date(response.submittedAt), 'd MMM HH:mm', { locale: fr })}</Text>
                      </View>
                      {response.answers?.map(answer => (
                        <View key={answer.id} className="bg-white rounded-xl px-3 py-2.5" style={{ gap: 2 }}>
                          <Text className="text-xs text-gray-500 font-medium">{answer.question?.text}</Text>
                          <Text className="text-sm text-gray-900">{answer.answer || '—'}</Text>
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </>
            )}
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── QuestionField ──────────────────────────────────────────────────────── */

function QuestionField({ question, index, value, onChange, disabled }: {
  question: Question; index: number; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  const options = question.options ? JSON.parse(question.options) as string[] : [];

  return (
    <View style={{ gap: 8 }}>
      <Text className="font-medium text-gray-900">
        <Text className="text-gray-400 text-sm">{index + 1}. </Text>
        {question.text}
      </Text>

      {question.type === 'TEXT' && (
        <TextInput
          className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-sm"
          multiline numberOfLines={3}
          textAlignVertical="top"
          placeholder="Votre réponse…"
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          style={{ minHeight: 80 }}
        />
      )}

      {question.type === 'YES_NO' && (
        <View className="flex-row" style={{ gap: 10 }}>
          {['Oui', 'Non'].map(opt => (
            <TouchableOpacity
              key={opt}
              onPress={() => !disabled && onChange(opt)}
              className={`flex-1 py-2.5 rounded-xl border-2 items-center ${value === opt ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}
            >
              <Text className={`font-medium text-sm ${value === opt ? 'text-white' : 'text-gray-700'}`}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {question.type === 'SCALE' && (
        <View style={{ gap: 6 }}>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => !disabled && onChange(String(n))}
                style={{ width: 40, height: 40 }}
                className={`rounded-xl border-2 items-center justify-center ${value === String(n) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}
              >
                <Text className={`text-sm font-medium ${value === String(n) ? 'text-white' : 'text-gray-700'}`}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-400">Faible</Text>
            <Text className="text-xs text-gray-400">Excellent</Text>
          </View>
        </View>
      )}

      {question.type === 'MULTIPLE_CHOICE' && (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              onPress={() => !disabled && onChange(opt)}
              className={`px-4 py-2 rounded-xl border-2 ${value === opt ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}
            >
              <Text className={`text-sm font-medium ${value === opt ? 'text-white' : 'text-gray-700'}`}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── CreateSheet ────────────────────────────────────────────────────────── */

function CreateSheet({ visible, onClose, onCreated }: {
  visible: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [form,      setForm]      = useState({ title: '', description: '', dueDate: '' });
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ ...EMPTY_DRAFT }]);
  const [saving,    setSaving]    = useState(false);
  const [showTypePicker, setShowTypePicker] = useState<number | null>(null);

  const reset = () => { setForm({ title: '', description: '', dueDate: '' }); setQuestions([{ ...EMPTY_DRAFT }]); };

  const addQ    = () => setQuestions(p => [...p, { text: '', type: 'TEXT', options: [], order: p.length + 1 }]);
  const removeQ = (i: number) => setQuestions(p => p.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, order: idx + 1 })));
  const updateQ = (i: number, field: string, value: unknown) =>
    setQuestions(p => p.map((q, idx) => idx === i ? { ...q, [field]: value } : q));

  const canSave = !!form.title && questions.every(q => !!q.text);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/questionnaires', { ...form, dueDate: form.dueDate || null, questions });
      reset(); onCreated();
    } catch { Alert.alert('Erreur', 'Impossible de créer le questionnaire.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: '94%' }}>
          <View className="w-10 h-1 bg-gray-200 rounded-full self-center mt-3 mb-1" />
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-gray-100">
            <Text className="font-bold text-gray-900 text-lg">Nouveau questionnaire</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
              <Text className="text-gray-500 text-sm">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            {/* Titre */}
            <View style={{ gap: 4 }}>
              <Text className="text-xs font-semibold text-gray-500 uppercase">Titre *</Text>
              <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="Bilan de forme…" value={form.title} onChangeText={v => setForm(p => ({ ...p, title: v }))} />
            </View>

            {/* Description */}
            <View style={{ gap: 4 }}>
              <Text className="text-xs font-semibold text-gray-500 uppercase">Description</Text>
              <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" multiline numberOfLines={2} textAlignVertical="top" placeholder="Instructions…" value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} style={{ minHeight: 64 }} />
            </View>

            {/* Date limite */}
            <View style={{ gap: 4 }}>
              <Text className="text-xs font-semibold text-gray-500 uppercase">Date limite (optionnel)</Text>
              <TextInput className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900" placeholder="AAAA-MM-JJ" value={form.dueDate} onChangeText={v => setForm(p => ({ ...p, dueDate: v }))} />
            </View>

            {/* Questions */}
            <View style={{ gap: 10 }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-gray-500 uppercase">Questions *</Text>
                <TouchableOpacity onPress={addQ}>
                  <Text className="text-sm text-blue-600 font-medium">+ Ajouter</Text>
                </TouchableOpacity>
              </View>

              {questions.map((q, i) => (
                <View key={i} className="bg-gray-50 rounded-2xl px-4 py-4 border border-gray-200" style={{ gap: 10 }}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-gray-700">Question {i + 1}</Text>
                    {questions.length > 1 && (
                      <TouchableOpacity onPress={() => removeQ(i)}>
                        <Text className="text-xs text-red-400">Supprimer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    className="bg-white rounded-xl px-4 py-3 text-gray-900 text-sm border border-gray-200"
                    placeholder="Votre question…"
                    value={q.text}
                    onChangeText={v => updateQ(i, 'text', v)}
                  />
                  <TouchableOpacity
                    className="bg-white rounded-xl px-4 py-3 flex-row items-center justify-between border border-gray-200"
                    onPress={() => setShowTypePicker(i)}
                  >
                    <Text className="text-sm text-gray-700">{QTYPES.find(t => t.key === q.type)?.label}</Text>
                    <Text className="text-gray-400">›</Text>
                  </TouchableOpacity>
                  {q.type === 'MULTIPLE_CHOICE' && (
                    <TextInput
                      className="bg-white rounded-xl px-4 py-3 text-sm text-gray-900 border border-gray-200"
                      placeholder="Option 1, Option 2, Option 3…"
                      onChangeText={v => updateQ(i, 'options', v.split(',').map(s => s.trim()).filter(Boolean))}
                    />
                  )}
                </View>
              ))}
            </View>

            {/* Actions */}
            <View className="flex-row" style={{ gap: 8 }}>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} className="flex-1 bg-gray-100 rounded-xl py-3 items-center">
                <Text className="text-gray-700 font-semibold">Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={saving || !canSave} className={`flex-1 rounded-xl py-3 items-center ${canSave ? 'bg-blue-600' : 'bg-blue-200'}`}>
                <Text className="text-white font-semibold">{saving ? 'Création...' : 'Créer'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 8 }} />
          </ScrollView>

          {showTypePicker !== null && (
            <PickerModal
              visible
              title="Type de question"
              options={QTYPES.map(t => t.label)}
              selected={QTYPES.find(t => t.key === questions[showTypePicker]?.type)?.label || ''}
              onSelect={label => {
                const found = QTYPES.find(t => t.label === label);
                if (found && showTypePicker !== null) updateQ(showTypePicker, 'type', found.key);
              }}
              onClose={() => setShowTypePicker(null)}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
