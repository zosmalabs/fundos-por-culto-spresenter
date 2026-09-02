/// <reference types="@spresenter/plugin-sdk/code" />

type Schedule = { id: string; name: string; weekday: number; time: string; profileId: string; beforeMinutes: number; durationMinutes: number; enabled: boolean };
type Profile = { id: string; name: string; assetGuid: string; assetTitle?: string; assetType?: string };
type SetlistMapping = { setlistId: string; setlistName: string; profileId: string };
type Config = { profiles: Profile[]; schedules: Schedule[]; setlistMappings: SetlistMapping[]; manualProfileId: string | null; bibleLayer: number; backgroundLayer: number; timeZone: string };

const DEFAULT_CONFIG: Config = {
  profiles: [],
  schedules: [
    { id: 'thu-1930', name: 'Culto de quinta', weekday: 4, time: '19:30', profileId: '', beforeMinutes: 90, durationMinutes: 330, enabled: true },
    { id: 'sat-1930', name: 'Culto de sábado', weekday: 6, time: '19:30', profileId: '', beforeMinutes: 90, durationMinutes: 330, enabled: true },
    { id: 'sun-1845', name: 'Culto de domingo', weekday: 0, time: '18:45', profileId: '', beforeMinutes: 90, durationMinutes: 330, enabled: true },
  ],
  setlistMappings: [],
  manualProfileId: null,
  bibleLayer: 1,
  backgroundLayer: 0,
  timeZone: 'America/Sao_Paulo',
};

let config: Config = DEFAULT_CONFIG;
const applying = new Set<string>();
let lastStatus: Record<string, unknown> = {};
const liveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const forceNextOutputs = new Set<string>();

function mergeConfig(value: Partial<Config> | null | undefined): Config {
  return {
    ...DEFAULT_CONFIG,
    ...(value ?? {}),
    profiles: Array.isArray(value?.profiles) ? value!.profiles.map((p: any) => ({ id: p.id, name: p.name, assetGuid: p.assetGuid ?? '', assetTitle: p.assetTitle, assetType: p.assetType })) : [],
    schedules: Array.isArray(value?.schedules) ? value!.schedules : DEFAULT_CONFIG.schedules,
    setlistMappings: Array.isArray(value?.setlistMappings) ? value!.setlistMappings : [],
  };
}

async function loadConfig() { config = mergeConfig(await spresenter.storage.get<Config>('config')); }
const ready = loadConfig();
async function saveConfig(next: Config) { config = mergeConfig(next); await spresenter.storage.set('config', config); }
function zonedNow(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: weekdays[value('weekday')] ?? 0, hour: Number(value('hour')), minute: Number(value('minute')) };
}

function scheduleIsActive(item: Schedule, now = new Date()) {
  if (!item.enabled || !item.profileId || !/^\d{2}:\d{2}$/.test(item.time)) return false;
  const [hour, minute] = item.time.split(':').map(Number);
  const start = item.weekday * 1440 + hour * 60 + minute - Math.max(0, item.beforeMinutes || 0);
  const end = start + Math.max(1, item.beforeMinutes || 0) + Math.max(1, item.durationMinutes || 1);
  const zoned = zonedNow(config.timeZone, now);
  const current = zoned.weekday * 1440 + zoned.hour * 60 + zoned.minute;
  const week = 7 * 1440;
  return [current, current + week, current - week].some((value) => value >= start && value <= end);
}

async function activeSelection() {
  if (config.manualProfileId) return { profile: config.profiles.find((p) => p.id === config.manualProfileId), source: 'manual' };
  try {
    const active: any = await spresenter.setlists.getActive();
    if (active) {
      const activeId = String(active.id ?? active.guid ?? active.setlistId ?? '');
      const activeName = String(active.title ?? active.name ?? 'Setlist ativa');
      const normalizeName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const mapping = config.setlistMappings.find((item) => item.profileId && ((activeId && item.setlistId === activeId) || normalizeName(item.setlistName) === normalizeName(activeName)));
      const profile = config.profiles.find((item) => item.id === mapping?.profileId);
      if (mapping && profile) return { profile, source: `Setlist: ${activeName}` };
    }
  } catch { /* usa a agenda como fallback */ }
  const schedule = config.schedules.find((item) => scheduleIsActive(item));
  return { profile: config.profiles.find((p) => p.id === schedule?.profileId), source: schedule ? schedule.name : 'fora da agenda' };
}

