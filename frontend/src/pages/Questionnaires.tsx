import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Questionnaire, QuestionType } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface QuestionDraft {
  text: string;
  type: QuestionType;
  options: string[];
  order: number;
}

export default function Questionnaires() {
  const { isCoach } = useAuth();
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', dueDate: '' });
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ text: '', type: 'TEXT', options: [], order: 1 }]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/questionnaires').then(r => setQuestionnaires(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const addQuestion = () => setQuestions(prev => [...prev, { text: '', type: 'TEXT', options: [], order: prev.length + 1 }]);
  const removeQuestion = (i: number) => setQuestions(prev => prev.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, order: idx + 1 })));

  const updateQuestion = (i: number, field: string, value: unknown) => {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  };

  const handleSave = async () => {
    if (!form.title || questions.some(q => !q.text)) return;
    setSaving(true);
    try {
      await api.post('/questionnaires', { ...form, questions });
      setShowForm(false);
      setForm({ title: '', description: '', dueDate: '' });
      setQuestions([{ text: '', type: 'TEXT', options: [], order: 1 }]);
      load();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Désactiver ce questionnaire ?')) return;
    await api.delete(`/questionnaires/${id}`);
    load();
  };

  const active = questionnaires.filter(q => q.isActive);
  const inactive = questionnaires.filter(q => !q.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Questionnaires</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isCoach ? 'Créez et suivez les questionnaires de votre équipe' : 'Questionnaires envoyés par votre coach'}
          </p>
        </div>
        {isCoach && (
          <button onClick={() => setShowForm(true)} className="btn-primary">+ Nouveau questionnaire</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>
      ) : (
        <>
          {active.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-500">Aucun questionnaire actif</p>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map(q => {
                const hasAnswered = !isCoach && (q.responses as {id:string}[]).length > 0;
                return (
                  <Link key={q.id} to={`/questionnaires/${q.id}`} className="card block hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-lg shrink-0">📋</div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{q.title}</h3>
                          {q.description && <p className="text-sm text-gray-500 mt-0.5">{q.description}</p>}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-gray-400">
                              Par {q.createdBy?.firstName} {q.createdBy?.lastName}
                            </span>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-400">
                              {format(new Date(q.createdAt), 'd MMM yyyy', { locale: fr })}
                            </span>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-400">{q._count?.questions ?? 0} question(s)</span>
                            {isCoach && <><span className="text-xs text-gray-400">·</span><span className="text-xs text-gray-400">{q._count?.responses ?? 0} réponse(s)</span></>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isCoach && (hasAnswered ? <span className="badge-green">Complété ✓</span> : <span className="badge-yellow">À faire</span>)}
                        {isCoach && (
                          <button onClick={e => { e.preventDefault(); handleDelete(q.id); }} className="text-red-400 hover:text-red-600 text-sm">Désactiver</button>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {isCoach && inactive.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">Questionnaires désactivés</h2>
              <div className="space-y-2">
                {inactive.map(q => (
                  <div key={q.id} className="card opacity-60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-base">📋</div>
                        <div>
                          <p className="font-medium text-gray-700 text-sm">{q.title}</p>
                          <p className="text-xs text-gray-400">{q._count?.responses ?? 0} réponse(s)</p>
                        </div>
                      </div>
                      <span className="badge-gray">Désactivé</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">Nouveau questionnaire</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="label">Titre *</label>
                <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Bilan de forme..." />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Contexte et instructions..." />
              </div>
              <div>
                <label className="label">Date limite (optionnel)</label>
                <input type="datetime-local" className="input" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="label mb-0">Questions *</label>
                  <button onClick={addQuestion} className="text-sm text-primary-600 hover:underline">+ Ajouter</button>
                </div>
                <div className="space-y-4">
                  {questions.map((q, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Question {i + 1}</span>
                        {questions.length > 1 && (
                          <button onClick={() => removeQuestion(i)} className="text-red-400 hover:text-red-600 text-sm">Supprimer</button>
                        )}
                      </div>
                      <input className="input" value={q.text} onChange={e => updateQuestion(i, 'text', e.target.value)} placeholder="Votre question..." />
                      <select className="input" value={q.type} onChange={e => updateQuestion(i, 'type', e.target.value)}>
                        <option value="TEXT">Texte libre</option>
                        <option value="SCALE">Échelle (1-10)</option>
                        <option value="YES_NO">Oui / Non</option>
                        <option value="MULTIPLE_CHOICE">Choix multiple</option>
                      </select>
                      {q.type === 'MULTIPLE_CHOICE' && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Options (séparées par des virgules)</p>
                          <input className="input" placeholder="Option 1, Option 2, Option 3..."
                            onChange={e => updateQuestion(i, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving || !form.title || questions.some(q => !q.text)} className="btn-primary flex-1">
                  {saving ? 'Création...' : 'Créer le questionnaire'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
