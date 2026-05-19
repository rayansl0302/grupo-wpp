import { useEffect, useState } from 'react';
import { Ticket, RefreshCw, ExternalLink, Copy, CheckCircle, Calendar, Store, Tag } from 'lucide-react';
import { couponsApi, type CouponItem } from '../services/api';

export default function Coupons() {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await couponsApi.list();
      setCoupons(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (!confirm('Atualizar cupons agora? Vai consumir banda do proxy IPRoyal.')) return;
    setRefreshing(true);
    try {
      const { data } = await couponsApi.refresh();
      alert(`${data.count} cupons atualizados!`);
      load();
    } catch (e: any) {
      alert(`Erro: ${e?.response?.data?.error || e?.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Ticket size={20} className="text-yellow-400" /> Cupons
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {coupons.length} cupons em cache · Atualizado a cada 6h
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-ghost flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Recarregar
          </button>
          <button onClick={refresh} disabled={refreshing} className="btn-primary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar do ML'}
          </button>
        </div>
      </div>

      {loading && coupons.length === 0 && (
        <div className="card text-center py-12">
          <RefreshCw size={20} className="animate-spin mx-auto text-gray-500 mb-2" />
          <p className="text-sm text-gray-500">Carregando cupons...</p>
        </div>
      )}

      {!loading && coupons.length === 0 && (
        <div className="card text-center py-12">
          <Ticket size={32} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-400 mb-1">Nenhum cupom em cache</p>
          <p className="text-xs text-gray-600 mb-4">
            Clique em "Atualizar do ML" pra buscar cupons agora
          </p>
          <button onClick={refresh} disabled={refreshing} className="btn-primary text-sm">
            Buscar cupons agora
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {coupons.map((c) => {
          const url = c.affiliateUrl || c.url;
          return (
            <div key={c.id} className="card hover:bg-gray-900 transition">
              {c.thumbnail && (
                <img
                  src={c.thumbnail}
                  alt=""
                  className="w-full h-32 object-cover rounded-lg mb-3 bg-gray-800"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <h3 className="font-semibold text-white text-sm leading-tight mb-2 line-clamp-2">
                {c.title}
              </h3>
              {c.description && c.description !== c.title && (
                <p className="text-xs text-gray-400 mb-2 line-clamp-2">{c.description}</p>
              )}

              <div className="space-y-1 text-xs mb-3">
                {c.discount && (
                  <div className="flex items-center gap-1.5 text-green-300">
                    <Tag size={11} /> <strong>{c.discount}</strong>
                  </div>
                )}
                {c.store && (
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Store size={11} /> {c.store}
                  </div>
                )}
                {c.validUntil && (
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Calendar size={11} />
                    Vale até {new Date(c.validUntil).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>

              {c.code && (
                <div className="bg-gray-950 rounded p-2 mb-3 flex items-center justify-between gap-2">
                  <code className="text-yellow-400 text-xs font-mono truncate">{c.code}</code>
                  <button
                    onClick={() => copy(c.code!, c.id + 'code')}
                    className="text-gray-400 hover:text-white flex-shrink-0"
                  >
                    {copied === c.id + 'code' ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>
              )}

              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full text-xs flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={12} /> Resgatar
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
