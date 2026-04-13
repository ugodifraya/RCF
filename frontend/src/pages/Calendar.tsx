import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Event, AttendanceStatus, Match, getEventColor, COLOR_KEYS, DEFAULT_COLORS } from '../types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

/* ─── Types ─────────────────────────────────────────────────────────────── */

type CalItem =
  | { kind: 'event'; data: Event }
  | { kind: 'match'; data: Match }
  | { kind: 'birthday'; data: { id: string; firstName: string; lastName: string; birthDate: string } };

type ViewMode = 'calendar' | 'list';
type ListFilter = 'upcoming' | 'past' | 'all';

type EventSubtype = 'TRAINING' | 'INTERNAL' | 'FRIENDLY' | 'CHAMPIONSHIP' | 'CUP' | 'TOURNAMENT' | 'OTHER';

interface EventFormState {
  title: string;
  type: EventSubtype;
  date: string;
  endDate: string;
  meetingTime: string;
  location: string;
  description: string;
  opponent: string;
  roundNumber: string;
  homeAway: string;
  showAdvanced: boolean;
}

/* ─── Constantes ─────────────────────────────────────────────────────────── */

const EVENT_TYPES: { key: EventSubtype; label: string; icon: string; desc: string }[] = [
  { key: 'TRAINING',      label: 'Entraînement',          icon: '🏃', desc: 'Session d\'entraînement' },
  { key: 'INTERNAL',      label: 'Match entre nous',       icon: '👕', desc: 'Match interne' },
  { key: 'FRIENDLY',      label: 'Match amical',           icon: '🤝', desc: 'Rencontre amicale' },
  { key: 'CHAMPIONSHIP',  label: 'Match de championnat',   icon: '🏆', desc: 'Compétition officielle' },
  { key: 'CUP',           label: 'Match de coupe',         icon: '🥊', desc: 'Coupe officielle' },
  { key: 'TOURNAMENT',    label: 'Tournoi',                icon: '🏅', desc: 'Tournoi' },
  { key: 'OTHER',         label: 'Autre événement',        icon: '📌', desc: 'Réunion, sortie…' },
];

const TYPE_LABEL: Record<string, string> = {
  TRAINING: 'Entraînement', INTERNAL: 'Match entre nous', FRIENDLY: 'Match amical',
  CHAMPIONSHIP: 'Match de championnat', CUP: 'Match de coupe',
  TOURNAMENT: 'Tournoi', OTHER: 'Autre événement',
};

const MATCH_SUBTYPES: EventSubtype[] = ['INTERNAL', 'FRIENDLY', 'CHAMPIONSHIP', 'CUP'];
const isMatchSubtype = (t: string) => MATCH_SUBTYPES.includes(t as EventSubtype);
const needsOpponent = (t: string) => ['INTERNAL', 'FRIENDLY', 'CHAMPIONSHIP', 'CUP'].includes(t);
const needsRound = (t: string) => ['CHAMPIONSHIP', 'CUP'].includes(t);
const needsCompetition = (t: string) => ['CHAMPIONSHIP', 'CUP'].includes(t);

const EMPTY_FORM: EventFormState = {
  title: '', type: 'TRAINING', date: '', endDate: '', meetingTime: '',
  location: '', description: '', opponent: '', roundNumber: '', homeAway: 'HOME', showAdvanced: false,
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function contrastColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#1f2937' : '#ffffff';
}

function getMatchResult(m: Match) {
  if (m.scoreHome == null || m.scoreAway == null) return null;
  const ours = m.homeAway === 'HOME' ? m.scoreHome : m.scoreAway;
  const theirs = m.homeAway === 'HOME' ? m.scoreAway : m.scoreHome;
  if (ours > theirs) return { label: 'V', cls: 'bg-green-100 text-green-800' };
  if (ours < theirs) return { label: 'D', cls: 'bg-red-100 text-red-800' };
  return { label: 'N', cls: 'bg-gray-100 text-gray-800' };
}

function itemColor(item: CalItem): string {
  if (item.kind === 'birthday') return '#f43f5e';
  if (item.kind === 'match') return localStorage.getItem(COLOR_KEYS.MATCH) || DEFAULT_COLORS.MATCH;
  return getEventColor(item.data.type);
}

