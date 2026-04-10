import { useEffect, useState } from 'react';
import api from '../services/api';
import { Injury, User } from '../types';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CycleShared {
  id: string; startDate: string; endDate?: string; painLevel?: number;
  user: { id: string; firstName: string; lastName: string };
}

interface HealthData {
  summary: { totalPlayers: number; injuredCount: number; inCycleCount: number; availableCount: number };
  activeInjuries: (Injury & { user: User })[];
  recentInjuries: (Injury & { user: User })[];
  activeCycles: CycleShared[];
  allInjuries: (Injury & { user: User })[];
}

export default function HealthDashboard() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'injuries' | 'history'>('overview');

  const load = () => {
    setLoading(true);
    api.get('/health/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  };

  const markRecovered = async (injury: Injury) => {
    await api.put(`/injuries/${injury.id}`, {
      userId: injury.userId, type: injury.type, startDate: injury.startDate,
      endDate: new Date().toISOString().slice(0, 10), description: injury.description, status: 'RECOVERED',
    });
    load();
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>;
  if (!data) return null;

  const { summary, activeInjuries, recentInjuries, activeCycles, allInjuries } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>🏥</span> Tableau de bord Santé
        </h1>
        <p className="text-gray-500 text-sm mt-1">Vue d'ensemble de l'état de santé de l'équipe</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center bg-green-50 border-green-200">
          <p className="text-3xl font-bold text-green-600">{summary.availableCount}</p>
          <p className="text-sm text-gray-500 mt-1">Disponibles</p>
        </div>
        <div className={`card p-4 text-center ${summary.injuredCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
          <p className={`text-3xl font-bold ${summary.injuredCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{summary.injuredCount}</p>
          <p className="text-sm text-gray-500 mt-1">Blessées</p>
        </div>
        <div className={`card p-4 text-center ${summary.inCycleCount > 0 ? 'bg-pink-50 border-pink-200' : 'bg-gray-50'}`}>
          <p className={`text-3xl font-bold ${summary.inCycleCount > 0 ? 'text-pink-600' : 'text-gray-400'}`}>{summary.inCycleCount}</p>
          <p className="text-sm text-gray-500 mt-1">En période 🩸</p>
        </div>
        <div className="card p-4 text-center bg-blue-50 border-blue-200">
          <p className="text-3xl font-bold text-blue-600">{summary.totalPlayers}</p>
          <p className="text-sm text-gray-500 mt-1">Total joueuses</p>
        </div>
      </div>

      {/* Alertes actives */}
      {(activeInjuries.length > 0 || activeCycles.length > 0 || recentInjuries.length > 0) && (
        <div className="card border-orange-200 bg-orange-50">
          <h2 className="font-bold text-orange-800 flex items-center gap-2 mb-3">
            <span>🔔</span> Alertes actives
          </h2>
          <div className="space-y-2">
            {activeInjuries.map(inj => (
              <div key={inj.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-red-100">
                <span className="text-red-500">🤕</span>
                <span className="font-medium text-sm">{inj.user.firstName} {inj.user.lastName}</span>
                <span className="text-sm text-gray-600">— {inj.type}</span>
                <span className="ml-auto text-xs text-red-600 font-medium">
                  Depuis {differenceInDays(new Date(), new Date(inj.startDate))}j
                </span>
              </div>
            ))}
            {activeCycles.map(c => (
              <div key={c.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-pink-100">
                <span>🩸</span>
                <span className="font-medium text-sm">{c.user.firstName} {c.user.lastName}</span>
                <span className="text-sm text-gray-600">— En période</span>
                <span className="ml-auto text-xs text-pink-600">
                  Depuis le {format(new Date(c.startDate), 'd MMM', { locale: fr })}
                </span>
              </div>
            ))}
            {recentInjuries.filter(i => i.status === 'ACTIVE').length === 0 && recentInjuries.some(i => i.status === 'RECOVERED') && (
              <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-green-100">
                <span>✅</span>
                <span className="text-sm text-gray-600">
                  {recentInjuries.filter(i => i.status === 'RECOVERED').length} retour(s) de blessure cette semaine
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'overview', label: 'Vue d\'ensemble' },
          { key: 'injuries', label: `Blessures actives (${activeInjuries.length})` },
          { key: 'history', label: 'Historique' },
        ] as { key: typeof tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><span>🤕</span> Blessées en ce moment</h3>
            {activeInjuries.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Aucune blessure active 💪</p>
            ) : (
              <div className="space-y-2">
                {activeInjuries.map(inj => (
                  <div key={inj.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-xs font-bold">
                        {inj.user.firstName[0]}{inj.user.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{inj.user.firstName} {inj.user.lastName}</p>
                        <p className="text-xs text-red-600">{inj.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {differenceInDays(new Date(), new Date(inj.startDate))} jours
                      </p>
                      {inj.endDate && (
                        <p className="text-xs text-gray-400">
                          Retour : {format(new Date(inj.endDate), 'd MMM', { locale: fr })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><span>🩸</span> En période (partagé)</h3>
            {activeCycles.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">Aucune joueuse n'a partagé</p>
                <p className="text-xs text-gray-400 mt-1">Les joueuses peuvent choisir de partager leur état dans "Suivi santé"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeCycles.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-pink-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 text-xs font-bold">
                        {c.user.firstName[0]}{c.user.lastName[0]}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{c.user.firstName} {c.user.lastName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        Depuis le {format(new Date(c.startDate), 'd MMM', { locale: fr })}
                      </p>
                      {c.endDate && (
                        <p className="text-xs text-gray-400">
                          Fin prévue : {format(new Date(c.endDate), 'd MMM', { locale: fr })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3 italic">
              Seules les informations partagées volontairement par les joueuses sont visibles ici.
            </p>
          </div>
        </div>
      )}

      {/* Active injuries tab */}
      {tab === 'injuries' && (
        <div className="space-y-3">
          {activeInjuries.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-4xl mb-2">💪</p>
              <p className="text-gray-500">Aucune blessure active</p>
            </div>
          ) : activeInjuries.map(inj => (
            <div key={inj.id} className="card border-red-200">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold">
                    {inj.user.firstName[0]}{inj.user.lastName[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{inj.user.firstName} {inj.user.lastName}</p>
                    {inj.user.position && <p className="text-xs text-gray-400">{inj.user.position}</p>}
                    <p className="text-sm font-medium text-red-600 mt-1">{inj.type}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Depuis le {format(new Date(inj.startDate), 'd MMMM yyyy', { locale: fr })}
                      {' '}({differenceInDays(new Date(), new Date(inj.startDate))} jour{differenceInDays(new Date(), new Date(inj.startDate)) > 1 ? 's' : ''})
                    </p>
                    {inj.endDate && (
                      <p className="text-xs text-gray-400">Retour prévu : {format(new Date(inj.endDate), 'd MMMM yyyy', { locale: fr })}</p>
                    )}
                    {inj.description && <p className="text-xs text-gray-500 mt-1 italic">{inj.description}</p>}
                  </div>
                </div>
                <button onClick={() => markRecovered(inj)} className="btn-secondary text-xs py-1 px-2 text-green-700 border-green-300 hover:bg-green-50 shrink-0">
                  ✓ Rétablie
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Historique des blessures</h3>
          <div className="space-y-2">
            {allInjuries.map(inj => (
              <div key={inj.id} className={`flex items-center justify-between p-3 rounded-xl ${inj.status === 'ACTIVE' ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${inj.status === 'ACTIVE' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                    {inj.user.firstName[0]}{inj.user.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inj.user.firstName} {inj.user.lastName} — {inj.type}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(inj.startDate), 'd MMM yyyy', { locale: fr })}
                      {inj.endDate && ` → ${format(new Date(inj.endDate), 'd MMM yyyy', { locale: fr })}`}
                    </p>
                  </div>
                </div>
                <span className={inj.status === 'ACTIVE' ? 'badge-red' : 'badge-green'}>
                  {inj.status === 'ACTIVE' ? 'Active' : 'Rétablie'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
