import { useEffect, useState } from 'react';
import { postMessage, onMessage } from '@spresenter/plugin-sdk/ui';
import { Root, Header, Panel, Row, Stack, Field, TextInput, Select, Checkbox, Button, Segmented, StatusIndicator } from '@spresenter/plugin-sdk/ui-kit/react';

type Profile = { id: string; name: string; assetGuid: string; assetTitle?: string; assetType?: string };
type Schedule = { id: string; name: string; weekday: number; time: string; profileId: string; beforeMinutes: number; durationMinutes: number; enabled: boolean };
type SetlistMapping = { setlistId: string; setlistName: string; profileId: string };
type Config = { profiles: Profile[]; schedules: Schedule[]; setlistMappings: SetlistMapping[]; manualProfileId: string | null; bibleLayer: number; backgroundLayer: number; timeZone: string };
type Asset = { guid: string; title?: string; author?: string; type?: string };
type Layer = { index: number; name?: string };
type Setlist = { id: string; name?: string; title?: string };
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const TIME_ZONE_OPTIONS = [
  { zone: 'Africa/Johannesburg', country: 'África do Sul', city: 'Joanesburgo', keywords: 'Johannesburg' },
  { zone: 'Europe/Berlin', country: 'Alemanha', city: 'Berlim', keywords: 'Berlin' },
  { zone: 'America/Argentina/Buenos_Aires', country: 'Argentina', city: 'Buenos Aires', keywords: '' },
  { zone: 'Australia/Adelaide', country: 'Austrália', city: 'Adelaide', keywords: '' },
  { zone: 'Australia/Sydney', country: 'Austrália', city: 'Sydney', keywords: 'Melbourne' },
  { zone: 'Asia/Dhaka', country: 'Bangladesh', city: 'Daca', keywords: 'Dhaka' },
  { zone: 'America/Rio_Branco', country: 'Brasil', city: 'Rio Branco', keywords: 'Acre' },
  { zone: 'America/Manaus', country: 'Brasil', city: 'Manaus', keywords: 'Amazonas Cuiaba Mato Grosso' },
  { zone: 'America/Sao_Paulo', country: 'Brasil', city: 'São Paulo / Brasília', keywords: 'Rio de Janeiro' },
  { zone: 'America/Noronha', country: 'Brasil', city: 'Fernando de Noronha', keywords: '' },
  { zone: 'America/Toronto', country: 'Canadá', city: 'Toronto', keywords: '' },
  { zone: 'America/Vancouver', country: 'Canadá', city: 'Vancouver', keywords: '' },
  { zone: 'America/Santiago', country: 'Chile', city: 'Santiago', keywords: '' },
  { zone: 'Asia/Shanghai', country: 'China', city: 'Xangai / Pequim', keywords: 'Shanghai Beijing' },
  { zone: 'America/Bogota', country: 'Colômbia', city: 'Bogotá', keywords: 'Bogota' },
  { zone: 'Asia/Seoul', country: 'Coreia do Sul', city: 'Seul', keywords: 'Seoul' },
  { zone: 'Africa/Cairo', country: 'Egito', city: 'Cairo', keywords: '' },
  { zone: 'Asia/Dubai', country: 'Emirados Árabes Unidos', city: 'Dubai', keywords: '' },
  { zone: 'Europe/Madrid', country: 'Espanha', city: 'Madri', keywords: 'Madrid' },
  { zone: 'America/Anchorage', country: 'Estados Unidos', city: 'Anchorage', keywords: 'Alasca Alaska' },
  { zone: 'America/Chicago', country: 'Estados Unidos', city: 'Chicago', keywords: '' },
  { zone: 'America/Denver', country: 'Estados Unidos', city: 'Denver', keywords: '' },
  { zone: 'Pacific/Honolulu', country: 'Estados Unidos', city: 'Honolulu', keywords: 'Havai Hawaii' },
  { zone: 'America/Los_Angeles', country: 'Estados Unidos', city: 'Los Angeles', keywords: '' },
  { zone: 'America/New_York', country: 'Estados Unidos', city: 'Nova York', keywords: 'New York' },
  { zone: 'Europe/Helsinki', country: 'Finlândia', city: 'Helsinque', keywords: 'Helsinki' },
  { zone: 'Europe/Paris', country: 'França', city: 'Paris', keywords: '' },
  { zone: 'Europe/Athens', country: 'Grécia', city: 'Atenas', keywords: 'Athens' },
  { zone: 'Asia/Kolkata', country: 'Índia', city: 'Nova Délhi / Calcutá', keywords: 'Kolkata Delhi Mumbai' },
  { zone: 'Asia/Jakarta', country: 'Indonésia', city: 'Jacarta', keywords: 'Jakarta' },
  { zone: 'Europe/Dublin', country: 'Irlanda', city: 'Dublin', keywords: '' },
  { zone: 'Europe/Rome', country: 'Itália', city: 'Roma', keywords: 'Rome' },
  { zone: 'Asia/Tokyo', country: 'Japão', city: 'Tóquio', keywords: 'Tokyo' },
  { zone: 'Pacific/Kiritimati', country: 'Kiribati', city: 'Kiritimati', keywords: 'Ilha Christmas' },
  { zone: 'Asia/Kuala_Lumpur', country: 'Malásia', city: 'Kuala Lumpur', keywords: '' },
  { zone: 'America/Mexico_City', country: 'México', city: 'Cidade do México', keywords: 'Mexico City' },
  { zone: 'Pacific/Noumea', country: 'Nova Caledônia', city: 'Nouméa', keywords: 'Noumea' },
  { zone: 'Pacific/Auckland', country: 'Nova Zelândia', city: 'Auckland', keywords: '' },
  { zone: 'Asia/Karachi', country: 'Paquistão', city: 'Karachi', keywords: '' },
  { zone: 'America/Lima', country: 'Peru', city: 'Lima', keywords: '' },
  { zone: 'Europe/Lisbon', country: 'Portugal', city: 'Lisboa', keywords: '' },
  { zone: 'Atlantic/Azores', country: 'Portugal', city: 'Açores', keywords: 'Azores' },
  { zone: 'Europe/London', country: 'Reino Unido', city: 'Londres', keywords: 'London Inglaterra' },
  { zone: 'Europe/Moscow', country: 'Rússia', city: 'Moscou', keywords: 'Moscow' },
  { zone: 'Pacific/Pago_Pago', country: 'Samoa Americana', city: 'Pago Pago', keywords: '' },
  { zone: 'Asia/Singapore', country: 'Singapura', city: 'Singapura', keywords: 'Singapore' },
  { zone: 'Asia/Bangkok', country: 'Tailândia', city: 'Bangkok', keywords: '' },
  { zone: 'UTC', country: 'Tempo Universal', city: 'Greenwich', keywords: 'UTC GMT' },
  { zone: 'America/Caracas', country: 'Venezuela', city: 'Caracas', keywords: '' },
].sort((a, b) => a.country.localeCompare(b.country, 'pt-BR') || a.city.localeCompare(b.city, 'pt-BR'));
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const typeLabel = (type?: string) => type === 'image' ? 'Imagem' : type === 'backgroundVideo' ? 'Fundo' : type === 'video' ? 'Vídeo' : (type ?? 'Mídia');

