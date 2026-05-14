import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Megaphone, Users, Send, Package, TrendingUp, AlertCircle,
} from 'lucide-react';
import { dashApi, type Stats, type ChartPoint } from '../services/api';

function StatCard({
  label, value, sub, icon: Icon, color = 'brand',
}: {
  label: string; value: number | string; sub?: string;
  icon: React.ElementType; color?: 'brand' | 'blue' | 'purple' | 'orange';
}) {
  const colors = {
    brand: 'text-brand-500 bg-brand-900/50',
    blue: 'text-blue-400 bg-blue-950/60',
    purple: 'text-purple-400 bg-purple-950/60',
    orange: 'text-orange-400 bg-orange-950/60',
  };
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);

  useEffect(() => {
    dashApi.stats().then((r) => setStats(r.data));
    dashApi.chart().then((r) => setChart(r.data));
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Carregando...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão geral da automação</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Campanhas ativas"
          value={stats.campaigns.active}
          sub={`${stats.campaigns.total} total`}
          icon={Megaphone}
          color="brand"
        />
        <StatCard
          label="Grupos ativos"
          value={stats.groups.active}
          sub={`${stats.groups.total} cadastrados`}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Enviados hoje"
          value={stats.posts.today}
          sub={`${stats.posts.total} total`}
          icon={Send}
          color="purple"
        />
        <StatCard
          label="Produtos no banco"
          value={stats.products.total}
          sub={`${stats.scheduler.active} agendamentos ativos`}
          icon={Package}
          color="orange"
        />
      </div>

      {/* Chart */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={16} className="text-brand-500" />
          <h2 className="font-semibold text-sm">Envios dos últimos 7 dias</h2>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chart} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#d1d5db' }}
            />
            <Bar dataKey="sent" name="Enviados" fill="#16a34a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="failed" name="Falhas" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Alerts */}
      {stats.posts.failed > 0 && (
        <div className="flex items-center gap-3 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">
            {stats.posts.failed} envio(s) falharam. Verifique as sessões do WhatsApp.
          </p>
        </div>
      )}
    </div>
  );
}
