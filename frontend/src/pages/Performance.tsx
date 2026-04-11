import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const TEST_TYPES = [
  { label: 'VMA', unit: 'km/h' },
  { label: 'Test Cooper', unit: 'm' },
  { label: 'Détente verticale', unit: 'cm' },
  { label: 'Sprint 30m', unit: 's' },
  { label: 'Yo-Yo test', unit: 'niveau' },
  { label: 'VO2 max', unit: 'ml/kg/min' },
  { label: 'Gainage', unit: 'sec' },
  { label: 'Souplesse', unit: 'cm' },
];

interface Measurement { id: string; weight?: number; height?: number; date: string; }
interface PerfTest { id: string; type: string; value: number; unit: string; date: string; notes?: string; }
interface PlayerPerf {
  id: string; firstName: string; lastName: string; position?: string; number?: number; avatarUrl?: string;
  latestMeasurement?: { weight?: number; height?: number; date: string } | null;
  weightDiff?: number | null; heightDiff?: number | null;
  tests: Record<string, { value: number; unit: string; date: string }>;
  allTests: PerfTest[];
}

interface User { id: string; firstName: string; lastName: string; }

export default function Performance() {
  const { isCoach } = useAuth();

  if (isCoach) return <CoachPerformance />;
  return <PlayerPerformance />;
}

// ─── VUE COACH ────────────────────────────────────────────────────────────────

