import { useEffect, useState } from 'react';
import {
  CheckCircle2, AlertCircle, XCircle, HelpCircle,
  ExternalLink, RefreshCw, BookOpen, Server, Plug, Shield,
} from 'lucide-react';
import { servicesApi, type ServiceCheck } from '../services/api';

const CATEGORY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  infra: { label: 'Infraestrutura', icon: Server, color: 'text-blue-400' },
  integration: { label: 'Integrações', icon: Plug, color: 'text-purple-400' },
  auth: { label: 'Autenticação', icon: Shield, color: 'text-yellow-400' },
};

const STATUS_CONFIG = {
  ok: { color: 'green', icon: CheckCircle2, label: 'OK' },
  warning: { color: 'yellow', icon: AlertCircle, label: 'Atenção' },
  error: { color: 'red', icon: XCircle, label: 'Erro' },
  unknown: { color: 'gray', icon: HelpCircle, label: 'Desconhecido' },
};

function ServiceCard({ service }: { service: ServiceCheck }) {
  const cfg = STATUS_CONFIG[service.status];
  const StatusIcon = cfg.icon;

  return (
    <div className={`card border-l-4 border-${cfg.color}-500 hover:bg-gray-900 transition`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon size={16} className={`text-${cfg.color}-400 flex-shrink-0`} />
            <h3 className="font-semibold text-white text-sm truncate">{service.name}</h3>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">{service.message}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full bg-${cfg.color}-900/30 text-${cfg.color}-300 whitespace-nowrap font-medium`}>
          {cfg.label}
        </span>
      </div>

      {service.expiresAt && (
        <div className="text-xs text-gray-500 mt-2">
          <span className="text-gray-600">Expira em:</span> {new Date(service.expiresAt).toLocaleString('pt-BR')}
        </div>
      )}

      {service.meta && Object.keys(service.meta).length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
            Detalhes
          </summary>
          <div className="mt-1 bg-black/30 rounded p-2 text-[10px] text-gray-400 space-y-0.5">
            {Object.entries(service.meta).map(([k, v]) => (
              <div key={k} className="break-all">
                <span className="text-gray-600">{k}:</span>{' '}
                <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-800">
        {service.panelUrl.startsWith('http') ? (
          <a
            href={service.panelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <ExternalLink size={11} /> Painel
          </a>
        ) : (
          <a href={service.panelUrl} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <ExternalLink size={11} /> Ir
          </a>
        )}
        {service.docsUrl && (
          <a
            href={service.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
          >
            <BookOpen size={11} /> Docs
          </a>
        )}
      </div>
    </div>
  );
}

export default function Services() {
  const [data, setData] = useState<{
    summary: { total: number; ok: number; warning: number; error: number };
    services: ServiceCheck[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await servicesApi.status();
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000); // auto-refresh a cada 30s
    return () => clearInterval(interval);
  }, []);

  const byCategory = (cat: string) => data?.services.filter((s) => s.category === cat) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Serviços externos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Estado dos serviços de terceiros usados pelo bot
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-white">{data.summary.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="card text-center border-l-4 border-green-500">
            <p className="text-2xl font-bold text-green-400">{data.summary.ok}</p>
            <p className="text-xs text-gray-500">Funcionando</p>
          </div>
          <div className="card text-center border-l-4 border-yellow-500">
            <p className="text-2xl font-bold text-yellow-400">{data.summary.warning}</p>
            <p className="text-xs text-gray-500">Atenção</p>
          </div>
          <div className="card text-center border-l-4 border-red-500">
            <p className="text-2xl font-bold text-red-400">{data.summary.error}</p>
            <p className="text-xs text-gray-500">Erros</p>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="card text-center py-10">
          <RefreshCw size={20} className="animate-spin mx-auto text-gray-500" />
          <p className="text-sm text-gray-500 mt-2">Verificando serviços...</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {(['infra', 'integration', 'auth'] as const).map((cat) => {
            const services = byCategory(cat);
            if (services.length === 0) return null;
            const meta = CATEGORY_LABELS[cat];
            const Icon = meta.icon;
            return (
              <div key={cat}>
                <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Icon size={15} className={meta.color} />
                  {meta.label}
                  <span className="text-xs text-gray-600">({services.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {services.map((s) => <ServiceCard key={s.id} service={s} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card bg-blue-900/10 border border-blue-800/30">
        <p className="text-xs text-blue-200">
          💡 <strong>Auto-refresh:</strong> Esta página atualiza sozinha a cada 30 segundos.
          Os links levam direto para os painéis externos onde você pode validar saldos, recarregar créditos, renovar sessões, etc.
        </p>
      </div>
    </div>
  );
}
