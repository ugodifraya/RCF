import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface TopbarProps { onMenuClick: () => void; }

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout, isCoach } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [latestMeasurement, setLatestMeasurement] = useState<{ weight?: number | null; height?: number | null } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!isCoach) {
      api.get('/performance/my-measurements').then(r => {
        if (r.data?.length > 0) setLatestMeasurement(r.data[0]);
      }).catch(() => {});
    }
  }, [isCoach]);

  const goProfile = () => { setMenuOpen(false); navigate('/profile'); };
  const doLogout = () => { setMenuOpen(false); logout(); };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="md:hidden p-1 rounded-md text-gray-500 hover:bg-gray-100">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">R</div>
          <span className="font-bold text-gray-900 hidden sm:block">RCF Team Manager</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
          <p className="text-xs text-gray-500">{user?.role === 'PLAYER' ? 'Joueuse' : user?.role === 'COACH' ? 'Coach' : 'Admin'}</p>
        </div>

        {/* Avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="focus:outline-none"
            title="Mon compte"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-9 h-9 rounded-full object-cover border-2 border-primary-200 hover:border-primary-400 transition-colors" />
            ) : (
              <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm hover:bg-primary-200 transition-colors cursor-pointer">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-gray-400 mb-1">{user?.email}</p>
                {/* Poids / taille dernière saisie (joueuses uniquement) */}
                {!isCoach && latestMeasurement && (latestMeasurement.weight || latestMeasurement.height) && (
                  <div className="flex gap-3 mt-2">
                    {latestMeasurement.weight && (
                      <div className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                        <span>⚖️</span>
                        <span className="font-medium">{latestMeasurement.weight} kg</span>
                      </div>
                    )}
                    {latestMeasurement.height && (
                      <div className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">
                        <span>📏</span>
                        <span className="font-medium">{latestMeasurement.height} cm</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={goProfile}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <span>👤</span> Mon profil
              </button>
              {!isCoach && (
                <button
                  onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span>🎨</span> Personnaliser
                </button>
              )}
              <button
                onClick={doLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <span>🚪</span> Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