function birthdayDateForYear(birthDate: string, year: number): Date {
  const d = new Date(birthDate);
  return new Date(year, d.getMonth(), d.getDate());
}

/* ─── Composant principal ────────────────────────────────────────────────── */

export default function Calendar() {
  const { isCoach } = useAuth();

  // Data
  const [events, setEvents] = useState<Event[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [birthdays, setBirthdays] = useState<{ id: string; firstName: string; lastName: string; birthDate: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // View
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [listFilter, setListFilter] = useState<ListFilter>('upcoming');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Color picker panel
  const [showColorPanel, setShowColorPanel] = useState(false);
  const [colors, setColors] = useState({
    training: localStorage.getItem(COLOR_KEYS.TRAINING) || DEFAULT_COLORS.TRAINING,
    match:    localStorage.getItem(COLOR_KEYS.MATCH)    || DEFAULT_COLORS.MATCH,
    tournament: localStorage.getItem(COLOR_KEYS.TOURNAMENT) || DEFAULT_COLORS.TOURNAMENT,
    other:    localStorage.getItem(COLOR_KEYS.OTHER)    || DEFAULT_COLORS.OTHER,
  });

  // Event creation: step 1 = type picker, step 2 = form
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [eventForm, setEventForm] = useState<EventFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Match form (legacy match model)
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [matchForm, setMatchForm] = useState({ date: '', opponent: '', location: '', homeAway: 'HOME', scoreHome: '', scoreAway: '', competition: '', notes: '' });
  const [savingMatch, setSavingMatch] = useState(false);

  // Notify
  const [notifying, setNotifying] = useState<string | null>(null);

  /* ── Chargement ── */
  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/events'),
      api.get('/matches'),
      api.get('/events/birthdays'),
    ]).then(([eRes, mRes, bRes]) => {
      setEvents(eRes.data);
      setMatches(mRes.data);
      setBirthdays(bRes.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  /* ── Couleurs ── */
  const saveColor = (key: keyof typeof colors, storageKey: string, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
    localStorage.setItem(storageKey, value);
  };

  /* ── Items combinés ── */
  const allItems: CalItem[] = useMemo(() => {
    const now = new Date();
    const year = currentMonth.getFullYear();
    const prevYear = year - 1;
    const nextYear = year + 1;

    const evItems: CalItem[] = events.map(e => ({ kind: 'event', data: e }));
    const mItems: CalItem[]  = matches.map(m => ({ kind: 'match', data: m }));

    // Anniversaires pour l'année en cours ±1
    const bItems: CalItem[] = [];
    for (const b of birthdays) {
      for (const y of [prevYear, year, nextYear]) {
        const d = birthdayDateForYear(b.birthDate, y);
        if (d <= new Date(now.getFullYear() + 1, 11, 31)) {
          bItems.push({ kind: 'birthday', data: { ...b, birthDate: d.toISOString() } });
        }
      }
    }

    const getDate = (item: CalItem) =>
      item.kind === 'birthday' ? item.data.birthDate : item.data.date;

    return [...evItems, ...mItems, ...bItems].sort((a, b) =>
      new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime()
    );
  }, [events, matches, birthdays, currentMonth]);

  const dayItems = useMemo(() => {
    if (!selectedDay) return [];
    return allItems.filter(item => {
      const d = item.kind === 'birthday' ? item.data.birthDate : item.data.date;
      return isSameDay(new Date(d), selectedDay);
    });
  }, [allItems, selectedDay]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, CalItem[]> = {};
    allItems.forEach(item => {
      const d = item.kind === 'birthday' ? item.data.birthDate : item.data.date;
      const key = format(new Date(d), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [allItems]);

  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [currentMonth]);

  const listItems = useMemo(() => {
    const now = new Date();
    return allItems.filter(item => {
      const d = new Date(item.kind === 'birthday' ? item.data.birthDate : item.data.date);
      if (listFilter === 'upcoming') return d >= now;
      if (listFilter === 'past') return d < now;
      return true;
    });
  }, [allItems, listFilter]);

  /* ── Handlers ── */
  const handleAttendance = async (eventId: string, status: AttendanceStatus) => {
    await api.post(`/events/${eventId}/attendance`, { status });
    load();
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Supprimer cet événement ?')) return;
    await api.delete(`/events/${id}`);
    load();
  };

  const handleDeleteMatch = async (id: string) => {
    if (!confirm('Supprimer ce match ?')) return;
    await api.delete(`/matches/${id}`);
    load();
  };

  const openTypePicker = () => {
    setEditEvent(null);
    setEventForm(EMPTY_FORM);
    setShowTypePicker(true);
  };

  const selectType = (type: EventSubtype) => {
    setShowTypePicker(false);
    setEventForm({ ...EMPTY_FORM, type });
    setShowEventForm(true);
  };

  const openEditEvent = (ev: Event) => {
    setEditEvent(ev);
    setEventForm({
      title: ev.title,
      type: (ev.subtype || ev.type) as EventSubtype,
      date: ev.date.slice(0, 16),
      endDate: ev.endDate?.slice(0, 16) || '',
      meetingTime: ev.meetingTime?.slice(0, 16) || '',
      location: ev.location || '',
      description: ev.description || '',
      opponent: ev.opponent || '',
      roundNumber: ev.roundNumber || '',
      homeAway: 'HOME',
      showAdvanced: false,
    });
    setShowEventForm(true);
  };

  const openEditMatch = (m: Match) => {
    setEditMatch(m);
    setMatchForm({ date: m.date.slice(0, 16), opponent: m.opponent, location: m.location || '', homeAway: m.homeAway, scoreHome: m.scoreHome?.toString() || '', scoreAway: m.scoreAway?.toString() || '', competition: m.competition || '', notes: m.notes || '' });
    setShowMatchForm(true);
  };

  const handleSaveEvent = async () => {
    const { type, title, date, endDate, meetingTime, location, description, opponent, roundNumber, homeAway } = eventForm;
    const finalTitle = title || (needsOpponent(type) && opponent ? `vs ${opponent}` : TYPE_LABEL[type]);
    if (!finalTitle || !date) return;
    setSaving(true);
    try {
      const payload = {
        title: finalTitle,
        type: isMatchSubtype(type) ? 'MATCH' : type === 'TOURNAMENT' ? 'TOURNAMENT' : type === 'TRAINING' ? 'TRAINING' : 'OTHER',
        subtype: type,
        date, endDate: endDate || null, meetingTime: meetingTime || null,
        location: location || null, description: description || null,
        opponent: opponent || null, roundNumber: roundNumber || null,
      };
      if (editEvent) { await api.put(`/events/${editEvent.id}`, payload); }
      else { await api.post('/events', payload); }
      setShowEventForm(false);
      setEditEvent(null);
      setEventForm(EMPTY_FORM);
      load();
    } catch { } finally { setSaving(false); }
  };

  const handleSaveMatch = async () => {
    if (!matchForm.date || !matchForm.opponent) return;
    setSavingMatch(true);
    try {
      if (editMatch) { await api.put(`/matches/${editMatch.id}`, matchForm); }
      else { await api.post('/matches', matchForm); }
      setShowMatchForm(false); setEditMatch(null);
      setMatchForm({ date: '', opponent: '', location: '', homeAway: 'HOME', scoreHome: '', scoreAway: '', competition: '', notes: '' });
      load();
    } catch { } finally { setSavingMatch(false); }
  };

  const handleNotify = async (eventId: string) => {
    setNotifying(eventId);
    try {
      const r = await api.post(`/events/${eventId}/notify-pending`);
      alert(`${r.data.notified} joueuse(s) relancée(s) !`);
    } catch { } finally { setNotifying(null); }
  };

  const setEF = (f: keyof EventFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEventForm(prev => ({ ...prev, [f]: e.target.value }));
  const setMF = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setMatchForm(prev => ({ ...prev, [f]: e.target.value }));

  /* ── Render ── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendrier</h1>
          <p className="text-gray-500 text-sm mt-1">Entraînements, matchs, événements et anniversaires</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Color panel */}
          <div className="relative">
            <button onClick={() => setShowColorPanel(v => !v)} className="btn-secondary text-sm flex items-center gap-2" title="Couleurs par type">
              <span className="flex gap-0.5">
                {[colors.training, colors.match, colors.tournament, colors.other].map((c, i) => (
                  <span key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
                ))}
              </span>
              Couleurs
            </button>
            {showColorPanel && (
              <div className="absolute right-0 top-11 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 z-30 w-72 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Couleurs par type d'événement</p>
                {[
                  { label: 'Entraînement', icon: '🏃', key: 'training' as const, sk: COLOR_KEYS.TRAINING, def: DEFAULT_COLORS.TRAINING },
                  { label: 'Match',        icon: '⚽', key: 'match' as const,    sk: COLOR_KEYS.MATCH,     def: DEFAULT_COLORS.MATCH },
                  { label: 'Tournoi',      icon: '🏅', key: 'tournament' as const, sk: COLOR_KEYS.TOURNAMENT, def: DEFAULT_COLORS.TOURNAMENT },
                  { label: 'Autre',        icon: '📌', key: 'other' as const,    sk: COLOR_KEYS.OTHER,     def: DEFAULT_COLORS.OTHER },
                ].map(({ label, icon, key, sk, def }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-base w-6">{icon}</span>
                    <span className="text-sm text-gray-700 flex-1">{label}</span>
                    <div className="flex gap-1">
                      {['#2563eb','#16a34a','#dc2626','#d97706','#7c3aed','#0891b2','#be185d'].map(c => (
                        <button key={c} onClick={() => saveColor(key, sk, c)}
                          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                          style={{ background: c, borderColor: colors[key] === c ? '#111' : 'transparent' }} />
                      ))}
                    </div>
                    <input type="color" value={colors[key]} onChange={e => saveColor(key, sk, e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                  </div>
                ))}
                <button onClick={() => setShowColorPanel(false)} className="text-xs text-gray-400 w-full text-center pt-1 hover:text-gray-600">Fermer</button>
              </div>
            )}
          </div>

          {isCoach && (
            <>
              <button onClick={() => { setEditMatch(null); setMatchForm({ date: '', opponent: '', location: '', homeAway: 'HOME', scoreHome: '', scoreAway: '', competition: '', notes: '' }); setShowMatchForm(true); }}
                className="btn-secondary text-sm">+ Résultat</button>
              <button onClick={openTypePicker} className="btn-primary text-sm">+ Événement</button>
            </>
          )}
        </div>
      </div>

      {/* View toggle */}
      <div className="flex bg-white rounded-xl border border-gray-200 p-1 gap-1 w-fit">
        <button onClick={() => setViewMode('calendar')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          📅 Calendrier
        </button>
        <button onClick={() => setViewMode('list')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          📋 Liste
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>
      ) : viewMode === 'calendar' ? (
        <CalendarGrid
          days={calDays} currentMonth={currentMonth} selectedDay={selectedDay}
          itemsByDay={itemsByDay} onPrev={() => setCurrentMonth(m => subMonths(m, 1))}
          onNext={() => setCurrentMonth(m => addMonths(m, 1))}
          onSelectDay={day => setSelectedDay(prev => prev && isSameDay(prev, day) ? null : day)}
          dayItems={dayItems} isCoach={isCoach} colors={colors}
          onAttendance={handleAttendance} onEditEvent={openEditEvent}
          onDeleteEvent={handleDeleteEvent} onEditMatch={openEditMatch}
          onDeleteMatch={handleDeleteMatch} onNotify={handleNotify} notifying={notifying}
        />
      ) : (
        <ListView
          items={listItems} filter={listFilter} onFilterChange={setListFilter}
          isCoach={isCoach} colors={colors}
          onAttendance={handleAttendance} onEditEvent={openEditEvent}
          onDeleteEvent={handleDeleteEvent} onEditMatch={openEditMatch}
          onDeleteMatch={handleDeleteMatch} onNotify={handleNotify} notifying={notifying}
        />
      )}

      {/* ── Modals (Parties 2 & 3) ── */}
      {showTypePicker && <TypePickerModal onSelect={selectType} onClose={() => setShowTypePicker(false)} />}
      {showEventForm && (
        <EventFormModal
          form={eventForm} setForm={setEF} onSave={handleSaveEvent}
          onClose={() => { setShowEventForm(false); setEditEvent(null); }}
          saving={saving} isEdit={!!editEvent}
        />
      )}
      {showMatchForm && (
        <MatchFormModal
          form={matchForm} setForm={setMF} onSave={handleSaveMatch}
          onClose={() => { setShowMatchForm(false); setEditMatch(null); }}
          saving={savingMatch} isEdit={!!editMatch}
        />
      )}
    </div>
  );
}

/* ─── Modal wrapper ──────────────────────────────────────────────────────── */

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ─── TypePickerModal ────────────────────────────────────────────────────── */

function TypePickerModal({ onSelect, onClose }: { onSelect: (t: EventSubtype) => void; onClose: () => void }) {
  return (
    <Modal title="Quel type d'événement ?" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-5">Choisissez le type pour adapter le formulaire.</p>
      <div className="grid grid-cols-2 gap-3">
        {EVENT_TYPES.map(({ key, label, icon, desc }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl border-2 border-gray-100 hover:border-primary-400 hover:bg-primary-50 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-primary-100 flex items-center justify-center text-xl transition-colors">
              {icon}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ─── EventFormModal ─────────────────────────────────────────────────────── */

function EventFormModal({
  form, setForm, onSave, onClose, saving, isEdit,
}: {
  form: EventFormState;
  setForm: (f: keyof EventFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  isEdit: boolean;
}) {
  const [showAdv, setShowAdv] = useState(false);
  const { type } = form;
  const typeInfo = EVENT_TYPES.find(t => t.key === type);
  const isMatch = isMatchSubtype(type);
  const isTournament = type === 'TOURNAMENT';
  const hasOpponent = needsOpponent(type);
  const hasCompetition = needsCompetition(type);

  const canSave = !!form.date && (hasOpponent ? !!form.opponent || !!form.title : !!form.title || type === 'TRAINING' || isTournament);

  return (
    <Modal title={isEdit ? `Modifier — ${typeInfo?.label ?? ''}` : `Créer — ${typeInfo?.label ?? ''}`} onClose={onClose} wide>
      <div className="space-y-5">

        {/* Type badge */}
        <div className="flex items-center gap-2 pb-1">
          <span className="text-xl">{typeInfo?.icon}</span>
          <span className="text-sm font-semibold text-gray-700">{typeInfo?.label}</span>
        </div>

        {/* Opponent — prominently shown for match types */}
        {hasOpponent && (
          <div>
            <label className="label">Adversaire *</label>
            <input className="input text-base" placeholder="Nom de l'équipe adverse" value={form.opponent} onChange={setForm('opponent')} />
          </div>
        )}

        {/* Title — optional for match types, required for others */}
        {(!hasOpponent || type === 'TRAINING' || isTournament) && (
          <div>
            <label className="label">{hasOpponent ? 'Titre (optionnel)' : 'Titre' + (type !== 'TRAINING' ? ' *' : '')}</label>
            <input className="input" placeholder={
              type === 'TRAINING' ? 'Ex: Entraînement physique' :
              isTournament ? 'Ex: Tournoi de printemps' :
              'Titre de l\'événement'
            } value={form.title} onChange={setForm('title')} />
          </div>
        )}

        {/* Title override for match types */}
        {hasOpponent && (
          <div>
            <label className="label">Titre personnalisé <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <input className="input" placeholder={`Laissez vide → "vs ${form.opponent || 'Adversaire'}"`} value={form.title} onChange={setForm('title')} />
          </div>
        )}

        {/* Competition + Round */}
        {hasCompetition && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Compétition</label>
              <input className="input" placeholder="Ex: Nationale 2" value={form.roundNumber ? '' : ''} />
            </div>
            <div>
              <label className="label">Journée / Tour</label>
              <input className="input" placeholder="Ex: J12 ou 1/8" value={form.roundNumber} onChange={setForm('roundNumber')} />
            </div>
          </div>
        )}

        {/* Home / Away */}
        {isMatch && (
          <div>
            <label className="label">Lieu de réception</label>
            <div className="flex gap-2">
              {[{ v: 'HOME', label: '🏠 Domicile' }, { v: 'AWAY', label: '✈️ Extérieur' }, { v: 'NEUTRAL', label: '⚖️ Neutre' }].map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm('homeAway')({ target: { value: v } } as React.ChangeEvent<HTMLInputElement>)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${form.homeAway === v ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date principale */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date et heure *</label>
            <input type="datetime-local" className="input" value={form.date} onChange={setForm('date')} />
          </div>
          {(isTournament || showAdv) && (
            <div>
              <label className="label">Date de fin</label>
              <input type="datetime-local" className="input" value={form.endDate} onChange={setForm('endDate')} />
            </div>
          )}
        </div>

        {/* Heure de RDV */}
        <div>
          <label className="label">Heure de RDV <span className="text-gray-400 font-normal">(optionnel)</span></label>
          <input type="datetime-local" className="input" value={form.meetingTime} onChange={setForm('meetingTime')} />
          <p className="text-xs text-gray-400 mt-1">L'heure à laquelle les joueuses doivent se retrouver</p>
        </div>

        {/* Lieu */}
        <div>
          <label className="label">Lieu <span className="text-gray-400 font-normal">(optionnel)</span></label>
          <input className="input" placeholder="Ex: Complexe sportif de la Plaine" value={form.location} onChange={setForm('location')} />
        </div>

        {/* Toggle avancé */}
        <button
          type="button"
          onClick={() => setShowAdv(v => !v)}
          className="text-xs text-primary-600 hover:underline flex items-center gap-1"
        >
          {showAdv ? '▲ Moins d\'options' : '▼ Plus d\'options'}
        </button>

        {showAdv && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            {!isTournament && (
              <div>
                <label className="label">Date de fin</label>
                <input type="datetime-local" className="input" value={form.endDate} onChange={setForm('endDate')} />
              </div>
            )}
            <div>
              <label className="label">Description / Notes</label>
              <textarea className="input resize-none" rows={3} placeholder="Informations complémentaires..." value={form.description} onChange={setForm('description')} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onSave}
            disabled={saving || !canSave}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Créer l\'événement'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── MatchFormModal ─────────────────────────────────────────────────────── */

function MatchFormModal({
  form, setForm, onSave, onClose, saving, isEdit,
}: {
  form: { date: string; opponent: string; location: string; homeAway: string; scoreHome: string; scoreAway: string; competition: string; notes: string };
  setForm: (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  isEdit: boolean;
}) {
  return (
    <Modal title={isEdit ? 'Modifier le résultat' : 'Ajouter un résultat'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Adversaire *</label>
          <input className="input" placeholder="Nom de l'équipe adverse" value={form.opponent} onChange={setForm('opponent')} />
        </div>
        <div>
          <label className="label">Date et heure *</label>
          <input type="datetime-local" className="input" value={form.date} onChange={setForm('date')} />
        </div>
        <div>
          <label className="label">Compétition</label>
          <input className="input" placeholder="Ex: Nationale 2" value={form.competition} onChange={setForm('competition')} />
        </div>
        <div>
          <label className="label">Lieu</label>
          <input className="input" placeholder="Stade, complexe…" value={form.location} onChange={setForm('location')} />
        </div>
        <div>
          <label className="label">Réception</label>
          <div className="flex gap-2">
            {[{ v: 'HOME', label: '🏠 Domicile' }, { v: 'AWAY', label: '✈️ Extérieur' }, { v: 'NEUTRAL', label: '⚖️ Neutre' }].map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => setForm('homeAway')({ target: { value: v } } as React.ChangeEvent<HTMLInputElement>)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${form.homeAway === v ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Score</label>
          <div className="flex items-center gap-3">
            <input type="number" min="0" className="input text-center text-xl font-bold" placeholder="0" value={form.scoreHome} onChange={setForm('scoreHome')} />
            <span className="text-xl font-bold text-gray-400">–</span>
            <input type="number" min="0" className="input text-center text-xl font-bold" placeholder="0" value={form.scoreAway} onChange={setForm('scoreAway')} />
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center">Score domicile – Score extérieur</p>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2} placeholder="Commentaire, rapport…" value={form.notes} onChange={setForm('notes')} />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onSave} disabled={saving || !form.date || !form.opponent} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Enregistrer'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Shared props ───────────────────────────────────────────────────────── */

interface SharedCalProps {
  isCoach: boolean;
  onAttendance: (eventId: string, status: AttendanceStatus) => void;
  onEditEvent: (ev: Event) => void;
  onDeleteEvent: (id: string) => void;
  onEditMatch: (m: Match) => void;
  onDeleteMatch: (id: string) => void;
  onNotify: (eventId: string) => void;
  notifying: string | null;
}

/* ─── CalItemCard ────────────────────────────────────────────────────────── */

function CalItemCard({ item, isCoach, onAttendance, onEditEvent, onDeleteEvent, onEditMatch, onDeleteMatch, onNotify, notifying }: SharedCalProps & { item: CalItem }) {
  const { user } = useAuth();
  const color = itemColor(item);

  /* Birthday */
  if (item.kind === 'birthday') {
    const b = item.data;
    return (
      <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
        <span className="text-2xl">🎂</span>
        <div>
          <p className="font-semibold text-gray-900">{b.firstName} {b.lastName}</p>
          <p className="text-xs text-rose-400">Anniversaire</p>
        </div>
      </div>
    );
  }

  /* Match (legacy) */
  if (item.kind === 'match') {
    const m = item.data;
    const result = getMatchResult(m);
    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="h-1 w-full" style={{ background: color }} />
        <div className="px-4 py-3 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">vs {m.opponent}</span>
              {result && <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${result.cls}`}>{result.label}</span>}
              <span className="text-xs text-gray-400">{m.homeAway === 'HOME' ? '🏠' : m.homeAway === 'AWAY' ? '✈️' : '⚖️'}</span>
            </div>
            {(m.scoreHome != null || m.scoreAway != null) && (
              <p className="text-sm font-bold text-gray-700 mt-0.5">{m.scoreHome ?? '–'} – {m.scoreAway ?? '–'}</p>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-gray-400">{format(new Date(m.date), 'HH:mm')}</span>
              {m.location && <span className="text-xs text-gray-400">📍 {m.location}</span>}
              {m.competition && <span className="text-xs text-gray-400">🏆 {m.competition}</span>}
            </div>
          </div>
          {isCoach && (
            <div className="flex flex-col items-end gap-1 shrink-0">
              <button onClick={() => onEditMatch(m)} className="text-xs text-primary-600 hover:underline">Modifier</button>
              <button onClick={() => onDeleteMatch(m.id)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* Event */
  const ev = item.data;
  const myAtt = ev.attendances?.find(a => a.userId === user?.id);
  const pendingCount = ev.attendances?.filter(a => a.status === 'PENDING').length ?? 0;
  const attStyle: Record<AttendanceStatus, string> = {
    PRESENT: 'bg-green-100 text-green-700 border-green-200',
    ABSENT:  'bg-red-100 text-red-700 border-red-200',
    MAYBE:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    PENDING: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  const attLabel: Record<AttendanceStatus, string> = {
    PRESENT: '✓ Présente', ABSENT: '✗ Absente', MAYBE: '? Peut-être', PENDING: '– En attente',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="h-1 w-full" style={{ background: color }} />
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">{ev.title}</span>
              <span className="text-xs px-2 py-0.5 rounded-full text-white shrink-0"
                style={{ background: color, color: contrastColor(color) }}>
                {TYPE_LABEL[ev.subtype || ev.type] || ev.type}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-gray-400">{format(new Date(ev.date), 'HH:mm')}</span>
              {ev.meetingTime && (
                <span className="text-xs text-amber-600 font-medium">
                  RDV {format(new Date(ev.meetingTime), 'HH:mm')}
                </span>
              )}
              {ev.location && <span className="text-xs text-gray-400">📍 {ev.location}</span>}
            </div>
          </div>
          {isCoach && (
            <div className="flex flex-col items-end gap-1 shrink-0">
              <button onClick={() => onEditEvent(ev)} className="text-xs text-primary-600 hover:underline">Modifier</button>
              <button onClick={() => onDeleteEvent(ev.id)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
            </div>
          )}
        </div>

        {/* Présence — joueuse */}
        {!isCoach && myAtt && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${attStyle[myAtt.status]}`}>
              {attLabel[myAtt.status]}
            </span>
            <div className="flex gap-1">
              {(['PRESENT', 'ABSENT', 'MAYBE'] as AttendanceStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => onAttendance(ev.id, s)}
                  className={`text-xs px-2.5 py-1 rounded-lg border-2 font-medium transition-colors ${myAtt.status === s ? 'border-transparent text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  style={myAtt.status === s ? { background: color } : {}}
                >
                  {s === 'PRESENT' ? '✓' : s === 'ABSENT' ? '✗' : '?'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Relancer — coach */}
        {isCoach && pendingCount > 0 && (
          <div className="mt-2">
            <button
              onClick={() => onNotify(ev.id)}
              disabled={notifying === ev.id}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              {notifying === ev.id ? 'Envoi...' : `🔔 Relancer ${pendingCount} sans réponse`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CalendarGrid ───────────────────────────────────────────────────────── */

const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function CalendarGrid({
  days, currentMonth, selectedDay, itemsByDay, onPrev, onNext, onSelectDay, dayItems,
  colors: _colors, ...shared
}: SharedCalProps & {
  days: Date[];
  currentMonth: Date;
  selectedDay: Date | null;
  itemsByDay: Record<string, CalItem[]>;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (d: Date) => void;
  dayItems: CalItem[];
  colors: object;
}) {
  const today = new Date();

  return (
    <div className="space-y-4">
      {/* Navigation mois */}
      <div className="flex items-center justify-between">
        <button onClick={onPrev}
          className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-50 transition-colors">
          ‹
        </button>
        <h2 className="font-bold text-gray-900 text-lg capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </h2>
        <button onClick={onNext}
          className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-50 transition-colors">
          ›
        </button>
      </div>

      {/* Grille */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DOW.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = format(day, 'yyyy-MM-dd');
            const items = itemsByDay[key] || [];
            const isToday = isSameDay(day, today);
            const isSelected = !!selectedDay && isSameDay(day, selectedDay);
            const inMonth = isSameMonth(day, currentMonth);
            const hasBirthday = items.some(it => it.kind === 'birthday');
            const dotItems = items.filter(it => it.kind !== 'birthday');

            return (
              <button
                key={i}
                onClick={() => onSelectDay(day)}
                className={`relative min-h-[56px] p-1 border-b border-r border-gray-50 flex flex-col items-center transition-colors hover:bg-gray-50
                  ${!inMonth ? 'opacity-30' : ''}
                  ${isSelected ? 'bg-primary-50' : ''}
                `}
              >
                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm mb-0.5
                  ${isToday ? 'bg-primary-600 text-white font-bold' : isSelected ? 'text-primary-700 font-bold' : 'text-gray-700'}
                `}>
                  {format(day, 'd')}
                </span>
                {hasBirthday && <span className="text-xs leading-none mb-0.5">🎂</span>}
                {dotItems.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center">
                    {dotItems.slice(0, 3).map((it, j) => (
                      <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: itemColor(it) }} />
                    ))}
                    {dotItems.length > 3 && (
                      <span className="text-gray-400 text-xs leading-none">+{dotItems.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panneau jour sélectionné */}
      {selectedDay && (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-700 capitalize">
            {format(selectedDay, 'EEEE d MMMM', { locale: fr })}
          </h3>
          {dayItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun événement ce jour.</p>
          ) : (
            dayItems.map((item, i) => (
              <CalItemCard key={i} item={item} {...shared} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── ListView ───────────────────────────────────────────────────────────── */

function ListView({
  items, filter, onFilterChange, colors: _colors, ...shared
}: SharedCalProps & {
  items: CalItem[];
  filter: ListFilter;
  onFilterChange: (f: ListFilter) => void;
  colors: object;
}) {
  const grouped = useMemo(() => {
    const map: { key: string; label: string; items: CalItem[] }[] = [];
    const seen: Record<string, number> = {};
    for (const item of items) {
      const raw = item.kind === 'birthday' ? item.data.birthDate : item.data.date;
      const d = new Date(raw);
      const key = format(d, 'yyyy-MM-dd');
      if (seen[key] == null) {
        seen[key] = map.length;
        map.push({ key, label: format(d, 'EEEE d MMMM yyyy', { locale: fr }), items: [] });
      }
      map[seen[key]].items.push(item);
    }
    return map;
  }, [items]);

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex bg-white rounded-xl border border-gray-200 p-1 gap-1 w-fit">
        {([['upcoming', 'À venir'], ['past', 'Passés'], ['all', 'Tous']] as [ListFilter, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => onFilterChange(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === v ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-gray-400 text-sm">
            {filter === 'upcoming' ? 'Aucun événement à venir' : filter === 'past' ? 'Aucun événement passé' : 'Aucun événement'}
          </p>
        </div>
      ) : (
        grouped.map(({ key, label, items: gItems }) => (
          <div key={key} className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide capitalize">{label}</h3>
            {gItems.map((item, i) => (
              <CalItemCard key={i} item={item} {...shared} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
