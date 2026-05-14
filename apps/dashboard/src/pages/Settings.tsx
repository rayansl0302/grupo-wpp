import { useState } from 'react';
import { Save, Info } from 'lucide-react';

export default function Settings() {
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Ajuste as configurações da automação</p>
      </div>

      <div className="flex items-start gap-3 bg-blue-950/40 border border-blue-900/50 rounded-xl px-4 py-3">
        <Info size={15} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-300">
          Configurações de ambiente (API keys, delays, limites) são definidas no arquivo <code className="font-mono text-xs bg-blue-950 px-1 py-0.5 rounded">.env</code>.
          Reinicie o servidor após alterar.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4 max-w-lg">
        <div className="card space-y-4">
          <h2 className="font-semibold">Anti-ban</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Delay mínimo (ms)</label>
              <input type="number" defaultValue={8000} className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Delay máximo (ms)</label>
              <input type="number" defaultValue={25000} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Limite diário global de posts</label>
            <input type="number" defaultValue={50} className="input" />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold">Encurtador de URL</h2>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Serviço</label>
            <select className="input" defaultValue="tinyurl">
              <option value="tinyurl">TinyURL (gratuito)</option>
              <option value="bitly">Bitly (com tracking)</option>
              <option value="none">Nenhum (URL original)</option>
            </select>
          </div>
        </div>

        <button type="submit" className="btn-primary flex items-center gap-2">
          <Save size={14} />
          {saved ? 'Salvo!' : 'Salvar configurações'}
        </button>
      </form>
    </div>
  );
}
