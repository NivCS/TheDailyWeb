const WeatherCache = require('../models/WeatherCache');

const CACHE_ID = 'tel-aviv-current';
// Open-Meteo's current conditions use 15-minute model data. Refresh every
// five minutes so a cached response still has room within the freshness limit.
const CACHE_TTL_MS = 5 * 60 * 1000;
const LOCK_TTL_MS = 20 * 1000;
const REQUEST_TIMEOUT_MS = 7000;
const COORDINATES = { latitude: 32.0853, longitude: 34.7818 };
let processCache = null;
let processRefresh = null;

function isFresh(fetchedAt, now = Date.now()) {
  return fetchedAt && now - new Date(fetchedAt).getTime() < CACHE_TTL_MS;
}

function normalizedData(payload) {
  const current = payload?.current;
  const daily = payload?.daily;
  if (!current || !daily || !Number.isFinite(current.temperature_2m)) {
    throw new Error('Weather provider returned incomplete data.');
  }
  return {
    location: 'Tel Aviv, Israel',
    timezone: payload.timezone || 'Asia/Jerusalem',
    temperatureC: current.temperature_2m,
    feelsLikeC: current.apparent_temperature,
    humidityPercent: current.relative_humidity_2m,
    windSpeedKmh: current.wind_speed_10m,
    weatherCode: current.weather_code,
    observedAt: current.time,
    highC: daily.temperature_2m_max?.[0],
    lowC: daily.temperature_2m_min?.[0]
  };
}

async function fetchFromProvider() {
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(COORDINATES).map(([key, value]) => [key, String(value)])),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'Asia/Jerusalem',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    forecast_days: '1'
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Weather provider returned HTTP ${response.status}.`);
  return normalizedData(await response.json());
}

async function readCache() {
  return WeatherCache.findById(CACHE_ID).lean();
}

async function claimRefresh(now) {
  const lockUntil = new Date(now + LOCK_TTL_MS);
  const claimed = await WeatherCache.findOneAndUpdate(
    { _id: CACHE_ID, $or: [{ refreshLockUntil: { $lte: new Date(now) } }, { refreshLockUntil: { $exists: false } }] },
    { $set: { refreshLockUntil: lockUntil } },
    { new: true }
  );
  if (claimed) return true;

  if (await WeatherCache.exists({ _id: CACHE_ID })) return false;
  try {
    await WeatherCache.create({
      _id: CACHE_ID,
      data: null,
      fetchedAt: new Date(0),
      refreshLockUntil: lockUntil
    });
    return true;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

async function refreshWeather() {
  const data = await fetchFromProvider();
  const fetchedAt = new Date();
  await WeatherCache.updateOne(
    { _id: CACHE_ID },
    { $set: { data, fetchedAt, refreshLockUntil: new Date(0) } }
  );
  processCache = { data, fetchedAt };
  return { ...data, fetchedAt: fetchedAt.toISOString() };
}

async function waitForSharedRefresh() {
  for (let attempt = 0; attempt < 36; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const record = await readCache();
    if (record?.data && isFresh(record.fetchedAt)) {
      processCache = { data: record.data, fetchedAt: record.fetchedAt };
      return { ...record.data, fetchedAt: new Date(record.fetchedAt).toISOString() };
    }
  }
  throw new Error('Weather data is temporarily unavailable.');
}

async function getTelAvivWeather() {
  if (processCache && isFresh(processCache.fetchedAt)) {
    return { ...processCache.data, fetchedAt: new Date(processCache.fetchedAt).toISOString() };
  }
  if (processRefresh) return processRefresh;

  processRefresh = (async () => {
    const now = Date.now();
    const cached = await readCache();
    if (cached?.data && isFresh(cached.fetchedAt, now)) {
      processCache = { data: cached.data, fetchedAt: cached.fetchedAt };
      return { ...cached.data, fetchedAt: new Date(cached.fetchedAt).toISOString() };
    }

    const leader = await claimRefresh(now);
    if (!leader) return waitForSharedRefresh();

    try {
      return await refreshWeather();
    } catch (error) {
      await WeatherCache.updateOne({ _id: CACHE_ID }, { $set: { refreshLockUntil: new Date(0) } });
      throw error;
    }
  })();

  try {
    return await processRefresh;
  } finally {
    processRefresh = null;
  }
}

module.exports = { getTelAvivWeather };
