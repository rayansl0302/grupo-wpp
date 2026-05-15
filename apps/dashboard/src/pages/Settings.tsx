import { useEffect, useState } from 'react';
import { Save, Info, CheckCircle2, AlertCircle, Link2, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface MLStatus {
  connected: boolean;
  nickname?: string;
  mlUserId?: string;
  expiresAt?: string;
  expired?: boolean;
}

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null);
  const [mlLoading, setMlLoading] = useState(true);

  const loadMlStatus = async () => {
    setMlLoading(true);
    try {
      const { data } = await api.get<MLStatus>('/auth/ml/status');
      setMlStatus(data);
    } catch {
      setMlStatus({ connected: false });
    } finally {
      setMlLoading(false);
    }
  };

  useEffect(() => {
    loadMlStatus();
    // Atualiza a cada 5s caso usuario esteja conectando em outra aba
    const interval = setInterval(loadMlStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectML = () => {
    const apiUrl = api.defaults.baseURL || '';
    window.open(`${apiUrl}/auth/ml/start`, '_blank', 'width=600,height=700');
  };

  const handleDisconnectML = async () => {
    if (!confirm('Desconectar conta do Mercado Livre?')) return;
    await api.post('/auth/ml/disconnect');
    loadMlStatus();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Configuracoes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Ajuste as configuracoes da automacao</p>
      </div>

      {/* Mercado Livre OAuth */}
      <div className="card space-y-3 max-w-lg">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-yellow-500" />
          <h2 className="font-semibold">Conexao com Mercado Livre</h2>
        </div>

        {mlLoading ? (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Verificando...
          </div>
        ) : mlStatus?.connected ? (
          <div className="space-y-3">
            <div className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
              mlStatus.expired ? 'bg-yellow-900/30 text-yellow-300' : 'bg-green-900/30 text-green-300'
            }`}>
              {mlStatus.expired ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
              <div>
                <p className="font-medium">
                  {mlStatus.expired ? 'Token expirado - renovara automaticamente' : 'Conectado'}
                </p>
                <p className="text-xs opacity-80">
                  Usuario: <strong>{mlStatus.nickname || mlStatus.mlUserId}</strong>
                </p>
                {mlStatus.expiresAt && (
                  <p className="text-xs opacity-60">
                    Token expira em: {new Date(mlStatus.expiresAt).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleConnectML} className="btn-ghost text-sm">Reconectar</button>
              <button onClick={handleDisconnectML} className="text-sm text-red-400 hover:text-red-300">
                Desconectar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-300 flex items-center gap-2">
              <AlertCircle size={14} className="text-yellow-500" />
              Nao conectado. O bot vai usar fallback (scraper) ate voce autorizar.
            </div>
            <button onClick={handleConnectML} className="btn-primary text-sm flex items-center gap-2">
              <Link2 size={14} /> Conectar Mercado Livre
            </button>
            <p className="text-xs text-gray-500">
              Vai abrir uma janela do ML pra voce autorizar. Apos isso, o bot busca produtos via API oficial (sem scraping).
            </p>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 bg-blue-950/40 border border-blue-900/50 rounded-xl px-4 py-3 max-w-lg">
        <Info size={15} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-300">
          Configuracoes abaixo sao somente para visualizacao. Para alterar de verdade, edite as variaveis no Railway.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4 max-w-lg">
        <div className="card space-y-4">
          <h2 className="font-semibold">Anti-ban</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Delay minimo (ms)</label>
              <input type="number" defaultValue={8000} className="input" disabled />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Delay maximo (ms)</label>
              <input type="number" defaultValue={25000} className="input" disabled />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Limite diario global de posts</label>
            <input type="number" defaultValue={50} className="input" disabled />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold">Encurtador de URL</h2>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Servico</label>
            <select className="input" defaultValue="tinyurl" disabled>
              <option value="tinyurl">TinyURL (gratuito)</option>
              <option value="bitly">Bitly (com tracking)</option>
              <option value="none">Nenhum (URL original)</option>
            </select>
          </div>
        </div>
      </form>
    </div>
  );
}
