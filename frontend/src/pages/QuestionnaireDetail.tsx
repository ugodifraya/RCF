import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Questionnaire, Question } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function QuestionnaireDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isCoach } = useAuth();
  const navigate = useNavigate();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.get(`/questionnaires/${id}`).then(r => {
      setQuestionnaire(r.data);
      const myResponse = r.data.responses?.find((res: { userId: string }) => res.userId === user?.id);
      if (myResponse) {
        const ans: Record<string, string> = {};
        myResponse.answers?.forEach((a: { questionId: string; answer: string }) => { ans[a.questionId] = a.answer; });
        setAnswers(ans);
        setSubmitted(true);
      }
    });
  }, [id, user?.id]);

  const handleSubmit = async () => {
    if (!questionnaire) return;
    const answerList = questionnaire.questions?.map(q => ({ questionId: q.id, answer: answers[q.id] || '' })) || [];
    setSubmitting(true);
    try {
      await api.post(`/questionnaires/${id}/respond`, { answers: answerList });
      setSubmitted(true);
      api.get(`/questionnaires/${id}`).then(r => setQuestionnaire(r.data));
    } catch { } finally { setSubmitting(false); }
  };

  if (!questionnaire) return <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/questionnaires')} className="text-gray-400 hover:text-gray-600">
          ← Retour
        </button>
      </div>

      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl">📋</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{questionnaire.title}</h1>
            {questionnaire.description && <p className="text-gray-600 mt-1">{questionnaire.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
              <span>Par {questionnaire.createdBy?.firstName} {questionnaire.createdBy?.lastName}</span>
              <span>·</span>
              <span>{format(new Date(questionnaire.createdAt), 'd MMM yyyy', { locale: fr })}</span>
              {questionnaire.dueDate && (
                <><span>·</span><span className="text-orange-600">Avant le {format(new Date(questionnaire.dueDate), 'd MMM yyyy', { locale: fr })}</span></>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isCoach && (
        <div className="card space-y-6">
          {submitted && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">✓ Vous avez répondu à ce questionnaire</div>}
          {questionnaire.questions?.map((q, i) => (
            <QuestionField key={q.id} question={q} index={i} value={answers[q.id] || ''} onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))} disabled={submitted} />
          ))}
          {!submitted && (
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Envoi...' : 'Soumettre mes réponses'}
            </button>
          )}
        </div>
      )}

      {isCoach && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Réponses ({questionnaire.responses?.length ?? 0})
            </h2>
          </div>
          {questionnaire.responses?.length === 0 ? (
            <div className="card text-center py-8"><p className="text-gray-400">Aucune réponse pour l'instant</p></div>
          ) : (
            questionnaire.responses?.map(response => (
              <div key={response.id} className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-sm font-semibold">
                      {response.user?.firstName?.[0]}{response.user?.lastName?.[0]}
                    </div>
                    <span className="font-medium text-gray-900">{response.user?.firstName} {response.user?.lastName}</span>
                  </div>
                  <span className="text-xs text-gray-400">{format(new Date(response.submittedAt), 'd MMM yyyy à HH:mm', { locale: fr })}</span>
                </div>
                <div className="space-y-3">
                  {response.answers?.map(answer => (
                    <div key={answer.id} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">{answer.question?.text}</p>
                      <p className="text-sm text-gray-900">{answer.answer || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function QuestionField({ question, index, value, onChange, disabled }: {
  question: Question; index: number; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  const options = question.options ? JSON.parse(question.options) as string[] : [];

  return (
    <div>
      <label className="block font-medium text-gray-900 mb-2">
        <span className="text-gray-400 text-sm mr-1">{index + 1}.</span>
        {question.text}
      </label>
      {question.type === 'TEXT' && (
        <textarea className="input" rows={3} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder="Votre réponse..." />
      )}
      {question.type === 'YES_NO' && (
        <div className="flex gap-3">
          {['Oui', 'Non'].map(opt => (
            <button key={opt} type="button" disabled={disabled} onClick={() => onChange(opt)}
              className={`px-6 py-2 rounded-lg border text-sm font-medium transition-colors ${value === opt ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
      {question.type === 'SCALE' && (
        <div>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button key={n} type="button" disabled={disabled} onClick={() => onChange(String(n))}
                className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${value === String(n) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Faible</span><span>Excellent</span>
          </div>
        </div>
      )}
      {question.type === 'MULTIPLE_CHOICE' && (
        <div className="flex flex-wrap gap-2">
          {options.map((opt: string) => (
            <button key={opt} type="button" disabled={disabled} onClick={() => onChange(opt)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${value === opt ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
