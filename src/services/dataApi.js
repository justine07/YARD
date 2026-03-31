const DATA_ROOT = '/data';

async function fetchJson(path, fallbackValue = null) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      return fallbackValue;
    }
    return await response.json();
  } catch {
    return fallbackValue;
  }
}

export function loadExperiments() {
  return fetchJson(`${DATA_ROOT}/experiments.json`, []);
}

export function loadHomeStats() {
  return fetchJson(`${DATA_ROOT}/home_stats.json`, null);
}

export function loadExperimentDetail(expId) {
  return fetchJson(`${DATA_ROOT}/experiment/${expId}.json`, null);
}

export function loadCompareTop(expId) {
  return fetchJson(`${DATA_ROOT}/compare/top1000/${expId}.json`, null);
}

export function loadStructures(expId) {
  return fetchJson(`${DATA_ROOT}/structures/${expId}.json`, null);
}

export function loadManifest() {
  return fetchJson(`${DATA_ROOT}/manifest.json`, null);
}
