import { useEffect, useState } from 'react';
import {
  CheckCircle, XCircle, ChevronLeft, ChevronRight, X,
  ExternalLink, Copy, Tag, Truck, Star, ShoppingCart, AlertCircle,
} from 'lucide-react';
import { dashApi, type SentPost, type SentPostDetail } from '../services/api';

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ProductDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<SentPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    dashApi.historyDetail(id).then((res) => {
      setDetail(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="font-semibold text-white">Detalhes do envio</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div className="p-10 text-center text-gray-500">Carregando...</div>
        )}

        {detail && (
          <div className="p-5 space-y-5">
            {/* Imagem + Título + Preço */}
            <div className="flex gap-4">
              {detail.product.thumbnail && (
                <img
                  src={detail.product.thumbnail}
                  alt=""
                  className="w-32 h-32 rounded-lg object-cover flex-shrink-0 bg-gray-800"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-base leading-tight">
                  {detail.product.title}
                </h3>
                <div className="mt-3 space-y-1">
                  {detail.product.originalPrice && detail.product.originalPrice > detail.product.salePrice && (
                    <p className="text-sm text-gray-500">
                      De: <span className="line-through">{formatPrice(detail.product.originalPrice)}</span>
                    </p>
                  )}
                  <p className="text-2xl font-bold text-green-400">
                    {formatPrice(detail.product.salePrice)}
                  </p>
                  {detail.product.discount && (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full">
                      <Tag size={10} /> {detail.product.discount}% OFF
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {detail.product.freeShipping && (
                <span className="text-xs bg-emerald-900/30 text-emerald-300 px-2 py-1 rounded-full flex items-center gap-1">
                  <Truck size={11} /> Frete Grátis
                </span>
              )}
              {detail.product.rating && (
                <span className="text-xs bg-yellow-900/30 text-yellow-300 px-2 py-1 rounded-full flex items-center gap-1">
                  <Star size={11} /> {detail.product.rating.toFixed(1)}
                </span>
              )}
              {detail.product.soldCount && (
                <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded-full flex items-center gap-1">
                  <ShoppingCart size={11} /> {detail.product.soldCount.toLocaleString('pt-BR')} vendidos
                </span>
              )}
              {detail.product.seller && (
                <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full">
                  🏪 {detail.product.seller}
                </span>
              )}
            </div>

            {/* Links */}
            <div className="card bg-black/30 space-y-2">
              <p className="text-xs text-gray-500 uppercase font-semibold">Links</p>
              <div className="space-y-2">
                <LinkRow
                  label="🔗 Link de afiliado (enviado no WhatsApp)"
                  url={detail.product.affiliateUrl || detail.product.permalink}
                  onCopy={() => copy(detail.product.affiliateUrl || detail.product.permalink, 'affiliate')}
                  copied={copied === 'affiliate'}
                />
                <LinkRow
                  label="🛒 Link original do produto"
                  url={detail.product.permalink}
                  onCopy={() => copy(detail.product.permalink, 'permalink')}
                  copied={copied === 'permalink'}
                />
              </div>
            </div>

            {/* Mensagem enviada */}
            <div className="card bg-black/30">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Mensagem enviada</p>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans bg-gray-950 p-3 rounded">
                {detail.message}
              </pre>
              <button
                onClick={() => copy(detail.message, 'message')}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Copy size={11} /> {copied === 'message' ? 'Copiado!' : 'Copiar mensagem'}
              </button>
            </div>

            {/* Erro (se falhou) */}
            {detail.status === 'failed' && detail.error && (
              <div className="card bg-red-900/20 border border-red-700/40">
                <p className="text-xs text-red-300 uppercase font-semibold mb-2 flex items-center gap-1">
                  <AlertCircle size={11} /> Erro
                </p>
                <pre className="text-xs text-red-200 whitespace-pre-wrap break-all">{detail.error}</pre>
              </div>
            )}

            {/* Metadados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <Field label="Status" value={detail.status === 'sent' ? '✅ Enviado' : '❌ Falha'} />
              <Field label="Enviado em" value={new Date(detail.sentAt).toLocaleString('pt-BR')} />
              <Field label="Campanha" value={detail.campaign.name} />
              <Field label="Template" value={detail.campaign.templateType} />
              <Field label="Grupo" value={detail.group.name} />
              <Field label="Sessão WhatsApp" value={detail.group.session.name} />
              <Field label="Número WhatsApp" value={detail.group.session.phoneNumber || '—'} />
              <Field label="JID do grupo" value={detail.group.jid} mono />
              <Field label="ML ID" value={detail.product.mlId} mono />
              <Field label="Categoria" value={detail.product.category || '—'} />
              <Field label="Coletado em" value={new Date(detail.product.fetchedAt).toLocaleString('pt-BR')} />
              <Field label="Cliques registrados" value={String(detail.clicks)} />
            </div>

            {/* Ações */}
            <div className="flex gap-2 pt-2">
              <a
                href={detail.product.affiliateUrl || detail.product.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm flex items-center gap-2"
              >
                <ExternalLink size={14} /> Abrir produto no ML
              </a>
              <button onClick={onClose} className="btn-ghost text-sm">Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-gray-500 mb-0.5">{label}</p>
      <p className={`text-gray-200 ${mono ? 'font-mono text-[10px] break-all' : ''}`}>{value}</p>
    </div>
  );
}

function LinkRow({ label, url, onCopy, copied }: { label: string; url: string; onCopy: () => void; copied: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="flex items-center gap-2 bg-gray-950 rounded p-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 truncate flex-1"
        >
          {url}
        </a>
        <button onClick={onCopy} className="text-gray-400 hover:text-white flex-shrink-0" title="Copiar">
          {copied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

export default function History() {
  const [posts, setPosts] = useState<SentPost[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async (p: number) => {
    const res = await dashApi.history(p);
    setPosts(res.data.data);
    setPages(res.data.pages);
    setTotal(res.data.total);
  };

  useEffect(() => { load(page); }, [page]);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Histórico de Envios</h1>
        <p className="text-sm text-gray-500 mt-0.5">{total} registros · Clique numa linha pra ver detalhes</p>
      </div>

      {selectedId && <ProductDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500">
              <th className="text-left px-4 py-3">Produto</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Grupo</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Campanha</th>
              <th className="text-left px-4 py-3">Enviado em</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {posts.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className="hover:bg-gray-800/50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.product.thumbnail && (
                      <img src={p.product.thumbnail} alt="" className="w-8 h-8 rounded object-cover bg-gray-800" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate max-w-[200px]">{p.product.title}</p>
                      <p className="text-xs text-gray-500">
                        {formatPrice(p.product.salePrice)}
                        {p.product.discount ? ` · ${p.product.discount}% OFF` : ''}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-gray-400">{p.group.name}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-gray-400">{p.campaign.name}</td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(p.sentAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-3">
                  {p.status === 'sent' ? (
                    <span className="badge-green"><CheckCircle size={10} /> Enviado</span>
                  ) : (
                    <span className="badge-red"><XCircle size={10} /> Falha</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {posts.length === 0 && (
          <p className="text-center text-gray-600 py-12">Nenhum envio registrado ainda.</p>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">Página {page} de {pages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="btn-ghost p-1.5 disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(page + 1)} disabled={page >= pages} className="btn-ghost p-1.5 disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
