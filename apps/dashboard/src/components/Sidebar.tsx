import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, History,
  Settings, LogOut, Zap, Plug, FileText, Ticket,
  ShoppingBag, ShoppingCart,
} from 'lucide-react';

interface Props { onLogout: () => void }

// Links "flat" no topo
const topLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
];

// Subitens de Campanhas (agrupados visualmente)
const campaignLinks = [
  { to: '/campaigns/ml', label: 'Mercado Livre', icon: ShoppingCart, accent: 'text-yellow-400' },
  { to: '/campaigns/shopee', label: 'Shopee', icon: ShoppingBag, accent: 'text-orange-400' },
];

// Links "flat" abaixo
const bottomLinks = [
  { to: '/groups', label: 'Grupos', icon: Users },
  { to: '/coupons', label: 'Cupons', icon: Ticket },
  { to: '/history', label: 'Histórico', icon: History },
  { to: '/services', label: 'Serviços', icon: Plug },
  { to: '/logs', label: 'Logs', icon: FileText },
  { to: '/settings', label: 'Configurações', icon: Settings },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-600/20 text-brand-500'
      : 'text-gray-400 hover:text-white hover:bg-gray-800'
  }`;
}

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
          <p className="text-xs text-gray-500 mt-0.5">Afiliados</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {topLinks.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={navLinkClass}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}

        {/* Grupo Campanhas */}
        <div className="pt-3 pb-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            Campanhas
          </p>
        </div>
        {campaignLinks.map(({ to, label, icon: Icon, accent }) => (
          <NavLink key={to} to={to} className={navLinkClass}>
            <Icon size={17} className={accent} />
            {label}
          </NavLink>
        ))}

        {/* Resto flat */}
        <div className="pt-3" />
        {bottomLinks.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={navLinkClass}>
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
