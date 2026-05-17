import { useState, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (cron: string) => void;
}

// Presets agrupados por categoria
export const CRON_PRESETS = {
  nichos: [
    { value: '0 9,19 * * *', label: '📱 Tech (9h e 19h)' },
    { value: '0 11,17 * * *', label: '🏠 Casa (11h e 17h)' },
    { value: '0 7,21 * * *', label: '💪 Fitness (7h e 21h)' },
    { value: '0 10,20 * * *', label: '💄 Beleza (10h e 20h)' },
    { value: '0 8,16 * * *', label: '🔧 Ferramentas (8h e 16h)' },
    { value: '0 13,18 * * *', label: '👟 Moda & Calçados (13h e 18h)' },
    { value: '0 14,22 * * *', label: '🎮 Games & Gamer (14h e 22h)' },
    { value: '0 12,15 * * *', label: '🐶 Pets (12h e 15h)' },
  ],
  frequentes: [
    { value: '*/10 * * * *', label: '⚡⚡⚡ A cada 10 min (RISCO ALTO)' },
    { value: '*/15 * * * *', label: '⚡⚡ A cada 15 min' },
    { value: '*/20 * * * *', label: '⚡⚡ A cada 20 min' },
    { value: '*/30 * * * *', label: '⚡ A cada 30 min' },
    { value: '0 */1 * * *', label: 'A cada 1 hora' },
    { value: '0 */2 * * *', label: 'A cada 2 horas' },
    { value: '0 */3 * * *', label: 'A cada 3 horas' },
    { value: '0 */4 * * *', label: 'A cada 4 horas' },
    { value: '0 */6 * * *', label: 'A cada 6 horas' },
  ],
  pacotes: [
    { value: '0 9,12,18,21 * * *', label: '4x ao dia (9h/12h/18h/21h)' },
    { value: '0 8,12,16,20 * * *', label: '4x ao dia (8h/12h/16h/20h)' },
    { value: '0 7,10,13,16,19,22 * * *', label: '6x ao dia (espalhado)' },
    { value: '0 9 * * *', label: '1x ao dia - 9h' },
    { value: '0 12 * * *', label: '1x ao dia - 12h' },
    { value: '0 18 * * *', label: '1x ao dia - 18h' },
    { value: '0 21 * * *', label: '1x ao dia - 21h' },
  ],
};

type Mode = 'preset' | 'minute-of-hour' | 'every-x-min' | 'specific-hours' | 'custom';

function detectMode(cron: string): Mode {
  // */N * * * *  → every-x-min
  if (/^\*\/\d+ \* \* \* \*$/.test(cron)) return 'every-x-min';
  // M * * * *  → minute-of-hour (sempre no minuto M)
  if (/^\d+ \* \* \* \*$/.test(cron)) return 'minute-of-hour';
  // 0 H,H,H * * *  → specific-hours
  if (/^\d+ [\d,]+\s\*\s\*\s\*$/.test(cron)) return 'specific-hours';
  return 'preset';
}

function describeCron(cron: string): string {
  if (/^\*\/(\d+) \* \* \* \*$/.test(cron)) {
    const m = cron.match(/^\*\/(\d+)/);
    return `A cada ${m?.[1]} minutos`;
  }
  if (/^(\d+) \* \* \* \*$/.test(cron)) {
    const m = cron.match(/^(\d+)/);
    return `Toda hora no minuto ${m?.[1]}`;
  }
  if (/^(\d+) ([\d,]+) \* \* \*$/.test(cron)) {
    const m = cron.match(/^(\d+) ([\d,]+)/);
    return `Nos horarios ${m?.[2]?.split(',').map((h) => `${h}:${m?.[1]?.padStart(2, '0')}`).join(', ')}`;
  }
  return cron;
}

