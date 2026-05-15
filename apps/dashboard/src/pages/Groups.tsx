import { useEffect, useRef, useState } from 'react';
import { ToggleLeft, ToggleRight, Wifi, WifiOff, QrCode, Plus, RefreshCw, Trash2, Search, Download, Pencil } from 'lucide-react';
import { groupApi, sessionApi, type Group, type Session } from '../services/api';

interface WAGroup { jid: string; subject: string }

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newSession, setNewSession] = useState('');
  const [qr, setQr] = useState<{ id: string; name: string; code: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState<string | null>(null);
  const [fetchingFor, setFetchingFor] = useState<string | null>(null);
  const [waGroups, setWaGroups] = useState<{ sessionId: string; sessionName: string; items: WAGroup[] } | null>(null);
  const [editGroup, setEditGroup] = useState<{ id: string; name: string; dailyLimit: number } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const pollRef = useRef<number | null>(null);

  const load = async () => {
    const [gRes, sRes] = await Promise.all([groupApi.list(), sessionApi.list()]);
    setGroups(gRes.data);
    setSessions(sRes.data);
  };

  useEffect(() => {
    load();
    const refresh = setInterval(load, 5000);
    return () => clearInterval(refresh);
  }, []);

  // ─── QR Code polling ────────────────────────────────────────────────
  const startQrPolling = (sessionId: string, sessionName: string) => {
    setLoadingQr(sessionId);
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const { data } = await sessionApi.getQr(sessionId);
        if (data.status === 'connected') {
          stopQrPolling();
          setQr(null);
          setLoadingQr(null);
          load();
          alert(`Sessao "${sessionName}" conectada com sucesso!`);
          return;
        }
        if (data.qrCode) {
          setQr({ id: sessionId, name: sessionName, code: data.qrCode });
          setLoadingQr(null);
        }
      } catch (e) { console.error(e); }
    };

    poll();
    pollRef.current = window.setInterval(poll, 2000);
  };

  const stopQrPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopQrPolling(), []);

  // ─── Handlers ───────────────────────────────────────────────────────
  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSession.trim()) return;
    const { data } = await sessionApi.create(newSession.trim());
    setNewSession('');
    await load();
    startQrPolling(data.sessionId, data.name);
  };

  const handleShowQr = async (s: Session) => {
    if (s.status !== 'qr_pending') await sessionApi.create(s.name);
    startQrPolling(s.id, s.name);
  };

  const handleCloseQr = () => { stopQrPolling(); setQr(null); setLoadingQr(null); };

  const handleToggleGroup = async (id: string) => { await groupApi.toggle(id); load(); };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Remover o grupo "${name}"?`)) return;
    await groupApi.remove(id);
    load();
  };

  const handleEditGroup = (g: Group) => {
    setEditGroup({ id: g.id, name: g.name, dailyLimit: g.dailyLimit });
  };

  const handleSaveEdit = async () => {
    if (!editGroup) return;
    setEditSaving(true);
    try {
      await groupApi.update(editGroup.id, {
        name: editGroup.name.trim(),
        dailyLimit: Number(editGroup.dailyLimit),
      });
      setEditGroup(null);
      load();
    } catch (e: any) {
      alert(`Erro ao salvar: ${e?.response?.data?.error || e?.message}`);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteSession = async (s: Session) => {
    if (!confirm(`Remover a sessao "${s.name}"? Os grupos vinculados a ela tambem serao removidos.`)) return;
    await sessionApi.remove(s.id);
    load();
  };

  const handleFetchWaGroups = async (s: Session) => {
    if (s.status !== 'connected') {
      alert('Conecte a sessao no WhatsApp antes de buscar os grupos.');
      return;
    }
    setFetchingFor(s.id);
    try {
      const { data } = await sessionApi.fetchWhatsAppGroups(s.name);
      setWaGroups({ sessionId: s.id, sessionName: s.name, items: data });
    } catch (e) {
      console.error(e);
      alert('Erro ao buscar grupos. Verifique se a sessao esta realmente conectada.');
    } finally {
      setFetchingFor(null);
    }
  };

  const handleAddWaGroup = async (g: WAGroup) => {
    if (!waGroups) return;
    await groupApi.create({
      jid: g.jid,
      name: g.subject,
      sessionId: waGroups.sessionId,
      dailyLimit: 10,
    });
    load();
    alert(`Grupo "${g.subject}" cadastrado!`);
  };

  const isAlreadyAdded = (jid: string) => groups.some((g) => g.jid === jid);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Sessoes & Grupos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gerencie conexoes WhatsApp e grupos de destino</p>
      </div>

      {/* Modal QR Code */}
      {(qr || loadingQr) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={handleCloseQr}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <QrCode size={20} className="text-brand-500" />
              <h3 className="font-semibold text-white">{qr ? `QR Code - ${qr.name}` : 'Aguardando QR Code...'}</h3>
            </div>
            <div className="text-xs text-gray-400 mb-4 space-y-1">
              <p><strong className="text-white">No celular:</strong></p>
              <p>1. Abra o WhatsApp</p>
              <p>2. Toque nos 3 pontinhos (canto superior direito)</p>
              <p>3. Aparelhos conectados &rarr; Conectar um aparelho</p>
              <p>4. Aponte a camera pro QR Code abaixo</p>
            </div>
            <div className="bg-white p-4 rounded-xl flex items-center justify-center min-h-[240px]">
              {qr ? (
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qr.code)}`} alt="QR Code" className="rounded" />
              ) : (
                <div className="text-center text-gray-500 text-sm">
                  <RefreshCw className="animate-spin mx-auto mb-2" />
                  Gerando QR Code...<br /><span className="text-xs">(pode levar ate 10s)</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleCloseQr} className="btn-ghost text-sm flex-1">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lista de grupos do WhatsApp */}
      {waGroups && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setWaGroups(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <Search size={20} className="text-brand-500" />
              <h3 className="font-semibold text-white">Grupos do WhatsApp - {waGroups.sessionName}</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {waGroups.items.length} grupos encontrados. Clique em "Adicionar" pra cadastrar pro bot enviar mensagens.
            </p>
            <div className="overflow-y-auto flex-1 space-y-2">
              {waGroups.items.length === 0 && (
                <p className="text-center text-gray-500 py-8 text-sm">
                  Nenhum grupo encontrado. Certifique-se que o numero ja participa de algum grupo no WhatsApp.
                </p>
              )}
              {waGroups.items.map((g) => {
                const added = isAlreadyAdded(g.jid);
                return (
                  <div key={g.jid} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{g.subject}</p>
                      <p className="text-xs text-gray-500 truncate">{g.jid}</p>
                    </div>
                    {added ? (
                      <span className="badge-green text-xs">Ja cadastrado</span>
                    ) : (
                      <button onClick={() => handleAddWaGroup(g)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 whitespace-nowrap">
                        <Plus size={12} /> Adicionar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setWaGroups(null)} className="btn-ghost text-sm mt-4">Fechar</button>
          </div>
        </div>
      )}

      {/* Modal de editar grupo */}
      {editGroup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setEditGroup(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Pencil size={18} className="text-blue-400" />
              <h3 className="font-semibold text-white">Editar grupo</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Nome</label>
                <input className="input" value={editGroup.name}
                  onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Limite diario de envios
                  <span className="text-gray-600"> (recomendado: 10-30 pra evitar ban)</span>
                </label>
                <input type="number" className="input" min={1} max={500}
                  value={editGroup.dailyLimit}
                  onChange={(e) => setEditGroup({ ...editGroup, dailyLimit: Number(e.target.value) })} />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={handleSaveEdit} disabled={editSaving} className="btn-primary text-sm flex-1 disabled:opacity-50">
                {editSaving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setEditGroup(null)} className="btn-ghost text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Sessoes */}
      <div className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Wifi size={16} className="text-brand-500" /> Sessoes WhatsApp
        </h2>
        <div className="space-y-2 mb-4">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                {s.phoneNumber && <p className="text-xs text-gray-500">{s.phoneNumber}</p>}
              </div>
              <div className="flex items-center gap-2">
                {s.status === 'connected' ? (
                  <>
                    <span className="badge-green"><Wifi size={10} /> Conectado</span>
                    <button
                      onClick={() => handleFetchWaGroups(s)}
                      disabled={fetchingFor === s.id}
                      className="btn-primary text-xs px-2 py-1 flex items-center gap-1 disabled:opacity-50"
                      title="Buscar grupos do WhatsApp"
                    >
                      {fetchingFor === s.id ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                      Buscar grupos
                    </button>
                  </>
                ) : s.status === 'qr_pending' ? (
                  <button onClick={() => handleShowQr(s)} className="badge-yellow hover:opacity-80 cursor-pointer">
                    <QrCode size={10} /> Ver QR
                  </button>
                ) : (
                  <>
                    <span className="badge-red"><WifiOff size={10} /> Desconectado</span>
                    <button onClick={() => handleShowQr(s)} className="btn-ghost text-xs px-2 py-1">Conectar</button>
                  </>
                )}
                <button
                  onClick={() => handleDeleteSession(s)}
                  className="text-gray-500 hover:text-red-400"
                  title="Remover sessao"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddSession} className="flex gap-2">
          <input className="input" placeholder="Nome da sessao (ex: principal)" value={newSession} onChange={(e) => setNewSession(e.target.value)} />
          <button type="submit" className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus size={14} /> Conectar
          </button>
        </form>
      </div>

      {/* Grupos */}
      <div className="card">
        <h2 className="font-semibold mb-4">Grupos cadastrados</h2>
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{g.name}</p>
                <p className="text-xs text-gray-500 truncate">{g.jid} &middot; {g.session.name} &middot; max {g.dailyLimit}/dia</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEditGroup(g)} className="text-blue-400 hover:text-blue-300" title="Editar">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleToggleGroup(g.id)} className="text-gray-400 hover:text-white" title={g.active ? 'Pausar' : 'Ativar'}>
                  {g.active ? <ToggleRight size={22} className="text-brand-500" /> : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => handleDeleteGroup(g.id, g.name)}
                  className="text-gray-500 hover:text-red-400"
                  title="Remover grupo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-center text-gray-600 py-6 text-sm">Nenhum grupo. Conecte uma sessao e clique em "Buscar grupos".</p>
          )}
        </div>
      </div>
    </div>
  );
}