export function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [outputs, setOutputs] = useState<Array<{ index: number; name: string }>>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [setlistInfo, setSetlistInfo] = useState('');
  const [output, setOutput] = useState('0');
  const [status, setStatus] = useState<any>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [backups, setBackups] = useState<Record<string, Profile>>({});
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [timeZoneQuery, setTimeZoneQuery] = useState('');
  const [timeZonePickerOpen, setTimeZonePickerOpen] = useState(false);

  useEffect(() => {
    let initialized = false;
    const off = onMessage((raw) => {
      const msg = raw as any;
      if (msg.type === 'init') {
        initialized = true;
        setConfig(msg.config); setAssets(msg.assets ?? []); setLayers(msg.layers ?? []); setOutputs(msg.outputs ?? []); setSetlists(msg.setlists ?? []); setSetlistInfo(msg.setlistInfo ?? ''); setStatus(msg.status ?? {});
        if (msg.outputs?.length) setOutput(String(msg.outputs[0].index));
      }
      if (msg.type === 'status') setStatus(msg.status ?? {});
    });
    postMessage({ type: 'init' });
    const retry = window.setInterval(() => { if (!initialized) postMessage({ type: 'init' }); }, 700);
    return () => { window.clearInterval(retry); off(); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!config) return <Root><Header title="Fundos por Culto" subtitle="Carregando…" /></Root>;
  const update = (patch: Partial<Config>) => setConfig({ ...config, ...patch });
  const mode: 'automatic' | 'manual' = config.manualProfileId ? 'manual' : 'automatic';
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

  const timeZoneLabel = (zone: string) => {
    const option = TIME_ZONE_OPTIONS.find((item) => item.zone === zone);
    const friendly = option ? `${option.country} - ${option.city}` : zone.split('/').map((part) => part.replace(/_/g, ' ')).join(' - ');
    try {
      const offset = new Intl.DateTimeFormat('pt-BR', { timeZone: zone, timeZoneName: 'shortOffset' } as any).formatToParts(clockNow).find((part) => part.type === 'timeZoneName')?.value;
      const match = offset?.match(/GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/);
      const formattedOffset = !match?.[1] ? 'UTC+00:00' : `UTC${match[1]}${String(match[2]).padStart(2, '0')}:${match[3] ?? '00'}`;
      return `${friendly} - ${formattedOffset}`;
    } catch { return friendly; }
  };
  const filteredTimeZones = TIME_ZONE_OPTIONS.filter((item) => normalize(`${item.zone} ${item.country} ${item.city} ${item.keywords} ${timeZoneLabel(item.zone)}`).includes(normalize(timeZoneQuery.trim())));

  const assetValue = (asset: Asset) => `${asset.title ?? asset.guid} — ${typeLabel(asset.type)}`;
  const searchableText = (asset: Asset) => Object.values(asset).filter((value) => typeof value === 'string' || typeof value === 'number').join(' ');
  const filteredAssets = (query: string) => {
    const needle = normalize(query.trim());
    return needle ? assets.filter((asset) => normalize(`${searchableText(asset)} ${typeLabel(asset.type)}`).includes(needle)) : assets;
  };
  const changeMedia = (profileId: string, value: string) => {
    setQueries((old) => ({ ...old, [profileId]: value }));
    setOpenPicker(profileId);
    setErrors((old) => ({ ...old, [profileId]: '' }));
    const asset = assets.find((item) => assetValue(item) === value);
    update({ profiles: config.profiles.map((p) => p.id === profileId ? asset ? { ...p, assetGuid: asset.guid, assetTitle: asset.title ?? asset.guid, assetType: asset.type } : { ...p, assetGuid: '', assetTitle: '', assetType: '' } : p) });
  };
  const selectMedia = (profileId: string, asset: Asset) => {
    const value = assetValue(asset);
    setQueries((old) => ({ ...old, [profileId]: value }));
    setErrors((old) => ({ ...old, [profileId]: '' }));
    setOpenPicker(null);
    update({ profiles: config.profiles.map((p) => p.id === profileId ? { ...p, assetGuid: asset.guid, assetTitle: asset.title ?? asset.guid, assetType: asset.type } : p) });
  };

  const saveProfile = (profileId: string) => {
    const profile = config.profiles.find((p) => p.id === profileId);
    if (!profile?.name.trim()) { setErrors((old) => ({ ...old, [profileId]: 'Informe o nome do perfil.' })); return; }
    if (!profile.assetGuid) { setErrors((old) => ({ ...old, [profileId]: 'Escolha uma imagem ou vídeo.' })); return; }
    postMessage({ type: 'save', config });
    setEditing((old) => ({ ...old, [profileId]: false }));
    setOpenPicker(null);
    setBackups((old) => { const next = { ...old }; delete next[profileId]; return next; });
  };

  const cancelProfile = (profileId: string) => {
    const backup = backups[profileId];
    setConfig(backup ? { ...config, profiles: config.profiles.map((p) => p.id === profileId ? backup : p) } : { ...config, profiles: config.profiles.filter((p) => p.id !== profileId) });
    setEditing((old) => ({ ...old, [profileId]: false }));
    setOpenPicker(null);
    setBackups((old) => { const next = { ...old }; delete next[profileId]; return next; });
  };

  const deleteProfile = (profileId: string) => {
    const next = { ...config, profiles: config.profiles.filter((p) => p.id !== profileId), schedules: config.schedules.map((s) => s.profileId === profileId ? { ...s, profileId: '' } : s), setlistMappings: config.setlistMappings.filter((item) => item.profileId !== profileId), manualProfileId: config.manualProfileId === profileId ? null : config.manualProfileId };
    setConfig(next); postMessage({ type: 'save', config: next }); setConfirmDelete(null);
  };

  const setlistName = (setlist: Setlist) => setlist.name ?? setlist.title ?? setlist.id;
  const setSetlistProfile = (setlist: Setlist, profileId: string) => {
    const remaining = config.setlistMappings.filter((item) => item.setlistId !== setlist.id);
    update({ setlistMappings: profileId ? [...remaining, { setlistId: setlist.id, setlistName: setlistName(setlist), profileId }] : remaining });
  };

  return <Root>
    <Header title="Fundos por Culto" subtitle="Imagem ou vídeo automático para versículos da Bíblia" />
    <Panel label="Modo atual">
      <Segmented value={mode} options={[{ value: 'automatic', label: 'Automático' }, { value: 'manual', label: 'Manual' }]} onChange={(value) => update({ manualProfileId: value === 'automatic' ? null : (config.profiles[0]?.id ?? null) })} />
      {mode === 'manual' && <Field label="Perfil ativo"><Select value={config.manualProfileId ?? ''} onChange={(e) => update({ manualProfileId: e.target.value || null })}><option value="">Escolha…</option>{config.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>}
      <StatusIndicator state={status.activeProfile ? 'ok' : 'warn'} label={status.activeProfile ? `Ativo: ${status.activeProfile}` : 'Sem fundo ativo'} detail={status.source} />
    </Panel>

    <Panel label="Perfis de fundo"><Stack>
      {config.profiles.map((p) => editing[p.id] ? <div key={p.id} style={{ borderBottom: '1px solid var(--sp-border)', paddingBottom: 12 }}>
        <Field label="Nome do perfil"><TextInput value={p.name} onChange={(e) => update({ profiles: config.profiles.map((x) => x.id === p.id ? { ...x, name: e.target.value } : x) })} placeholder="Ex.: Culto de domingo" /></Field>
        <Field label="Escolher arquivo de mídia" hint={errors[p.id] || `${filteredAssets(queries[p.id] ?? '').length} de ${assets.length} mídias. A pesquisa ignora acentos e maiúsculas.`}>
          <TextInput value={queries[p.id] ?? (p.assetTitle ? `${p.assetTitle} — ${typeLabel(p.assetType)}` : '')} onChange={(e) => changeMedia(p.id, e.target.value)} onFocus={() => setOpenPicker(p.id)} placeholder="Escolha ou digite o nome…" autoComplete="off" />
          {openPicker === p.id && <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--sp-border-strong)', borderRadius: 8, background: 'var(--sp-bg-inset)' }}>
            {filteredAssets(queries[p.id] ?? '').map((asset) => <button key={asset.guid} type="button" onMouseDown={(e) => { e.preventDefault(); selectMedia(p.id, asset); }} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 11px', border: 0, borderBottom: '1px solid var(--sp-border)', background: 'transparent', color: 'var(--sp-text)', textAlign: 'left', cursor: 'pointer' }}><span>{asset.title ?? asset.guid}</span><span style={{ color: 'var(--sp-text-muted)', whiteSpace: 'nowrap' }}>{typeLabel(asset.type)}</span></button>)}
            {filteredAssets(queries[p.id] ?? '').length === 0 && <div style={{ padding: 10, color: 'var(--sp-text-muted)', fontSize: 12 }}>Nenhuma mídia encontrada.</div>}
          </div>}
        </Field>
        {p.assetGuid && <div style={{ fontSize: 12, color: 'var(--sp-text-muted)', marginTop: 6 }}>Selecionado: {p.assetTitle ?? p.assetGuid} — {typeLabel(p.assetType)}</div>}
        <Row style={{ marginTop: 10 }}><Button variant="success" onClick={() => saveProfile(p.id)}>Salvar perfil</Button><Button onClick={() => cancelProfile(p.id)}>Cancelar</Button></Row>
      </div> : <div key={p.id} style={{ borderBottom: '1px solid var(--sp-border)', paddingBottom: 10 }}>
        <Row style={{ alignItems: 'center' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 12, color: 'var(--sp-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.assetTitle || 'Nenhuma mídia selecionada'}{p.assetType ? ` — ${typeLabel(p.assetType)}` : ''}</div></div><Button size="sm" onClick={() => { setBackups((old) => ({ ...old, [p.id]: { ...p } })); setEditing((old) => ({ ...old, [p.id]: true })); setQueries((old) => ({ ...old, [p.id]: p.assetTitle ?? '' })); }}>Editar</Button>{confirmDelete === p.id ? <><Button size="sm" variant="danger" onClick={() => deleteProfile(p.id)}>Confirmar</Button><Button size="sm" onClick={() => setConfirmDelete(null)}>Cancelar</Button></> : <Button size="sm" variant="danger" onClick={() => setConfirmDelete(p.id)}>Excluir</Button>}</Row>
      </div>)}
      <Button onClick={() => { const id = uid(); update({ profiles: [...config.profiles, { id, name: '', assetGuid: '' }] }); setEditing((old) => ({ ...old, [id]: true })); }}>+ Adicionar perfil</Button>
    </Stack></Panel>

    <Panel label="Fundos por setlist">
      <div style={{ fontSize: 12, color: 'var(--sp-text-muted)' }}>Quando uma setlist associada estiver ativa, ela terá prioridade sobre a agenda por dia e horário.</div>
      <Button size="sm" onClick={() => postMessage({ type: 'refresh-setlists' })}>Atualizar setlists</Button>
      <Stack>
        {setlists.map((setlist) => {
          const mapping = config.setlistMappings.find((item) => item.setlistId === setlist.id);
          return <Row key={setlist.id} style={{ alignItems: 'center' }}><div style={{ flex: 1, minWidth: 0, fontWeight: 500 }}>{setlistName(setlist)}</div><Field label="Perfil de fundo"><Select value={mapping?.profileId ?? ''} onChange={(e) => setSetlistProfile(setlist, e.target.value)}><option value="">Usar dia e horário</option>{config.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name || 'Perfil sem nome'}</option>)}</Select></Field></Row>;
        })}
        {setlists.length === 0 && <div style={{ fontSize: 12, color: 'var(--sp-text-muted)', fontStyle: 'italic' }}>Nenhuma setlist salva encontrada.</div>}
        {setlistInfo && <div style={{ fontSize: 11, color: 'var(--sp-text-muted)' }}>Diagnóstico: {setlistInfo}</div>}
      </Stack>
    </Panel>

    <Panel label="Agenda automática"><Stack>
      <Field label="Região de horário" hint="Digite uma cidade, continente ou região e escolha uma opção.">
        <TextInput value={timeZonePickerOpen ? timeZoneQuery : timeZoneLabel(config.timeZone || 'America/Sao_Paulo')} onFocus={() => { setTimeZoneQuery(''); setTimeZonePickerOpen(true); }} onChange={(e) => { setTimeZoneQuery(e.target.value); setTimeZonePickerOpen(true); }} placeholder="Ex.: Lisboa, New York, Tokyo…" autoComplete="off" />
        {timeZonePickerOpen && <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--sp-border-strong)', borderRadius: 8, background: 'var(--sp-bg-inset)' }}>
          {filteredTimeZones.map((item) => <button key={item.zone} type="button" onMouseDown={(e) => { e.preventDefault(); update({ timeZone: item.zone }); setTimeZoneQuery(''); setTimeZonePickerOpen(false); }} style={{ width: '100%', padding: '9px 11px', border: 0, borderBottom: '1px solid var(--sp-border)', background: 'transparent', color: 'var(--sp-text)', textAlign: 'left', cursor: 'pointer' }}>{timeZoneLabel(item.zone)}</button>)}
          {filteredTimeZones.length === 0 && <div style={{ padding: 10, color: 'var(--sp-text-muted)', fontSize: 12 }}>Nenhuma região encontrada.</div>}
        </div>}
      </Field>
      <div style={{ padding: 10, border: '1px solid var(--sp-border)', borderRadius: 8, background: 'var(--sp-bg-inset)' }}>
        <div style={{ fontSize: 11, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>Horário atual da região</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3 }}>{new Intl.DateTimeFormat('pt-BR', { timeZone: config.timeZone || 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(clockNow)}</div>
        <div style={{ fontSize: 12, color: 'var(--sp-text-muted)', marginTop: 5 }}>Confira se a data e a hora do Windows estão corretas. O plugin não altera o relógio do computador.</div>
      </div>
      {config.schedules.map((s) => <div key={s.id} style={{ borderBottom: '1px solid var(--sp-border)', paddingBottom: 10 }}><Row><Checkbox label="Ativo" checked={s.enabled} onChange={(e) => update({ schedules: config.schedules.map((x) => x.id === s.id ? { ...x, enabled: e.target.checked } : x) })} /><Field label="Nome"><TextInput value={s.name} onChange={(e) => update({ schedules: config.schedules.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x) })} /></Field><Field label="Dia"><Select value={s.weekday} onChange={(e) => update({ schedules: config.schedules.map((x) => x.id === s.id ? { ...x, weekday: Number(e.target.value) } : x) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select></Field><Field label="Horário"><TextInput type="time" value={s.time} onChange={(e) => update({ schedules: config.schedules.map((x) => x.id === s.id ? { ...x, time: e.target.value } : x) })} /></Field></Row><Row><Field label="Perfil"><Select value={s.profileId} onChange={(e) => update({ schedules: config.schedules.map((x) => x.id === s.id ? { ...x, profileId: e.target.value } : x) })}><option value="">Escolha…</option>{config.profiles.map((p) => <option key={p.id} value={p.id}>{p.name || 'Perfil sem nome'}</option>)}</Select></Field><Field label="Ativar antes (min)"><TextInput type="number" min="0" value={s.beforeMinutes} onChange={(e) => update({ schedules: config.schedules.map((x) => x.id === s.id ? { ...x, beforeMinutes: Number(e.target.value) } : x) })} /></Field><Field label="Duração após início (min)"><TextInput type="number" min="1" value={s.durationMinutes} onChange={(e) => update({ schedules: config.schedules.map((x) => x.id === s.id ? { ...x, durationMinutes: Number(e.target.value) } : x) })} /></Field><Button variant="danger" size="sm" onClick={() => update({ schedules: config.schedules.filter((x) => x.id !== s.id) })}>Excluir</Button></Row></div>)}
      <Button onClick={() => update({ schedules: [...config.schedules, { id: uid(), name: 'Culto extra', weekday: 1, time: '19:30', profileId: '', beforeMinutes: 90, durationMinutes: 330, enabled: true }] })}>+ Adicionar horário</Button>
    </Stack></Panel>

    <Panel label="Camadas e teste"><Row><Field label="Camada da Bíblia"><Select value={config.bibleLayer} onChange={(e) => update({ bibleLayer: Number(e.target.value) })}>{layers.map((l) => <option key={l.index} value={l.index}>{l.index} — {l.name ?? 'Camada'}</option>)}</Select></Field><Field label="Camada do fundo"><Select value={config.backgroundLayer} onChange={(e) => update({ backgroundLayer: Number(e.target.value) })}>{layers.map((l) => <option key={l.index} value={l.index}>{l.index} — {l.name ?? 'Camada'}</option>)}</Select></Field><Field label="Saída de teste"><Select value={output} onChange={(e) => setOutput(e.target.value)}>{outputs.map((o) => <option key={o.index} value={o.index}>{o.name}</option>)}</Select></Field></Row><Row><Button onClick={() => postMessage({ type: 'diagnose', output, config })}>Diagnosticar Bíblia ao vivo</Button><Button variant="primary" onClick={() => postMessage({ type: 'test', output, config })}>Testar fundo agora</Button></Row>{status.lastDiagnostic && <div style={{ fontSize: 12, color: 'var(--sp-text-muted)' }}>Diagnóstico: camada {status.lastDiagnostic.layer}; tipo “{status.lastDiagnostic.assetType || 'vazio'}”; Bíblia reconhecida: {status.lastDiagnostic.detectedAsBible ? 'sim' : 'não'}.</div>}{status.lastAction && <div style={{ fontSize: 12 }}>{status.lastAction}</div>}</Panel>
    <Button variant="success" block onClick={() => postMessage({ type: 'save', config })}>Salvar configurações gerais</Button>
  </Root>;
}
