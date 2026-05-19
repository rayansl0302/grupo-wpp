import { useEffect, useState } from 'react';
import { Play, Pause, Trash2, PlayCircle, Plus, Pencil, FlaskConical } from 'lucide-react';
import { campaignApi, groupApi, type Campaign, type Group } from '../services/api';
import CronBuilder, { CRON_PRESETS } from '../components/CronBuilder';

// Concatena todos os presets pra label da lista
const ALL_PRESETS = [
  ...CRON_PRESETS.nichos,
  ...CRON_PRESETS.frequentes,
  ...CRON_PRESETS.pacotes,
];

function describeCron(expr: string): string {
  if (/^\*\/(\d+) \* \* \* \*$/.test(expr)) {
    const m = expr.match(/^\*\/(\d+)/);
    return `A cada ${m?.[1]}min`;
  }
  if (/^(\d+) \* \* \* \*$/.test(expr)) {
    const m = expr.match(/^(\d+)/);
    return `Toda hora :${m?.[1]?.padStart(2, '0')}`;
  }
  return expr;
}

function CronLabel({ expr }: { expr: string }) {
  const found = ALL_PRESETS.find((o) => o.value === expr);
  return <span className="text-xs text-gray-500">{found?.label ?? describeCron(expr)}</span>;
}

