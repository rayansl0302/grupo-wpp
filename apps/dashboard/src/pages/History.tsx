import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { dashApi, type SentPost } from '../services/api';

export default function History() {
  const [posts, setPosts] = useState<SentPost[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

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
        <p className="text-sm text-gray-500 mt-0.5">{total} registros no total</p>
      </div>

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
              <tr key={p.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.product.thumbnail && (
                      <img src={p.product.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                    )}
                    <div>
                      <p className="font-medium text-white truncate max-w-[200px]">{p.product.title}</p>
                      <p className="text-xs text-gray-500">
                        R$ {p.product.salePrice.toFixed(2)}
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

        {/* Paginação */}
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
