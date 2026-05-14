import { useEffect, useState } from 'react';
import { Play, Pause, Trash2, PlayCircle, Plus, Clock } from 'lucide-react';
import { campaignApi, groupApi, type Campaign, type Group } from '../services/api';

function CronLabel({ expr }: { expr: string }) {
  const labels: Record<string, string> = {
    '0 */2 * * *': 'A cada 2h',
    '0 9,12,18,21 * * *': '9h, 12h, 18h e 21h',
    '0 * * * *': 'Todo hora',
    '*/30 * * * *': 'A cada 30min',
  };
  return <span className="text-xs text-gray-500">{labels[expr] ?? expr}</span>;
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    keywords: '',
    minDiscount: 0,
    maxPrice: '',
    freeShipping: false,
    cronExpr: '0 */2 * * *',
    templateType: 'standard' as Campaign['templateType'],
    useAI: false,
    groupIds: [] as string[],
  });

  const load = async () => {
    const [cRes, gRes] = await Promise.all([campaignApi.list(), groupApi.list()]);
    setCampaigns(cRes.data);
    setGroups(gRes.data);
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id: string) => {
    await campaignApi.toggle(id);
    load();
  };

  const handleRun = async (id: string) => {
    setRunning(id);
    try { await campaignApi.run(id); } finally { setRunning(null); load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir campanha?')) return;
    await campaignApi.delete(id);
    load();
  };

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await campaignApi.create({
        ...form,
        keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean) as never,
        categories: [] as never,
        maxPrice: form.maxPrice ? Number(form.maxPrice) : undefined,
      });
      setShowForm(false);
      setForm({
        name: '',
        keywords: '',
        minDiscount: 0,
        maxPrice: '',
        freeShipping: false,
        cronExpr: '0 */2 * * *',
        templateType: 'standard' as Campaign['templateType'],
        useAI: false,
        groupIds: [],
      });
      load();
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const msg = data?.message
        || data?.error
        || (typeof data === 'string' && data)
        || (data && JSON.stringify(data))
        || err?.message
        || 'Erro desconhecido';
      setCreateError(`[${status ?? 'sem status'}] ${msg}`);
      console.error('Erro ao criar campanha:', { status, data, err });
    } finally {
      setCreating(false);
    }
  };

  const handleOpenForm = () => {
    load();
    setShowForm(true);
    setCreateError(null);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{campaigns.length} campanhas cadastradas</p>
        </div>
        <button onClick={() => showForm ? setShowForm(false) : handleOpenForm()} className="btn-primary flex items-center gap-2">
          <Plus size={15} />
          Nova campanha
        </button>
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div className="card">
          <h2 className="font-semibold mb-4">Nova campanha</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Nome da campanha</label>
              <input className="input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Palavras-chave (sep. por vírgula)</label>
              <input className="input" placeholder="notebook, celular, fone" value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Desconto mínimo (%)</label>
              <input type="number" className="input" min={0} max={100} value={form.minDiscount}
                onChange={(e) => setForm({ ...form, minDiscount: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Preço máximo (R$)</label>
              <input type="number" className="input" placeholder="Ex: 500" value={form.maxPrice}
                onChange={(e) => setForm({ ...form, maxPrice: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Agendamento (cron)</label>
              <select className="input" value={form.cronExpr}
                onChange={(e) => setForm({ ...form, cronExpr: e.target.value })}>
                <option value="0 */2 * * *">A cada 2 horas</option>
                <option value="0 9,12,18,21 * * *">9h, 12h, 18h e 21h</option>
                <option value="0 * * * *">Todo hora</option>
                <option value="0 8,20 * * *">8h e 20h</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Template</label>
              <select className="input" value={form.templateType}
                onChange={(e) => setForm({ ...form, templateType: e.target.value as Campaign['templateType'] })}>
                <option value="standard">Standard</option>
                <option value="hype">Hype</option>
                <option value="minimal">Minimal</option>
                <option value="flash">Flash</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5">
                Grupos {groups.length > 0 && <span className="text-gray-600">({groups.length} disponiveis)</span>}
              </label>
              {groups.length === 0 ? (
                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 text-xs text-yellow-200">
                  Nenhum grupo cadastrado. Voce pode criar a campanha agora e vincular grupos depois,
                  ou ir em <strong>Grupos</strong> e clicar em "Buscar grupos" primeiro.
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer bg-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-700">
                      <input type="checkbox" value={g.id}
                        checked={form.groupIds.includes(g.id)}
                        onChange={(e) => setForm({
                          ...form,
                          groupIds: e.target.checked
                            ? [...form.groupIds, g.id]
                            : form.groupIds.filter((x) => x !== g.id),
                        })} />
                      {g.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {createError && (
              <div className="md:col-span-2 bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-xs text-red-200">
                <strong>Erro ao criar:</strong> {createError}
              </div>
            )}

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={creating} className="btn-primary disabled:opacity-50">
                {creating ? 'Criando...' : 'Criar campanha'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-3">
        {campaigns.map((c) => (
          <div key={c.id} className="card flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.active ? 'bg-brand-500' : 'bg-gray-600'}`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">{c.name}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <CronLabel expr={c.cronExpr} />
                <span className="text-xs text-gray-500">
                  {c._count?.sentPosts ?? 0} envios
                </span>
                <span className="text-xs text-gray-600">{c.templateType}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRun(c.id)}
                disabled={running === c.id}
                className="btn-ghost p-2"
                title="Executar agora"
              >
                <PlayCircle size={16} className={running === c.id ? 'text-brand-500 animate-pulse' : ''} />
              </button>
              <button onClick={() => handleToggle(c.id)} className="btn-ghost p-2" title={c.active ? 'Pausar' : 'Ativar'}>
                {c.active ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button onClick={() => handleDelete(c.id)} className="btn-ghost p-2 text-red-500 hover:text-red-400" title="Excluir">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <p className="text-center text-gray-600 py-10">Nenhuma campanha. Crie uma acima.</p>
        )}
      </div>
    </div>
  );
}