const EMPTY_FORM = {
  name: '',
  keywords: '',
  minDiscount: 0,
  maxPrice: '',
  freeShipping: false,
  cronExpr: '0 */2 * * *',
  templateType: 'standard' as Campaign['templateType'],
  contentType: 'product' as NonNullable<Campaign['contentType']>,
  provider: 'ml' as NonNullable<Campaign['provider']>,
  useAI: false,
  groupIds: [] as string[],
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ campaignId: string; data: any } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    const [cRes, gRes] = await Promise.all([campaignApi.list(), groupApi.list()]);
    setCampaigns(cRes.data);
    setGroups(gRes.data);
  };

  useEffect(() => { load(); }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleToggle = async (id: string) => { await campaignApi.toggle(id); load(); };

  const handleRun = async (id: string) => {
    setRunning(id);
    setRunResult(null);
    try {
      const { data } = await campaignApi.run(id);
      setRunResult({ campaignId: id, data });
    } catch (err: any) {
      setRunResult({
        campaignId: id,
        data: { error: err?.response?.data?.error || err?.message || 'Erro desconhecido' },
      });
    } finally {
      setRunning(null);
      load();
    }
  };

  const handleTest = async (id: string) => {
    setRunning(id);
    setRunResult(null);
    try {
      const { data } = await campaignApi.test(id);
      setRunResult({ campaignId: id, data: { ...data, test: true } });
    } catch (err: any) {
      setRunResult({
        campaignId: id,
        data: { error: err?.response?.data?.error || err?.message || 'Erro desconhecido' },
      });
    } finally {
      setRunning(null);
      load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir campanha?')) return;
    await campaignApi.delete(id);
    load();
  };

  // ─── Abrir form (novo OU edicao) ──────────────────────────────────────────
  const handleNew = () => {
    load();
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
    setShowForm(true);
  };

  const handleEdit = (c: Campaign) => {
    load();
    let parsedKeywords: string[] = [];
    try {
      parsedKeywords = JSON.parse(c.keywords || '[]');
    } catch {
      parsedKeywords = (c.keywords || '').split(',').map(s => s.trim()).filter(Boolean);
    }
    setForm({
      name: c.name,
      keywords: parsedKeywords.join(','),
      minDiscount: c.minDiscount,
      maxPrice: (c as any).maxPrice ? String((c as any).maxPrice) : '',
      freeShipping: c.freeShipping,
      cronExpr: c.cronExpr,
      templateType: c.templateType as Campaign['templateType'],
      contentType: (c.contentType || 'product') as NonNullable<Campaign['contentType']>,
      provider: (c.provider || 'ml') as NonNullable<Campaign['provider']>,
      useAI: c.useAI,
      groupIds: c.groups?.map((cg: any) => cg.groupId ?? cg.group?.id).filter(Boolean) ?? [],
    });
    setEditingId(c.id);
    setFormError(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  // ─── Salvar (criar ou editar) ─────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean) as never,
        categories: [] as never,
        maxPrice: form.maxPrice ? Number(form.maxPrice) : undefined,
      };
      if (editingId) {
        await campaignApi.update(editingId, payload);
      } else {
        await campaignApi.create(payload);
      }
      handleCloseForm();
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
      setFormError(`[${status ?? 'sem status'}] ${msg}`);
      console.error('Erro ao salvar campanha:', { status, data, err });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{campaigns.length} campanhas cadastradas</p>
        </div>
        <button onClick={showForm ? handleCloseForm : handleNew} className="btn-primary flex items-center gap-2">
          <Plus size={15} />
          {showForm ? 'Fechar' : 'Nova campanha'}
        </button>
      </div>

      {/* Form (criar OU editar) */}
      {showForm && (
        <div className="card">
          <h2 className="font-semibold mb-4">
            {editingId ? 'Editar campanha' : 'Nova campanha'}
          </h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Nome da campanha</label>
              <input className="input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Palavras-chave (sep. por virgula)</label>
              <input className="input" placeholder="notebook, celular, fone" value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Desconto minimo (%)</label>
              <input type="number" className="input" min={0} max={100} value={form.minDiscount}
                onChange={(e) => setForm({ ...form, minDiscount: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Preco maximo (R$)</label>
              <input type="number" className="input" placeholder="Ex: 500" value={form.maxPrice}
                onChange={(e) => setForm({ ...form, maxPrice: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5">Agendamento (cron)</label>
              <CronBuilder
                value={form.cronExpr}
                onChange={(cron) => setForm({ ...form, cronExpr: cron })}
              />
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
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Fonte (Marketplace)</label>
              <select className="input" value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value as NonNullable<Campaign['provider']> })}>
                <option value="ml">🟡 Mercado Livre</option>
                <option value="shopee">🟠 Shopee</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {form.provider === 'shopee' && 'Requer SHOPEE_APP_ID + SHOPEE_APP_SECRET no Railway'}
                {form.provider === 'ml' && 'Mercado Livre - via scraping com proxy BR'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Tipo de conteudo</label>
              <select className="input" value={form.contentType}
                onChange={(e) => setForm({ ...form, contentType: e.target.value as NonNullable<Campaign['contentType']> })}>
                <option value="product">🛒 Produtos (padrao)</option>
                <option value="coupon">🎟️ Cupons de desconto</option>
                <option value="mixed">🎲 Misto (50/50 produtos+cupons)</option>
                <option value="social-profile">👤 Perfil de afiliado (pagina)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {form.contentType === 'product' && 'Envia produtos individuais com link de afiliado'}
                {form.contentType === 'coupon' && 'Envia cupons de desconto do ML'}
                {form.contentType === 'mixed' && 'Alterna entre produtos e cupons'}
                {form.contentType === 'social-profile' && 'Envia link do seu perfil com produtos em destaque'}
              </p>
            </div>
            <div className="md:col-span-2 flex gap-4 items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.freeShipping}
                  onChange={(e) => setForm({ ...form, freeShipping: e.target.checked })} />
                <span>Frete gratis</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.useAI}
                  onChange={(e) => setForm({ ...form, useAI: e.target.checked })} />
                <span>Usar IA pra textos</span>
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5">
                Grupos {groups.length > 0 && <span className="text-gray-600">({groups.length} disponiveis)</span>}
              </label>
              {groups.length === 0 ? (
                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 text-xs text-yellow-200">
                  Nenhum grupo cadastrado. Vai em <strong>Grupos</strong> e clique em "Buscar grupos" primeiro.
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

            {formError && (
              <div className="md:col-span-2 bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-xs text-red-200">
                <strong>Erro:</strong> {formError}
              </div>
            )}

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Salvando...' : editingId ? 'Salvar alteracoes' : 'Criar campanha'}
              </button>
              <button type="button" onClick={handleCloseForm} className="btn-ghost">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Resultado da execucao */}
      {runResult && (
        <div className={`card border ${runResult.data?.error ? 'border-red-700/50 bg-red-900/10' : runResult.data?.warning ? 'border-yellow-700/50 bg-yellow-900/10' : 'border-green-700/50 bg-green-900/10'}`}>
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-sm">
              {runResult.data?.error ? '❌ Erro' : runResult.data?.warning ? '⚠️ Atencao' : '✅ Execucao concluida'}
            </h3>
            <button onClick={() => setRunResult(null)} className="text-gray-500 hover:text-white text-xs">✕</button>
          </div>
          {runResult.data?.error && <p className="text-red-300 text-xs">{runResult.data.error}</p>}
          {runResult.data?.warning && <p className="text-yellow-300 text-xs mb-2">{runResult.data.warning}</p>}
          {typeof runResult.data?.sent === 'number' && (
            <p className="text-xs text-gray-300">
              {runResult.data.test ? '🧪 Teste: ' : ''}
              Enviados: <strong>{runResult.data.sent}</strong> | Falhas: <strong>{runResult.data.failed}</strong>
            </p>
          )}
          {runResult.data?.product && (
            <p className="text-xs text-gray-400 mt-1">
              📦 Produto enviado: <strong>{runResult.data.product}</strong>
            </p>
          )}
          {runResult.data?.productSearch && (
            <div className="mt-2 bg-black/30 p-2 rounded text-xs space-y-1">
              <p className="text-gray-300">
                <strong>ML search:</strong> "{runResult.data.productSearch.keyword}" - {runResult.data.productSearch.foundCount} produtos
              </p>
              {runResult.data.productSearch.sample?.map((p: any, i: number) => (
                <p key={i} className="text-gray-400 truncate">
                  - {p.title} (R$ {p.price}{p.discount ? `, -${p.discount}%` : ''})
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista de campanhas */}
      <div className="space-y-3">
        {campaigns.map((c) => (
          <div key={c.id} className="card flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.active ? 'bg-brand-500' : 'bg-gray-600'}`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">{c.name}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <CronLabel expr={c.cronExpr} />
                <span className="text-xs text-gray-500">{c._count?.sentPosts ?? 0} envios</span>
                <span className="text-xs text-gray-600">{c.templateType}</span>
                <span className="text-xs text-gray-600">{c.groups?.length ?? 0} grupo(s)</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => handleTest(c.id)} disabled={running === c.id}
                className="btn-ghost p-2 text-yellow-400 hover:text-yellow-300" title="Enviar 1 produto (teste rapido)">
                <FlaskConical size={16} className={running === c.id ? 'animate-pulse' : ''} />
              </button>
              <button onClick={() => handleRun(c.id)} disabled={running === c.id}
                className="btn-ghost p-2" title="Executar agora (envia varios)">
                <PlayCircle size={16} className={running === c.id ? 'text-brand-500 animate-pulse' : ''} />
              </button>
              <button onClick={() => handleEdit(c)} className="btn-ghost p-2 text-blue-400 hover:text-blue-300" title="Editar">
                <Pencil size={16} />
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
