import { useAuth } from '../context/AuthContext';

interface TopbarProps { onMenuClick: () => void; }

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();

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
        <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <button onClick={logout} className="text-gray-500 hover:text-gray-700 p-1" title="Déconnexion">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