function looksLikeBible(presentation: any) {
  if (!presentation) return false;
  const values = [presentation.asset?.type, presentation.asset?.category, presentation.asset?.title, presentation.title, presentation.props?.type, presentation.props?.source, presentation.props?.contentType]
    .filter(Boolean).map((v) => String(v).toLowerCase());
  return values.some((v) => /b[ií]bl|bible|scripture|vers[ií]culo|verse/.test(v));
}

async function sendStatus(extra: Record<string, unknown> = {}) {
  const selection = await activeSelection();
  lastStatus = { ...lastStatus, mode: config.manualProfileId ? 'manual' : 'automatic', activeProfile: selection.profile?.name ?? null, source: selection.source, ...extra };
  spresenter.ui.postMessage({ type: 'status', status: lastStatus });
}

async function getMedia(query = '') {
  const method = query.trim() ? 'search' : 'list';
  const q = query.trim();
  const [images, backgrounds, videos] = await Promise.all([
    method === 'search' ? spresenter.assets.search(q, { type: 'image' }) : spresenter.assets.list({ type: 'image' }),
    method === 'search' ? spresenter.assets.search(q, { type: 'backgroundVideo' }) : spresenter.assets.list({ type: 'backgroundVideo' }),
    method === 'search' ? spresenter.assets.search(q, { type: 'video' }) : spresenter.assets.list({ type: 'video' }),
  ]);
  const unique = new Map<string, any>();
  [...images, ...backgrounds, ...videos].forEach((asset) => unique.set(asset.guid, asset));
  return [...unique.values()].sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? ''), 'pt-BR'));
}

function setlistArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of ['setlists', 'events', 'items', 'data', 'files', 'results']) if (Array.isArray(value[key])) return value[key];
  return [];
}

function normalizeSetlists(value: any) {
  return setlistArray(value).map((item: any, index: number) => {
    const source = item && typeof item === 'object' ? item : { name: String(item) };
    const id = String(source.id ?? source.guid ?? source.setlistId ?? source.fileId ?? source.path ?? source.name ?? source.title ?? index);
    const name = String(source.name ?? source.title ?? source.label ?? source.fileName ?? source.filename ?? id);
    return { ...source, id, name };
  }).filter((item: any) => item.id);
}