export default function CronBuilder({ value, onChange }: Props) {
  const [mode, setMode] = useState<Mode>(() => detectMode(value));

  // Estados para cada modo
  const [minuteOfHour, setMinuteOfHour] = useState(() => {
    const m = value.match(/^(\d+) \* \* \* \*$/);
    return m ? parseInt(m[1]) : 0;
  });
  const [everyXMin, setEveryXMin] = useState(() => {
    const m = value.match(/^\*\/(\d+) \* \* \* \*$/);
    return m ? parseInt(m[1]) : 30;
  });
  const [specificHours, setSpecificHours] = useState<{ minute: number; hours: number[] }>(() => {
    const m = value.match(/^(\d+) ([\d,]+) \* \* \*$/);
    if (m) {
      return { minute: parseInt(m[1]), hours: m[2].split(',').map(Number) };
    }
    return { minute: 0, hours: [9, 19] };
  });
  const [custom, setCustom] = useState(value);

  // Quando muda modo ou state interno, atualiza o cron
  useEffect(() => {
    if (mode === 'minute-of-hour') onChange(`${minuteOfHour} * * * *`);
    else if (mode === 'every-x-min') onChange(`*/${everyXMin} * * * *`);
    else if (mode === 'specific-hours') {
      const sorted = [...specificHours.hours].sort((a, b) => a - b);
      onChange(`${specificHours.minute} ${sorted.join(',')} * * *`);
    } else if (mode === 'custom') onChange(custom);
  }, [mode, minuteOfHour, everyXMin, specificHours, custom]);

  return (
    <div className="space-y-2">
      {/* Tabs de modo */}
      <div className="flex flex-wrap gap-1 text-xs">
        {[
          { id: 'preset', label: '📋 Presets' },
          { id: 'minute-of-hour', label: '🕐 Toda hora no minuto X' },
          { id: 'every-x-min', label: '🔁 A cada X minutos' },
          { id: 'specific-hours', label: '🎯 Horários específicos' },
          { id: 'custom', label: '⚙️ Customizado' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id as Mode)}
            className={`px-2.5 py-1 rounded-md transition ${
              mode === t.id
                ? 'bg-brand-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteudo de cada modo */}
      <div className="bg-gray-950 rounded-lg p-3">
        {mode === 'preset' && (
          <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
            <optgroup label="🎯 Nichos com 2 horários (recomendado)">
              {CRON_PRESETS.nichos.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="⚡ Frequentes">
              {CRON_PRESETS.frequentes.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="📦 Pacotes">
              {CRON_PRESETS.pacotes.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          </select>
        )}

        {mode === 'minute-of-hour' && (
          <div className="space-y-2">
            <label className="block text-xs text-gray-400">
              Executar toda hora no minuto:
            </label>
            <select className="input"
              value={minuteOfHour}
              onChange={(e) => setMinuteOfHour(parseInt(e.target.value))}>
              {Array.from({ length: 60 }, (_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')} (XX:{i.toString().padStart(2, '0')})</option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Ex: minuto 50 = 00:50, 01:50, 02:50, ... 23:50 (24 vezes/dia)
            </p>
          </div>
        )}

        {mode === 'every-x-min' && (
          <div className="space-y-2">
            <label className="block text-xs text-gray-400">
              Executar a cada:
            </label>
            <select className="input"
              value={everyXMin}
              onChange={(e) => setEveryXMin(parseInt(e.target.value))}>
              {[5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360].map((n) => (
                <option key={n} value={n}>{n} minutos ({Math.floor((24 * 60) / n)}x/dia)</option>
              ))}
            </select>
            <p className="text-xs text-yellow-400">
              ⚠️ Frequencias altas (≤15min) tem risco de ban no WhatsApp
            </p>
          </div>
        )}

        {mode === 'specific-hours' && (
          <div className="space-y-2">
            <label className="block text-xs text-gray-400">
              No minuto:
              <select className="input mt-1"
                value={specificHours.minute}
                onChange={(e) => setSpecificHours({ ...specificHours, minute: parseInt(e.target.value) })}>
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                  <option key={m} value={m}>:{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-gray-400 mt-2">
              Nos horários (clique pra selecionar):
            </label>
            <div className="grid grid-cols-6 gap-1">
              {Array.from({ length: 24 }, (_, h) => {
                const selected = specificHours.hours.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      const newHours = selected
                        ? specificHours.hours.filter((x) => x !== h)
                        : [...specificHours.hours, h];
                      setSpecificHours({ ...specificHours, hours: newHours });
                    }}
                    className={`text-xs py-1.5 rounded transition ${
                      selected ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                    }`}
                  >
                    {h.toString().padStart(2, '0')}h
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {specificHours.hours.length} horario(s) selecionado(s)
            </p>
          </div>
        )}

        {mode === 'custom' && (
          <div className="space-y-2">
            <label className="block text-xs text-gray-400">
              Expressão cron (formato: minuto hora dia mes dia-semana):
            </label>
            <input
              className="input font-mono"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="0 */2 * * *"
            />
            <p className="text-xs text-gray-500">
              Exemplos: <code className="text-gray-300">0 9 * * *</code> (9h todo dia),{' '}
              <code className="text-gray-300">30 14 * * 1-5</code> (14:30 dias úteis),{' '}
              <code className="text-gray-300">*/45 * * * *</code> (a cada 45 min)
            </p>
            <a href="https://crontab.guru/" target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 inline-block">
              📖 Crontab.guru — gerador visual de cron
            </a>
          </div>
        )}
      </div>

      {/* Preview do cron final */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">Cron:</span>
        <code className="bg-gray-800 text-brand-400 px-2 py-1 rounded font-mono">{value}</code>
        <span className="text-gray-500">→ {describeCron(value)}</span>
      </div>
    </div>
  );
}
