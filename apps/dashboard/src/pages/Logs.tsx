import { useEffect, useState } from 'react';
import { RefreshCw, Trash2, FileText, AlertCircle, Info, AlertTriangle, Bug } from 'lucide-react';
import { logsApi, type AppLog } from '../services/api';

const LEVEL_STYLES = {
  info: { color: 'text-blue-300', bg: 'bg-blue-900/20', icon: Info },
  warn: { color: 'text-yellow-300', bg: 'bg-yellow-900/20', icon: AlertTriangle },
  error: { color: 'text-red-300', bg: 'bg-red-900/20', icon: AlertCircle },
  debug: { color: 'text-gray-400', bg: 'bg-gray-800/40', icon: Bug },
};

const SOURCE_COLORS: Record<string, string> = {
  crawler: 'bg-purple-900/30 text-purple-300',
  campaign: 'bg-green-900/30 text-green-300',
  whatsapp: 'bg-emerald-900/30 text-emerald-300',
  linkgen: 'bg-blue-900/30 text-blue-300',
  scheduler: 'bg-orange-900/30 text-orange-300',
  system: 'bg-gray-700 text-gray-300',
  auth: 'bg-yellow-900/30 text-yellow-300',
};

export default function Logs() {
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [summary, setSummary] = useState<{
    total: number;
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [logsRes, sumRes] = await Promise.all([
        logsApi.list({ level: filterLevel || undefined, source: filterSource || undefined, limit: 200 }),
        logsApi.summary(),
      ]);
      setLogs(logsRes.data.logs);
      setTotal(logsRes.data.total);
      setSummary(sumRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000); // auto-refresh
    return () => clearInterval(interval);
  }, [filterLevel, filterSource]);

  const handleClear = async () => {
    if (!confirm('Apagar todos os logs com mais de 24h?')) return;
    const res = await logsApi.clear();
    alert(`${res.data.deleted} logs apagados`);
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText size={20} className="text-brand-500" /> Logs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Logs das últimas 24 horas · Auto-cleanup ativo
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-ghost flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button onClick={handleClear} className="btn-ghost text-red-400 flex items-center gap-2 text-sm">
            <Trash2 size={14} /> Limpar antigos
          </button>
        </div>
      </div>

      {/* Resumo */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-white">{summary.total}</p>
            <p className="text-xs text-gray-500">Total 24h</p>
          </div>
          {(['info', 'warn', 'error', 'debug'] as const).map((lvl) => {
            const cfg = LEVEL_STYLES[lvl];
            const Icon = cfg.icon;
            return (
              <button
                key={lvl}
                onClick={() => setFilterLevel(filterLevel === lvl ? '' : lvl)}
                className={`card text-center transition ${filterLevel === lvl ? 'ring-2 ring-brand-500' : ''}`}
              >
                <p className={`text-2xl font-bold ${cfg.color}`}>{summary.byLevel[lvl] || 0}</p>
                <p className="text-xs text-gray-500 capitalize flex items-center justify-center gap-1">
                  <Icon size={11} /> {lvl}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filtros por source */}
      {summary && (
        <div className="card">
          <p className="text-xs text-gray-400 mb-2">Filtrar por origem:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterSource('')}
              className={`text-xs px-3 py-1 rounded-full ${!filterSource ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
              Todos
            </button>
            {Object.entries(summary.bySource).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
              <button
                key={src}
                onClick={() => setFilterSource(filterSource === src ? '' : src)}
                className={`text-xs px-3 py-1 rounded-full ${
                  filterSource === src ? 'bg-brand-600 text-white' : SOURCE_COLORS[src] || 'bg-gray-800 text-gray-400'
                }`}
              >
                {src} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de logs */}
      <div className="card">
        <p className="text-xs text-gray-500 mb-3">
          Mostrando {logs.length} de {total} logs
          {filterLevel && ` · level=${filterLevel}`}
          {filterSource && ` · source=${filterSource}`}
        </p>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto font-mono text-xs">
          {logs.length === 0 && !loading && (
            <p className="text-gray-600 text-center py-6">Nenhum log encontrado</p>
          )}
          {logs.map((l) => {
            const cfg = LEVEL_STYLES[l.level];
            const Icon = cfg.icon;
            return (
              <div
                key={l.id}
                className={`px-3 py-2 rounded ${cfg.bg} hover:bg-opacity-50 flex items-start gap-2`}
              >
                <Icon size={12} className={`${cfg.color} mt-0.5 flex-shrink-0`} />
                <span className="text-gray-600 whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleTimeString('pt-BR')}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${SOURCE_COLORS[l.source] || 'bg-gray-800 text-gray-400'}`}>
                  {l.source}
                </span>
                <span className={`flex-1 ${cfg.color} break-all`}>{l.message}</span>
                {l.meta && Object.keys(l.meta).length > 0 && (
                  <details className="ml-2">
                    <summary className="text-gray-500 cursor-pointer text-[10px]">meta</summary>
                    <pre className="text-[10px] text-gray-400 bg-black/40 p-2 rounded mt-1 max-w-md whitespace-pre-wrap">
                      {JSON.stringify(l.meta, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