function CoachPerformance() {
  const [players, setPlayers] = useState<PlayerPerf[]>([]);
  const [allPlayers, setAllPlayers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PlayerPerf | null>(null);
  const [selectedMeasurements, setSelectedMeasurements] = useState<Measurement[]>([]);
  const [selectedTests, setSelectedTests] = useState<PerfTest[]>([]);
  const [showTestForm, setShowTestForm] = useState(false);
  const [testForm, setTestForm] = useState({ userId: '', type: 'VMA', value: '', unit: 'km/h', date: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/performance/dashboard'), api.get('/users/players')])
      .then(([d, p]) => { setPlayers(d.data); setAllPlayers(p.data); })
      .finally(() => setLoading(false));
  };

  const selectPlayer = async (p: PlayerPerf) => {
    setSelected(p);
    const [m, t] = await Promise.all([
      api.get(`/performance/player/${p.id}/measurements`),
      api.get(`/performance/player/${p.id}/tests`),
    ]);
    setSelectedMeasurements(m.data);
    setSelectedTests(t.data);
  };

  useEffect(() => { load(); }, []);

  const saveTest = async () => {
    if (!testForm.userId || !testForm.type || !testForm.value || !testForm.date) return;
    setSaving(true);
    try {
      await api.post('/performance/tests', testForm);
      setShowTestForm(false);
      setTestForm({ userId: '', type: 'VMA', value: '', unit: 'km/h', date: '', notes: '' });
      load();
      if (selected && testForm.userId === selected.id) {
        const t = await api.get(`/performance/player/${selected.id}/tests`);
        setSelectedTests(t.data);
      }
    } catch { } finally { setSaving(false); }
  };

  const deleteTest = async (id: string) => {
    if (!confirm('Supprimer ce test ?')) return;
    await api.delete(`/performance/tests/${id}`);
    if (selected) {
      const t = await api.get(`/performance/player/${selected.id}/tests`);
      setSelectedTests(t.data);
    }
    load();
  };

  const setT = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setTestForm(p => {
      const next = { ...p, [f]: e.target.value };
      if (f === 'type') {
        const found = TEST_TYPES.find(t => t.label === e.target.value);
        if (found) next.unit = found.unit;
      }
      return next;
    });
  };

  // Prépare chart data pour mesures physiques
  const weightChartData = selectedMeasurements.filter(m => m.weight).map(m => ({
    date: format(new Date(m.date), 'MMM yy', { locale: fr }),
    Poids: m.weight,
  }));
  const heightChartData = selectedMeasurements.filter(m => m.height).map(m => ({
    date: format(new Date(m.date), 'MMM yy', { locale: fr }),
    Taille: m.height,
  }));

  const testTypes = [...new Set(selectedTests.map(t => t.type))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⚡ Performance</h1>
          <p className="text-gray-500 text-sm mt-1">Données physiques et tests athlétiques des joueuses</p>
        </div>
        <button onClick={() => setShowTestForm(true)} className="btn-primary">+ Saisir un test</button>
      </div>

      {/* Tableau récap joueuses */}
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-gray-900 mb-3">Vue d'ensemble</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                <th className="text-left py-2 pr-4">Joueuse</th>
                <th className="text-center px-3">Taille</th>
                <th className="text-center px-3">Poids</th>
                <th className="text-center px-3">Évol. poids</th>
                <th className="text-center px-3">VMA</th>
                <th className="text-center px-3">Cooper</th>
                <th className="text-center px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {players.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => selectPlayer(p)}>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-xs font-bold text-primary-700">
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                        {p.position && <p className="text-xs text-gray-400">{p.position}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="text-center px-3 text-gray-700">{p.latestMeasurement?.height ? `${p.latestMeasurement.height} cm` : '—'}</td>
                  <td className="text-center px-3 text-gray-700">{p.latestMeasurement?.weight ? `${p.latestMeasurement.weight} kg` : '—'}</td>
                  <td className="text-center px-3">
                    {p.weightDiff !== null && p.weightDiff !== undefined ? (
                      <span className={`text-xs font-semibold ${p.weightDiff > 0 ? 'text-orange-600' : p.weightDiff < 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {p.weightDiff > 0 ? `▲ +${p.weightDiff}` : p.weightDiff < 0 ? `▼ ${p.weightDiff}` : '= 0'} kg
                      </span>
                    ) : '—'}
                  </td>
                  <td className="text-center px-3 text-gray-700">{p.tests['VMA'] ? `${p.tests['VMA'].value} km/h` : '—'}</td>
                  <td className="text-center px-3 text-gray-700">{p.tests['Test Cooper'] ? `${p.tests['Test Cooper'].value} m` : '—'}</td>
                  <td className="text-center px-3"><button className="text-xs text-primary-600 hover:underline">Voir →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Détail joueuse sélectionnée */}
      {selected && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-lg">{selected.firstName} {selected.lastName}</h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          {/* Évolution poids/taille */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {weightChartData.length > 1 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Évolution du poids (kg)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={weightChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="Poids" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {heightChartData.length > 1 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Évolution taille (cm)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={heightChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="Taille" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tests par type */}
          {testTypes.map(type => {
            const typeTests = selectedTests.filter(t => t.type === type).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const chartData = typeTests.map(t => ({ date: format(new Date(t.date), 'dd/MM/yy'), [type]: t.value }));
            return (
              <div key={type}>
                <h3 className="text-sm font-medium text-gray-700 mb-2">{type} ({typeTests[0]?.unit})</h3>
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey={type} stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    {typeTests[0]?.value} {typeTests[0]?.unit} — {format(new Date(typeTests[0]?.date), 'd MMM yyyy', { locale: fr })}
                  </p>
                )}
                <div className="mt-2 space-y-1">
                  {typeTests.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs text-gray-500 hover:bg-gray-50 rounded px-2 py-1">
                      <span>{format(new Date(t.date), 'd MMM yyyy', { locale: fr })}</span>
                      <span className="font-medium text-gray-800">{t.value} {t.unit}</span>
                      {t.notes && <span className="italic text-gray-400">{t.notes}</span>}
                      <button onClick={() => deleteTest(t.id)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {selectedTests.length === 0 && selectedMeasurements.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">Aucune donnée enregistrée pour cette joueuse</p>
          )}
        </div>
      )}

      {/* Modal nouveau test */}
      {showTestForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Saisir un test</h2>
              <button onClick={() => setShowTestForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Joueuse *</label>
                <select className="input" value={testForm.userId} onChange={setT('userId')}>
                  <option value="">Choisir...</option>
                  {allPlayers.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type de test *</label>
                  <select className="input" value={testForm.type} onChange={setT('type')}>
                    {TEST_TYPES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Date *</label>
                  <input type="date" className="input" value={testForm.date} onChange={setT('date')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valeur *</label>
                  <input type="number" step="0.01" className="input" value={testForm.value} onChange={setT('value')} placeholder="Ex: 14.5" />
                </div>
                <div>
                  <label className="label">Unité</label>
                  <input className="input" value={testForm.unit} onChange={setT('unit')} />
                </div>
              </div>
              <div><label className="label">Notes</label><input className="input" value={testForm.notes} onChange={setT('notes')} placeholder="Conditions, remarques..." /></div>
              <div className="flex gap-2">
                <button onClick={saveTest} disabled={saving || !testForm.userId || !testForm.value || !testForm.date} className="btn-primary flex-1">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button onClick={() => setShowTestForm(false)} className="btn-secondary flex-1">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VUE JOUEUSE ─────────────────────────────────────────────────────────────

function PlayerPerformance() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [tests, setTests] = useState<PerfTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ weight: '', height: '', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/performance/my-measurements'), api.get('/performance/my-tests')])
      .then(([m, t]) => { setMeasurements(m.data); setTests(t.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Détection relance mensuelle
  const lastMeasurement = measurements[0];
  const daysSinceLast = lastMeasurement ? Math.floor((Date.now() - new Date(lastMeasurement.date).getTime()) / 86400000) : null;
  const needsUpdate = daysSinceLast === null || daysSinceLast >= 28;

  const saveMeasurement = async () => {
    if (!form.date) return;
    setSaving(true);
    try {
      await api.post('/performance/measurements', form);
      setShowForm(false);
      setForm({ weight: '', height: '', date: new Date().toISOString().slice(0, 10) });
      load();
    } catch { } finally { setSaving(false); }
  };

  const weightData = [...measurements].reverse().filter(m => m.weight).map(m => ({
    date: format(new Date(m.date), 'MMM yy', { locale: fr }), Poids: m.weight,
  }));
  const heightData = [...measurements].reverse().filter(m => m.height).map(m => ({
    date: format(new Date(m.date), 'MMM yy', { locale: fr }), Taille: m.height,
  }));

  const [prev, latest] = [measurements[1], measurements[0]];
  const weightDiff = latest?.weight && prev?.weight ? +(latest.weight - prev.weight).toFixed(1) : null;
  const heightDiff = latest?.height && prev?.height ? +(latest.height - prev.height).toFixed(1) : null;

  const testTypes = [...new Set(tests.map(t => t.type))];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">⚡ Mes performances</h1>
        <p className="text-gray-500 text-sm mt-1">Suivi de vos données physiques et tests athlétiques</p>
      </div>

      {/* Rappel mensuel */}
      {needsUpdate && (
        <div className="card bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📏</span>
              <div>
                <p className="font-semibold text-amber-800">Mise à jour mensuelle</p>
                <p className="text-sm text-amber-700">
                  {daysSinceLast === null ? 'Renseignez votre taille et poids pour la première fois' : `Dernière saisie il y a ${daysSinceLast} jours — mettez à jour !`}
                </p>
              </div>
            </div>
            <button onClick={() => setShowForm(true)} className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Mettre à jour
            </button>
          </div>
        </div>
      )}

      {/* KPIs actuels */}
      {latest && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-primary-600">{latest.height ?? '—'} <span className="text-lg text-gray-400">cm</span></p>
            <p className="text-sm text-gray-500 mt-1">Taille actuelle</p>
            {heightDiff !== null && heightDiff !== 0 && (
              <p className={`text-xs font-medium mt-1 ${heightDiff > 0 ? 'text-green-600' : 'text-blue-600'}`}>
                {heightDiff > 0 ? `▲ +${heightDiff}` : `▼ ${heightDiff}`} cm ce mois
              </p>
            )}
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-orange-600">{latest.weight ?? '—'} <span className="text-lg text-gray-400">kg</span></p>
            <p className="text-sm text-gray-500 mt-1">Poids actuel</p>
            {weightDiff !== null && weightDiff !== 0 && (
              <p className={`text-xs font-medium mt-1 ${weightDiff > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                {weightDiff > 0 ? `▲ +${weightDiff}` : `▼ ${weightDiff}`} kg ce mois
              </p>
            )}
          </div>
        </div>
      )}

      {!needsUpdate && <div className="flex justify-end"><button onClick={() => setShowForm(true)} className="btn-secondary text-sm">Mettre à jour poids/taille</button></div>}

      {/* Graphiques */}
      {loading ? <Spinner /> : (
        <>
          {weightData.length > 1 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Évolution du poids</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Poids" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tests athlétiques */}
          {testTypes.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Tests athlétiques</h3>
              <div className="space-y-4">
                {testTypes.map(type => {
                  const typeTests = tests.filter(t => t.type === type).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                  const latest = typeTests[typeTests.length - 1];
                  return (
                    <div key={type} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{type}</span>
                        <span className="text-lg font-bold text-primary-600">{latest.value} <span className="text-sm text-gray-400">{latest.unit}</span></span>
                      </div>
                      <p className="text-xs text-gray-400">Dernier test : {format(new Date(latest.date), 'd MMMM yyyy', { locale: fr })}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {measurements.length === 0 && tests.length === 0 && (
            <div className="card text-center py-10"><p className="text-4xl mb-2">📊</p><p className="text-gray-500">Aucune donnée enregistrée</p></div>
          )}
        </>
      )}

      {/* Modal saisie poids/taille */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Mise à jour physique</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="label">Date *</label><input type="date" className="input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Poids (kg)</label><input type="number" step="0.1" className="input" value={form.weight} onChange={e => setForm(p => ({ ...p, weight: e.target.value }))} placeholder="Ex: 62.5" /></div>
                <div><label className="label">Taille (cm)</label><input type="number" step="0.5" className="input" value={form.height} onChange={e => setForm(p => ({ ...p, height: e.target.value }))} placeholder="Ex: 168" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveMeasurement} disabled={saving} className="btn-primary flex-1">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() { return <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>; }
