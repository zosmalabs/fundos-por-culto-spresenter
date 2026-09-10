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

const textValue = (value: unknown, fallback = '') => typeof value === 'string' ? value.trim() : fallback;
const integerValue = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.trunc(number))) : fallback;
};
const validTimeZone = (value: unknown) => {
  const timeZone = textValue(value, DEFAULT_CONFIG.timeZone);
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(); return timeZone; }
  catch { return DEFAULT_CONFIG.timeZone; }
};

function mergeConfig(value: Partial<Config> | null | undefined): Config {
  const profiles = Array.isArray(value?.profiles) ? value.profiles.map((profile: any) => ({
    id: textValue(profile?.id),
    name: textValue(profile?.name),
    assetGuid: textValue(profile?.assetGuid),
    assetTitle: textValue(profile?.assetTitle) || undefined,
    assetType: textValue(profile?.assetType) || undefined,
  })).filter((profile) => profile.id) : [];
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const schedules = Array.isArray(value?.schedules) ? value.schedules.map((schedule: any, index) => ({
    id: textValue(schedule?.id, `schedule-${index}`),
    name: textValue(schedule?.name, 'Culto'),
    weekday: integerValue(schedule?.weekday, 0, 6, 0),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(textValue(schedule?.time)) ? textValue(schedule.time) : '19:30',
    profileId: profileIds.has(textValue(schedule?.profileId)) ? textValue(schedule.profileId) : '',
    beforeMinutes: integerValue(schedule?.beforeMinutes, 0, 1440, 90),
    durationMinutes: integerValue(schedule?.durationMinutes, 1, 1440, 330),
    enabled: schedule?.enabled !== false,
  })) : DEFAULT_CONFIG.schedules.map((schedule) => ({ ...schedule }));
  const setlistMappings = Array.isArray(value?.setlistMappings) ? value.setlistMappings.map((mapping: any) => ({
    setlistId: textValue(mapping?.setlistId),
    setlistName: textValue(mapping?.setlistName),
    profileId: textValue(mapping?.profileId),
  })).filter((mapping) => mapping.setlistId && profileIds.has(mapping.profileId)) : [];
  const manualProfileId = textValue(value?.manualProfileId);
  return {
    profiles,
    schedules,
    setlistMappings,
    manualProfileId: profileIds.has(manualProfileId) ? manualProfileId : null,
    bibleLayer: integerValue(value?.bibleLayer, 0, 99, DEFAULT_CONFIG.bibleLayer),
    backgroundLayer: integerValue(value?.backgroundLayer, 0, 99, DEFAULT_CONFIG.backgroundLayer),
    timeZone: validTimeZone(value?.timeZone),
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
  const exactTypes = [presentation.type, presentation.asset?.type, presentation.props?.type, presentation.props?.contentType]
    .filter(Boolean).map((value) => String(value).toLowerCase());
  if (exactTypes.includes('bible')) return true;
  // Compatibilidade com versões antigas que não informavam asset.type.
  const legacyValues = [presentation.asset?.category, presentation.props?.source]
    .filter(Boolean).map((value) => String(value).toLowerCase());
  return legacyValues.some((value) => /b[ií]bl|bible|scripture/.test(value));
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

async function getSavedSetlists() {
  try {
    const saved = await spresenter.setlists.list();
    const setlists = saved.map((item: any) => ({ ...item, id: String(item.id), name: String(item.title ?? item.name ?? item.id) }))
      .filter((item) => item.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return { setlists, info: setlists.length ? `${setlists.length} setlist(s) encontrada(s).` : 'O Spresenter retornou uma lista vazia.' };
  } catch (error) {
    return { setlists: [], info: `Não foi possível consultar as setlists: ${error instanceof Error ? error.message : String(error)}` };
  }
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
    const currentBackground = live[config.backgroundLayer];
    const states: any[] = await spresenter.live.readState(output);
    const backgroundState: any = states[config.backgroundLayer];
    const alreadyApplied = currentBackground?.asset?.guid === asset.guid;
    const alreadyVisible = backgroundState?.show === true && Number(backgroundState?.opacity) === 1;
    if (!force && alreadyApplied && alreadyVisible) { await sendStatus({ lastDiagnostic: diagnostic, lastAction: `Fundo “${profile.name}” já está aplicado.` }); return; }
    if (force || !alreadyApplied) await spresenter.live.apply(output, config.backgroundLayer, { title: profile.name, asset });
    if (force || !alreadyVisible) await spresenter.live.setState(output, config.backgroundLayer, { show: true, opacity: 1 });

    const [confirmedLive, confirmedStates] = await Promise.all([
      spresenter.live.read(output),
      spresenter.live.readState(output),
    ]);
    const confirmedBackground: any = confirmedLive[config.backgroundLayer];
    const confirmedState: any = confirmedStates[config.backgroundLayer];
    if (confirmedBackground?.asset?.guid !== asset.guid || confirmedState?.show !== true || Number(confirmedState?.opacity) !== 1) {
      throw new Error('O Spresenter não confirmou o fundo ou a ativação da camada.');
    }
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
spresenter.on('state', ({ output }) => { scheduleApply(String(output ?? '0')); });
void ready.then(async () => {
  await sendStatus({ lastAction: 'Plugin iniciado.' });
  const outputs = await spresenter.outputs.list();
  outputs.forEach((item) => scheduleApply(String(item.index), 650));
});
