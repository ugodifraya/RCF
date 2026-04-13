import { useState, useEffect } from 'react';
import { COLOR_KEYS, DEFAULT_COLORS } from '../types';

const PRESETS = ['#2563eb','#16a34a','#dc2626','#d97706','#7c3aed','#0891b2','#be185d','#059669','#f59e0b','#6366f1'];

const UI_COLOR_KEY = 'rcf_ui_primary';
const DEFAULT_UI_COLOR = '#2563eb';

interface ColorRowProps {
  label: string;
  icon: string;
  storageKey: string;
  defaultColor: string;
}

function ColorRow({ label, icon, storageKey, defaultColor }: ColorRowProps) {
  const [color, setColor] = useState(() => localStorage.getItem(storageKey) || defaultColor);

  const save = (c: string) => {
    setColor(c);
    localStorage.setItem(storageKey, c);
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: `${color}22` }}>
          {icon}
        </div>
        <span className="text-sm font-medium text-gray-800">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {PRESETS.map(c => (
            <button
              key={c}
              onClick={() => save(c)}
              className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{ background: c, borderColor: color === c ? '#111' : 'transparent' }}
            />
          ))}
        </div>
        <input
          type="color"
          value={color}
          onChange={e => save(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border border-gray-200 p-0"
          title="Couleur personnalisée"
        />
      </div>
    </div>
  );
}

export default function PlayerSettings() {
  const [uiColor, setUiColor] = useState(() => localStorage.getItem(UI_COLOR_KEY) || DEFAULT_UI_COLOR);
  const [saved, setSaved] = useState(false);

  // Apply CSS variable when color changes
  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', uiColor);
  }, [uiColor]);

  const saveUiColor = (c: string) => {
    setUiColor(c);
    localStorage.setItem(UI_COLOR_KEY, c);
    document.documentElement.style.setProperty('--color-primary', c);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Personnalisation</h1>
        <p className="text-gray-500 text-sm mt-1">Personnalisez les couleurs de votre interface</p>
      </div>

      {/* Couleur principale de l'interface */}
      <div className="card space-y-4">
        <div>
          <h2 className="font-bold text-gray-900">Couleur principale</h2>
          <p className="text-xs text-gray-500 mt-0.5">Couleur des boutons, liens et éléments actifs</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map(c => (
              <button
                key={c}
                onClick={() => saveUiColor(c)}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: uiColor === c ? '#111' : 'transparent' }}
              />
            ))}
          </div>
          <input
            type="color"
            value={uiColor}
            onChange={e => saveUiColor(e.target.value)}
            className="w-9 h-9 rounded cursor-pointer border border-gray-200 p-0"
          />
          <button
            onClick={() => saveUiColor(DEFAULT_UI_COLOR)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Réinitialiser
          </button>
        </div>
        {saved && <p className="text-xs text-green-600 font-medium">Couleur enregistrée !</p>}

        {/* Aperçu */}
        <div className="rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Aperçu</p>
          <div className="flex gap-2 flex-wrap">
            <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: uiColor }}>
              Bouton principal
            </button>
            <button className="px-4 py-2 rounded-lg text-sm font-medium border" style={{ color: uiColor, borderColor: uiColor }}>
              Bouton secondaire
            </button>
          </div>
          <p className="text-sm" style={{ color: uiColor }}>Lien cliquable</p>
        </div>
      </div>

      {/* Couleurs du calendrier */}
      <div className="card space-y-1">
        <div className="mb-3">
          <h2 className="font-bold text-gray-900">Couleurs du calendrier</h2>
          <p className="text-xs text-gray-500 mt-0.5">Chaque type d'événement a sa propre couleur</p>
        </div>
        <ColorRow label="Entraînement" icon="🏃" storageKey={COLOR_KEYS.TRAINING} defaultColor={DEFAULT_COLORS.TRAINING} />
        <ColorRow label="Match (champ., amical, coupe…)" icon="⚽" storageKey={COLOR_KEYS.MATCH} defaultColor={DEFAULT_COLORS.MATCH} />
        <ColorRow label="Tournoi" icon="🏅" storageKey={COLOR_KEYS.TOURNAMENT} defaultColor={DEFAULT_COLORS.TOURNAMENT} />
        <ColorRow label="Autre événement" icon="📌" storageKey={COLOR_KEYS.OTHER} defaultColor={DEFAULT_COLORS.OTHER} />
      </div>

      <p className="text-xs text-gray-400 text-center">
        Les couleurs sont enregistrées localement sur cet appareil.
      </p>
    </div>
  );
}
