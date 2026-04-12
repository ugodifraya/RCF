import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface SidebarProps { open: boolean; onClose: () => void; }

const playerNav = [
  { to: '/', icon: '🏠', label: 'Tableau de bord' },
  { to: '/calendrier', icon: '📅', label: 'Calendrier' },
  { to: '/questionnaires', icon: '📋', label: 'Questionnaires' },
  { to: '/health', icon: '🩸', label: 'Suivi santé' },
  { to: '/statistics', icon: '📊', label: 'Mes statistiques' },
  { to: '/performance', icon: '⚡', label: 'Performance' },
];

const coachNav = [
  { to: '/', icon: '🏠', label: 'Tableau de bord' },
  { to: '/calendrier', icon: '📅', label: 'Calendrier' },
  { to: '/questionnaires', icon: '📋', label: 'Questionnaires' },
  { to: '/health-dashboard', icon: '🏥', label: 'Santé équipe' },
  { to: '/statistics', icon: '📊', label: 'Statistiques' },
  { to: '/players', icon: '👥', label: 'Joueuses' },
  { to: '/performance', icon: '⚡', label: 'Performance' },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { isCoach } = useAuth();
  const nav = isCoach ? coachNav : playerNav;

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={onClose} />}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        w-64 bg-white border-r border-gray-200
        flex flex-col transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">R</div>
          <div>
            <p className="font-bold text-gray-900">RCF</p>
            <p className="text-xs text-gray-500">Team Manager</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