async function getSavedSetlists() {
  const errors: string[] = [];
  const found = new Map<string, any>();
  const readers: Array<[string, () => Promise<any>]> = [['setlists.list', () => spresenter.setlists.list()], ['events.list', () => spresenter.events.list()]];
  for (const [label, read] of readers) {
    try { normalizeSetlists(await read()).forEach((item: any) => found.set(item.id, item)); }
    catch (error) { errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return { setlists: [...found.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR')), info: found.size ? `${found.size} setlist(s) encontrada(s).` : errors.length ? errors.join(' | ') : 'O Spresenter retornou uma lista vazia.' };
}

async function applyBackground(output: string, force = false) {
  if (applying.has(output)) return;
  applying.add(output);
  try {
    const live = await spresenter.live.read(output);
    const bible = live[config.bibleLayer];
    const diagnostic = bible ? { layer: config.bibleLayer, title: bible.title ?? bible.asset?.title ?? '', assetType: bible.asset?.type ?? '', category: bible.asset?.category ?? '', detectedAsBible: looksLikeBible(bible) } : { layer: config.bibleLayer, empty: true, detectedAsBible: false };
    if (!force && !looksLikeBible(bible)) { await sendStatus({ lastDiagnostic: diagnostic, lastAction: 'Conteúdo ignorado: não identificado como Bíblia.' }); return; }
    const { profile, source } = await activeSelection();
    if (!profile?.assetGuid) { await sendStatus({ lastDiagnostic: diagnostic, lastAction: 'Nenhuma imagem ou vídeo ativo para este horário.' }); return; }
    const asset = await spresenter.assets.get(profile.assetGuid);
    if (!asset) { await sendStatus({ lastDiagnostic: diagnostic, lastAction: `Mídia do perfil “${profile.name}” não encontrada.` }); return; }
    await spresenter.live.setState(output, config.backgroundLayer, { show: true, opacity: 1 });
    const currentBackground = live[config.backgroundLayer];
    const mustForce = force || forceNextOutputs.has(output);
    if (!mustForce && currentBackground?.asset?.guid === asset.guid) { await sendStatus({ lastDiagnostic: diagnostic, lastAction: `Fundo “${profile.name}” já está aplicado.` }); return; }
    await spresenter.live.apply(output, config.backgroundLayer, { title: profile.name, asset });
    forceNextOutputs.delete(output);
    await sendStatus({ lastDiagnostic: diagnostic, lastAction: `Fundo “${profile.name}” aplicado (${source}).` });
  } catch (error) {
    await sendStatus({ lastAction: `Erro: ${error instanceof Error ? error.message : String(error)}` });
  } finally { applying.delete(output); }
}

function scheduleApply(output: string, delay = 220) {
  const previous = liveTimers.get(output);
  if (previous) clearTimeout(previous);
  liveTimers.set(output, setTimeout(() => {
    liveTimers.delete(output);
    void ready.then(() => applyBackground(output));
  }, delay));
}

async function listData() {
  const [outputs, layers, assets, saved] = await Promise.all([spresenter.outputs.list(), spresenter.layers.list(), getMedia(''), getSavedSetlists()]);
  spresenter.ui.postMessage({ type: 'init', config, outputs, layers, assets, setlists: saved.setlists, setlistInfo: saved.info, status: lastStatus });
}

spresenter.ui.onmessage = async (raw: unknown) => {
  await ready;
  const msg = raw as { type?: string; config?: Config; output?: string; profileId?: string; query?: string; requestId?: number };
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'init') await listData();
  if (msg.type === 'refresh-setlists') await listData();
  if (msg.type === 'save' && msg.config) { await saveConfig(msg.config); await sendStatus({ lastAction: 'Configurações salvas.' }); await listData(); }
  if (msg.type === 'search-media' && msg.profileId) {
    try { spresenter.ui.postMessage({ type: 'search-results', profileId: msg.profileId, requestId: msg.requestId, results: await getMedia(msg.query ?? '') }); }
    catch (error) { spresenter.ui.postMessage({ type: 'search-results', profileId: msg.profileId, requestId: msg.requestId, results: [], error: error instanceof Error ? error.message : String(error) }); }
  }
  if (msg.type === 'test') { if (msg.config) await saveConfig(msg.config); const outputs = await spresenter.outputs.list(); await applyBackground(msg.output ?? String(outputs[0]?.index ?? 0), true); }
  if (msg.type === 'diagnose') {
    if (msg.config) await saveConfig(msg.config);
    const outputs = await spresenter.outputs.list();
    const output = msg.output ?? String(outputs[0]?.index ?? 0);
    const live = await spresenter.live.read(output);
    const p: any = live[config.bibleLayer];
    await sendStatus({ lastDiagnostic: p ? { layer: config.bibleLayer, title: p.title ?? p.asset?.title ?? '', assetType: p.asset?.type ?? '', category: p.asset?.category ?? '', detectedAsBible: looksLikeBible(p) } : { layer: config.bibleLayer, empty: true }, lastAction: 'Diagnóstico atualizado.' });
  }
};

spresenter.on('live', ({ output }) => { scheduleApply(String(output ?? '0')); });
void ready.then(async () => {
  await sendStatus({ lastAction: 'Plugin iniciado.' });
  const outputs = await spresenter.outputs.list();
  outputs.forEach((item) => { const id = String(item.index); forceNextOutputs.add(id); scheduleApply(id, 650); });
  setTimeout(async () => {
    try {
      const panelId = `plugin:${spresenter.manifest.id}:main`;
      const { panels } = await spresenter.panels.list();
      const panel = panels.find((item) => item.id === panelId);
      if (!panel?.open) return;
      const wasFloating = panel.location === 'floating';
      await spresenter.panels.close(panelId);
      const reopened = await spresenter.panels.open(panelId, wasFloating ? { float: true } : undefined);
      if (panel.location === 'grid' && reopened.location !== 'grid') await spresenter.panels.dock(panelId);
      await spresenter.panels.select(panelId);
    } catch (error) {
      console.warn('Não foi possível atualizar o painel restaurado:', error);
    }
  }, 1800);
});
