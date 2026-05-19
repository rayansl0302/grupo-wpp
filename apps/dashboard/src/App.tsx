import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Sidebar } from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import Groups from './pages/Groups';
import History from './pages/History';
import Settings from './pages/Settings';
import Services from './pages/Services';
import Logs from './pages/Logs';
import Coupons from './pages/Coupons';

function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar onLogout={onLogout} />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/history" element={<History />} />
          <Route path="/services" element={<Services />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/coupons" element={<Coupons />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { user, login, logout } = useAuth();

  if (!user) return <Login onLogin={login} />;

  return (
    <BrowserRouter>
      <Layout onLogout={logout} />
    </BrowserRouter>
  );
}
