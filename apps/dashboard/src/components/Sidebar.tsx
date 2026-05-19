import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Megaphone, Users, History,
  Settings, LogOut, Zap, Plug, FileText, Ticket,
} from 'lucide-react';

interface Props { onLogout: () => void }

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/campaigns', label: 'Campanhas', icon: Megaphone },
  { to: '/groups', label: 'Grupos', icon: Users },
  { to: '/coupons', label: 'Cupons', icon: Ticket },
  { to: '/history', label: 'Histórico', icon: History },
  { to: '/services', label: 'Serviços', icon: Plug },
  { to: '/logs', label: 'Logs', icon: FileText },
  { to: '/settings', label: 'Configurações', icon: Settings },
];

export function Sidebar({ onLogout }: Props) {
  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-none">WPP Bot</p>
          <p className="text-xs text-gray-500 mt-0.5">Afiliados ML</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600/20 text-brand-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-800">
        <button onClick={onLogout} className="btn-ghost w-full flex items-center gap-3 text-sm">
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
