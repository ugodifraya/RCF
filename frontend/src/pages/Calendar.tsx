import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Event, EventType, AttendanceStatus, Match } from '../types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

const MATCH_COLOR_KEY = 'rcf_match_color';
const DEFAULT_MATCH_COLOR = '#16a34a'; // green-600

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Présente', ABSENT: 'Absente', MAYBE: 'Peut-être', PENDING: 'En attente',
};
const EVENT_TYPE_LABELS: Record<EventType, string> = {
  TRAINING: 'Entraînement', MATCH: 'Match', OTHER: 'Événement',
};

type CalItem =
  | { kind: 'event'; data: Event }
  | { kind: 'match'; data: Match };

type ViewMode = 'calendar' | 'list';
type ListFilter = 'upcoming' | 'past' | 'all';

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

export default function Calendar() {
  const { isCoach } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [listFilter, setListFilter] = useState<ListFilter>('upcoming');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [matchColor, setMatchColor] = useState(() => localStorage.getItem(MATCH_COLOR_KEY) || DEFAULT_MATCH_COLOR);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Event form state
  const [showEventForm, setShowEventForm] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [eventForm, setEventForm] = useState({ title: '', type: 'TRAINING', date: '', endDate: '', location: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Match form state
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [matchForm, setMatchForm] = useState({ date: '', opponent: '', location: '', homeAway: 'HOME', scoreHome: '', scoreAway: '', competition: '', notes: '' });
  const [savingMatch, setSavingMatch] = useState(false);


  const load = () => {
    setLoading(true);
    Promise.all([api.get('/events'), api.get('/matches')])
      .then(([eRes, mRes]) => { setEvents(eRes.data); setMatches(mRes.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveMatchColor = (color: string) => {
    setMatchColor(color);
    localStorage.setItem(MATCH_COLOR_KEY, color);
  };

  // Combine all items
  const allItems: CalItem[] = useMemo(() => {
    const evItems: CalItem[] = events.map(e => ({ kind: 'event', data: e }));
    const mItems: CalItem[] = matches.map(m => ({ kind: 'match', data: m }));
    return [...evItems, ...mItems].sort((a, b) => {
      const da = new Date(a.data.date).getTime();
      const db = new Date(b.data.date).getTime();
      return da - db;
    });
  }, [events, matches]);

  // Items for the selected day (calendar view)
  const dayItems = useMemo(() => {
    if (!selectedDay) return [];
    return allItems.filter(item => isSameDay(new Date(item.data.date), selectedDay));
  }, [allItems, selectedDay]);

  // Items map keyed by day string for calendar dots
  const itemsByDay = useMemo(() => {
    const map: Record<string, CalItem[]> = {};
    allItems.forEach(item => {
      const key = format(new Date(item.data.date), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [allItems]);

  // Calendar grid days
  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [currentMonth]);

  // List filtered items
  const listItems = useMemo(() => {
    const now = new Date();
    return allItems.filter(item => {
      const d = new Date(item.data.date);
      if (listFilter === 'upcoming') return d >= now;
      if (listFilter === 'past') return d < now;
      return true;
    });
  }, [allItems, listFilter]);

  // Event handlers
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

  const openEditEvent = (ev: Event) => {
    setEditEvent(ev);
    setEventForm({ title: ev.title, type: ev.type, date: ev.date.slice(0, 16), endDate: ev.endDate?.slice(0, 16) || '', location: ev.location || '', description: ev.description || '' });
    setShowEventForm(true);
  };

  const openEditMatch = (m: Match) => {
    setEditMatch(m);
    setMatchForm({ date: m.date.slice(0, 16), opponent: m.opponent, location: m.location || '', homeAway: m.homeAway, scoreHome: m.scoreHome?.toString() || '', scoreAway: m.scoreAway?.toString() || '', competition: m.competition || '', notes: m.notes || '' });
    setShowMatchForm(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title || !eventForm.date) return;
    setSaving(true);
    try {
      if (editEvent) { await api.put(`/events/${editEvent.id}`, eventForm); }
      else { await api.post('/events', eventForm); }
      setShowEventForm(false); setEditEvent(null);
      setEventForm({ title: '', type: 'TRAINING', date: '', endDate: '', location: '', description: '' });
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

  const setEF = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEventForm(prev => ({ ...prev, [f]: e.target.value }));
  const setMF = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setMatchForm(prev => ({ ...prev, [f]: e.target.value }));

  const itemColor = (item: CalItem) => {
    if (item.kind === 'match') return matchColor;
    const ev = item.data as Event;
    if (ev.type === 'TRAINING') return '#2563eb'; // blue
    if (ev.type === 'MATCH') return matchColor;
    return '#7c3aed'; // purple
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendrier</h1>
          <p className="text-gray-500 text-sm mt-1">Entraînements, matchs et événements</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isCoach && (
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(v => !v)}
                className="flex items-center gap-2 btn-secondary text-sm"
                title="Couleur des matchs"
              >
                <span className="w-4 h-4 rounded-full border border-white shadow" style={{ background: matchColor }} />
                Couleur matchs
              </button>
              {showColorPicker && (
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-20 space-y-2 w-48">
                  <p className="text-xs font-medium text-gray-600 mb-1">Couleur d'affichage des matchs</p>
                  <input
                    type="color"
                    value={matchColor}
                    onChange={e => saveMatchColor(e.target.value)}
                    className="w-full h-8 rounded cursor-pointer border border-gray-200"
                  />
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {['#16a34a','#2563eb','#dc2626','#d97706','#7c3aed','#0891b2','#be185d','#1f2937'].map(c => (
                      <button key={c} onClick={() => { saveMatchColor(c); setShowColorPicker(false); }}
                        className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
                        style={{ background: c, borderColor: matchColor === c ? '#111' : 'transparent' }}
                      />
                    ))}
                  </div>
                  <button onClick={() => setShowColorPicker(false)} className="text-xs text-gray-400 w-full text-center pt-1">Fermer</button>
                </div>
              )}
            </div>
          )}
          {isCoach && (
            <>
              <button onClick={() => { setEditMatch(null); setMatchForm({ date: '', opponent: '', location: '', homeAway: 'HOME', scoreHome: '', scoreAway: '', competition: '', notes: '' }); setShowMatchForm(true); }} className="btn-secondary text-sm">
                + Match
              </button>
              <button onClick={() => { setEditEvent(null); setEventForm({ title: '', type: 'TRAINING', date: '', endDate: '', location: '', description: '' }); setShowEventForm(true); }} className="btn-primary text-sm">
                + Événement
              </button>
            </>
          )}
        </div>
      </div>

      {/* View toggle */}
      <div className="flex bg-white rounded-xl border border-gray-200 p-1 gap-1 w-fit">
        <button onClick={() => setViewMode('calendar')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          📅 Calendrier
        </button>
        <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          📋 Liste
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>
      ) : viewMode === 'calendar' ? (
        <CalendarGrid
          days={calDays}
          currentMonth={currentMonth}
          selectedDay={selectedDay}
          itemsByDay={itemsByDay}
          itemColor={itemColor}
          onPrev={() => setCurrentMonth(m => subMonths(m, 1))}
          onNext={() => setCurrentMonth(m => addMonths(m, 1))}
          onSelectDay={day => setSelectedDay(prev => prev && isSameDay(prev, day) ? null : day)}
          dayItems={dayItems}
          isCoach={isCoach}
          matchColor={matchColor}
          onAttendance={handleAttendance}
          onEditEvent={openEditEvent}
          onDeleteEvent={handleDeleteEvent}
          onEditMatch={openEditMatch}
          onDeleteMatch={handleDeleteMatch}
        />
      ) : (
        <ListView
          items={listItems}
          filter={listFilter}
          onFilterChange={setListFilter}
          isCoach={isCoach}
          matchColor={matchColor}
          itemColor={itemColor}
          onAttendance={handleAttendance}
          onEditEvent={openEditEvent}
          onDeleteEvent={handleDeleteEvent}
          onEditMatch={openEditMatch}
          onDeleteMatch={handleDeleteMatch}
        />
      )}

      {/* Modal événement */}
      {showEventForm && (
        <Modal title={editEvent ? "Modifier l'événement" : 'Nouvel événement'} onClose={() => setShowEventForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Titre *</label>
              <input className="input" value={eventForm.title} onChange={setEF('title')} placeholder="Entraînement tactique" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type *</label>
                <select className="input" value={eventForm.type} onChange={setEF('type')}>
                  <option value="TRAINING">Entraînement</option>
                  <option value="MATCH">Match</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>
              <div>
                <label className="label">Lieu</label>
                <input className="input" value={eventForm.location} onChange={setEF('location')} placeholder="Stade..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date de début *</label>
                <input type="datetime-local" className="input" value={eventForm.date} onChange={setEF('date')} />
              </div>
              <div>
                <label className="label">Date de fin</label>
                <input type="datetime-local" className="input" value={eventForm.endDate} onChange={setEF('endDate')} />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={eventForm.description} onChange={setEF('description')} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSaveEvent} disabled={saving || !eventForm.title || !eventForm.date} className="btn-primary flex-1">
                {saving ? 'Enregistrement...' : editEvent ? 'Modifier' : 'Créer'}
              </button>
              <button onClick={() => setShowEventForm(false)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal match */}
      {showMatchForm && (
        <Modal title={editMatch ? 'Modifier le match' : 'Nouveau match'} onClose={() => setShowMatchForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Adversaire *</label>
              <input className="input" value={matchForm.opponent} onChange={setMF('opponent')} placeholder="FC Bordeaux" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date *</label>
                <input type="datetime-local" className="input" value={matchForm.date} onChange={setMF('date')} />
              </div>
              <div>
                <label className="label">Lieu</label>
                <input className="input" value={matchForm.location} onChange={setMF('location')} placeholder="Stade..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Dom. / Ext.</label>
                <select className="input" value={matchForm.homeAway} onChange={setMF('homeAway')}>
                  <option value="HOME">Domicile</option>
                  <option value="AWAY">Extérieur</option>
                  <option value="NEUTRAL">Neutre</option>
                </select>
              </div>
              <div>
                <label className="label">Compétition</label>
                <input className="input" value={matchForm.competition} onChange={setMF('competition')} placeholder="Championnat..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Score {matchForm.homeAway === 'HOME' ? 'RCF' : 'Adv'}</label>
                <input type="number" min="0" className="input" value={matchForm.scoreHome} onChange={setMF('scoreHome')} placeholder="0" />
              </div>
              <div>
                <label className="label">Score {matchForm.homeAway === 'HOME' ? 'Adv' : 'RCF'}</label>
                <input type="number" min="0" className="input" value={matchForm.scoreAway} onChange={setMF('scoreAway')} placeholder="0" />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={matchForm.notes} onChange={setMF('notes')} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSaveMatch} disabled={savingMatch || !matchForm.date || !matchForm.opponent} className="btn-primary flex-1">
                {savingMatch ? 'Enregistrement...' : editMatch ? 'Modifier' : 'Créer'}
              </button>
              <button onClick={() => setShowMatchForm(false)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

/* ─── Calendar Grid ─────────────────────────────────────────────────────── */

interface CalendarGridProps {
  days: Date[];
  currentMonth: Date;
  selectedDay: Date | null;
  itemsByDay: Record<string, CalItem[]>;
  itemColor: (item: CalItem) => string;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (d: Date) => void;
  dayItems: CalItem[];
  isCoach: boolean;
  matchColor: string;
  onAttendance: (id: string, s: AttendanceStatus) => void;
  onEditEvent: (e: Event) => void;
  onDeleteEvent: (id: string) => void;
  onEditMatch: (m: Match) => void;
  onDeleteMatch: (id: string) => void;
}

function CalendarGrid({ days, currentMonth, selectedDay, itemsByDay, itemColor, onPrev, onNext, onSelectDay, dayItems, isCoach, onAttendance, onEditEvent, onDeleteEvent, onEditMatch, onDeleteMatch }: CalendarGridProps) {
  const today = new Date();
  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 font-bold">‹</button>
          <h2 className="font-bold text-gray-900 capitalize">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</h2>
          <button onClick={onNext} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 font-bold">›</button>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const items = itemsByDay[key] || [];
            const isToday = isSameDay(day, today);
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            const inMonth = isSameMonth(day, currentMonth);
            const isPast = day < today;
            return (
              <button
                key={key}
                onClick={() => items.length > 0 || isToday ? onSelectDay(day) : undefined}
                className={`relative flex flex-col items-center p-1 rounded-lg min-h-[52px] transition-colors text-sm
                  ${isSelected ? 'bg-primary-100 ring-2 ring-primary-500' : isToday ? 'bg-primary-50' : 'hover:bg-gray-50'}
                  ${!inMonth ? 'opacity-30' : ''}
                `}
              >
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium
                  ${isToday ? 'bg-primary-600 text-white' : isPast && inMonth ? 'text-gray-400' : 'text-gray-700'}
                `}>
                  {format(day, 'd')}
                </span>
                {/* Dots */}
                {items.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-full">
                    {items.slice(0, 3).map((item, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: itemColor(item) }} />
                    ))}
                    {items.length > 3 && <span className="text-[9px] text-gray-400">+{items.length - 3}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 flex-wrap">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600" /><span className="text-xs text-gray-500">Entraînement</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600" /><span className="text-xs text-gray-500">Autre</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: itemColor({ kind: 'match', data: {} as Match }) }} /><span className="text-xs text-gray-500">Match</span></div>
        </div>
      </div>

      {/* Selected day items */}
      {selectedDay && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 capitalize">
            {format(selectedDay, 'EEEE d MMMM yyyy', { locale: fr })}
          </h3>
          {dayItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">Aucun événement ce jour</p>
          ) : (
            <div className="space-y-2">
              {dayItems.map((item, i) => (
                <CalItemCard key={i} item={item} isCoach={isCoach} itemColor={itemColor}
                  onAttendance={onAttendance} onEditEvent={onEditEvent} onDeleteEvent={onDeleteEvent}
                  onEditMatch={onEditMatch} onDeleteMatch={onDeleteMatch} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── List View ─────────────────────────────────────────────────────────── */

interface ListViewProps {
  items: CalItem[];
  filter: ListFilter;
  onFilterChange: (f: ListFilter) => void;
  isCoach: boolean;
  matchColor: string;
  itemColor: (item: CalItem) => string;
  onAttendance: (id: string, s: AttendanceStatus) => void;
  onEditEvent: (e: Event) => void;
  onDeleteEvent: (id: string) => void;
  onEditMatch: (m: Match) => void;
  onDeleteMatch: (id: string) => void;
}

function ListView({ items, filter, onFilterChange, isCoach, itemColor, onAttendance, onEditEvent, onDeleteEvent, onEditMatch, onDeleteMatch }: ListViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['upcoming', 'all', 'past'] as ListFilter[]).map(f => (
          <button key={f} onClick={() => onFilterChange(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>
            {f === 'upcoming' ? 'À venir' : f === 'past' ? 'Passés' : 'Tous'}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-500">Aucun élément {filter === 'upcoming' ? 'à venir' : filter === 'past' ? 'passé' : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <CalItemCard key={i} item={item} isCoach={isCoach} itemColor={itemColor}
              onAttendance={onAttendance} onEditEvent={onEditEvent} onDeleteEvent={onDeleteEvent}
              onEditMatch={onEditMatch} onDeleteMatch={onDeleteMatch} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Item Card ─────────────────────────────────────────────────────────── */

interface CalItemCardProps {
  item: CalItem;
  isCoach: boolean;
  itemColor: (item: CalItem) => string;
  onAttendance: (id: string, s: AttendanceStatus) => void;
  onEditEvent: (e: Event) => void;
  onDeleteEvent: (id: string) => void;
  onEditMatch: (m: Match) => void;
  onDeleteMatch: (id: string) => void;
}

function CalItemCard({ item, isCoach, itemColor, onAttendance, onEditEvent, onDeleteEvent, onEditMatch, onDeleteMatch }: CalItemCardProps) {
  const color = itemColor(item);
  const fg = contrastColor(color);

  if (item.kind === 'match') {
    const m = item.data;
    const result = getMatchResult(m);
    const isPast = new Date(m.date) < new Date();
    return (
      <div className="card hover:shadow-md transition-shadow overflow-hidden" style={{ borderLeft: `4px solid ${color}` }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: color, color: fg }}>
            ⚽
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm">RCF vs {m.opponent}</p>
                  {result && <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${result.cls}`}>{result.label}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {format(new Date(m.date), 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}
                  {m.location && ` · ${m.location}`}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: `${color}22`, color }}>Match</span>
                  {m.competition && <span className="text-xs text-gray-400">{m.competition}</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${m.homeAway === 'HOME' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                    {m.homeAway === 'HOME' ? 'Domicile' : m.homeAway === 'AWAY' ? 'Extérieur' : 'Neutre'}
                  </span>
                  {isPast && m.scoreHome != null && (
                    <span className="text-xs font-bold text-gray-700">
                      {m.homeAway === 'HOME' ? m.scoreHome : m.scoreAway} – {m.homeAway === 'HOME' ? m.scoreAway : m.scoreHome}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link to={`/matches/${m.id}`} className="btn-secondary text-xs py-1 px-2">Détails</Link>
                {isCoach && (
                  <>
                    <button onClick={() => onEditMatch(m)} className="btn-secondary text-xs py-1 px-2">Modifier</button>
                    <button onClick={() => onDeleteMatch(m.id)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Event
  const ev = item.data as Event;
  return (
    <div className="card hover:shadow-md transition-shadow" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: color, color: fg }}>
          {ev.type === 'TRAINING' ? '🏃' : ev.type === 'MATCH' ? '⚽' : '📌'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{ev.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {format(new Date(ev.date), 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}
                {ev.location && ` · ${ev.location}`}
              </p>
              <span className="text-xs px-1.5 py-0.5 rounded font-medium mt-1 inline-block" style={{ background: `${color}22`, color }}>
                {EVENT_TYPE_LABELS[ev.type]}
              </span>
              {ev.description && <p className="text-xs text-gray-500 mt-1">{ev.description}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {!isCoach && (
                <div className="flex gap-1">
                  {(['PRESENT', 'MAYBE', 'ABSENT'] as AttendanceStatus[]).map(s => (
                    <button key={s} onClick={() => onAttendance(ev.id, s)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                        ev.attendances?.[0]?.status === s
                          ? s === 'PRESENT' ? 'bg-green-600 text-white border-green-600'
                            : s === 'ABSENT' ? 'bg-red-600 text-white border-red-600'
                            : 'bg-yellow-500 text-white border-yellow-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
              {isCoach && (
                <>
                  <span className="text-xs text-gray-400">{ev._count?.attendances ?? 0} rép.</span>
                  <button onClick={() => onEditEvent(ev)} className="btn-secondary text-xs py-1 px-2">Modifier</button>
                  <button onClick={() => onDeleteEvent(ev.id)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal ─────────────────────────────────────────────────────────────── */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
