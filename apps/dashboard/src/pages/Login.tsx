import { useEffect, useState } from 'react';
import { Zap, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface Props { onLogin: (email: string, password: string) => Promise<void> }

type ApiStatus = 'checking' | 'online' | 'offline';

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('admin@wppbot.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [apiInfo, setApiInfo] = useState<string>('');

  const apiUrl = api.defaults.baseURL || '';

  // Check API health no mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/health', { timeout: 8000 });
        if (cancelled) return;
        setApiStatus('online');
        setApiInfo(`${apiUrl} - status: ${res.data?.status ?? 'ok'}`);
      } catch (err: any) {
        if (cancelled) return;
        setApiStatus('offline');
        const code = err?.code || err?.response?.status;
        setApiInfo(`${apiUrl} - falhou (${code ?? 'sem resposta'})`);
      }
    })();
    return () => { cancelled = true; };
  }, [apiUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onLogin(email, password);
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const serverMsg = data?.error || data?.message || (typeof data === 'string' ? data : '');

      if (err?.message?.includes('Network') || err?.code === 'ERR_NETWORK') {
        setError({
          title: 'Sem conexao com a API',
          detail: `Verifique se ${apiUrl} esta no ar. Erro: ${err.message}`,
        });
      } else if (status === 401) {
        setError({
          title: 'Credenciais invalidas',
          detail: serverMsg || 'O email ou a senha nao batem com o usuario do banco.',
        });
      } else if (status === 0 || !status) {
        setError({
          title: 'Erro de CORS ou conexao',
          detail: `O navegador bloqueou a requisicao. Verifique CORS_ORIGIN no Railway. Erro: ${err.message}`,
        });
      } else {
        setError({
          title: `Erro HTTP ${status}`,
          detail: serverMsg || err.message || 'Erro desconhecido',
        });
      }
      console.error('Login error:', { status, data, err });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">WPP Bot</h1>
        </div>

        {/* Status da API */}
        <div className={`mb-4 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
          apiStatus === 'online' ? 'bg-green-900/20 border border-green-800/40 text-green-300' :
          apiStatus === 'offline' ? 'bg-red-900/20 border border-red-800/40 text-red-300' :
          'bg-gray-800 border border-gray-700 text-gray-400'
        }`}>
          {apiStatus === 'checking' && <Loader2 size={12} className="animate-spin" />}
          {apiStatus === 'online' && <CheckCircle2 size={12} />}
          {apiStatus === 'offline' && <AlertCircle size={12} />}
          <span className="truncate">
            {apiStatus === 'checking' && 'Verificando API...'}
            {apiStatus === 'online' && 'API online'}
            {apiStatus === 'offline' && 'API offline'}
          </span>
        </div>
        <div className="text-[10px] text-gray-600 mb-4 break-all font-mono">{apiInfo}</div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-5">Entrar no painel</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required placeholder="********" />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 space-y-1">
                <p className="text-red-300 text-sm font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} /> {error.title}
                </p>
                <p className="text-red-200/80 text-xs">{error.detail}</p>
              </div>
            )}

            <button type="submit" disabled={loading || apiStatus === 'offline'} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Entrando...' : apiStatus === 'offline' ? 'API offline - aguarde' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          Padrao: admin@wppbot.com / admin123
        </p>
      </div>
    </div>
  );
}
