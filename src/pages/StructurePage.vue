<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { loadStructures } from '../services/dataApi';

const route = useRoute();
const structures = ref([]);
const loading = ref(true);
const errors = ref({});

function parseExpId() {
  return String(route.params.expId || '');
}

function parseChainResidues(pdbData) {
  const chainResidues = new Map();

  for (const line of pdbData.split('\n')) {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue;

    const chain = (line[21] || '').trim() || '_';
    const residueId = `${line.slice(22, 26).trim()}${line[26] || ''}`;

    if (!chainResidues.has(chain)) {
      chainResidues.set(chain, new Set());
    }
    chainResidues.get(chain).add(residueId);
  }

  return [...chainResidues.entries()]
    .map(([chain, residues]) => ({ chain, residueCount: residues.size }))
    .sort((a, b) => a.residueCount - b.residueCount);
}

function assignChainRoles(chainStats) {
  if (chainStats.length === 0) {
    return { peptideChains: [], mhcChains: [], tcrChains: [] };
  }

  const peptideChains = [chainStats[0].chain];
  const remaining = chainStats.slice(1);

  if (remaining.length === 0) {
    return { peptideChains, mhcChains: [], tcrChains: [] };
  }

  const hasVeryLongChain = remaining.some((item) => item.residueCount > 150);
  let mhcChains = [];
  let tcrChains = [];

  if (hasVeryLongChain) {
    const longest = [...remaining].sort((a, b) => b.residueCount - a.residueCount);
    mhcChains.push(longest[0].chain);

    const leftover = remaining.filter((item) => item.chain !== longest[0].chain);
    if (leftover.length >= 3) {
      const shortestLeft = [...leftover].sort((a, b) => a.residueCount - b.residueCount)[0];
      mhcChains.push(shortestLeft.chain);
      tcrChains = leftover.filter((item) => item.chain !== shortestLeft.chain).map((item) => item.chain);
    } else {
      tcrChains = leftover.map((item) => item.chain);
    }
  } else {
    const sortedRemaining = [...remaining].sort((a, b) => a.residueCount - b.residueCount);
    mhcChains = sortedRemaining.slice(0, Math.min(2, sortedRemaining.length)).map((item) => item.chain);
    tcrChains = sortedRemaining.slice(mhcChains.length).map((item) => item.chain);
  }

  return { peptideChains, mhcChains, tcrChains };
}

async function initViewer(structure, index) {
  const key = `${index}`;
  const viewerElementId = `viewer-${key}`;
  const el = document.getElementById(viewerElementId);
  if (!el) return;

  if (!window.$3Dmol) {
    errors.value[key] = '3Dmol.js is not available in this environment.';
    return;
  }

  try {
    el.innerHTML = '';
    const response = await fetch(structure.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const pdbData = await response.text();
    if (!pdbData.includes('ATOM') && !pdbData.includes('HETATM')) {
      throw new Error('PDB content is empty or invalid.');
    }
    const chainRoles = assignChainRoles(parseChainResidues(pdbData));

    const viewer = window.$3Dmol.createViewer(viewerElementId, { backgroundColor: 'white' });
    viewer.addModel(pdbData, 'pdb');
    viewer.setStyle({}, {});

    if (chainRoles.tcrChains.length) {
      viewer.setStyle(
        { chain: chainRoles.tcrChains },
        { cartoon: { color: '#0f766e' } },
      );
    }

    if (chainRoles.mhcChains.length) {
      viewer.setStyle(
        { chain: chainRoles.mhcChains },
        { cartoon: { color: '#94a3b8' } },
      );
    }

    if (chainRoles.peptideChains.length) {
      viewer.setStyle(
        { chain: chainRoles.peptideChains },
        {
          stick: { color: '#dc6b2f', radius: 0.28 },
          cartoon: { color: '#dc6b2f' },
        },
      );
    }

    viewer.zoomTo();
    viewer.render();
    viewer.resize();
  } catch (err) {
    errors.value[key] = `Failed to load structure: ${err.message}`;
  }
}

async function loadData() {
  loading.value = true;
  errors.value = {};

  const expId = parseExpId();
  const payload = await loadStructures(expId);
  structures.value = payload?.structures || [];

  loading.value = false;

  await nextTick();
  await Promise.all(structures.value.map((item, index) => initViewer(item, index)));
}

watch(() => route.params.expId, () => loadData());
onMounted(() => loadData());
</script>

<template>
  <section class="hero compact">
    <p class="eyebrow">3D Viewer</p>
    <h1>Structure: <span class="mono">{{ route.params.expId }}</span></h1>
  </section>

  <section v-if="loading" class="panel">Loading structures...</section>

  <section v-else-if="structures.length === 0" class="panel">No structure assets found for this experiment.</section>

  <section v-else class="structure-grid">
    <article v-for="(item, index) in structures" :key="`${item.id}-${index}`" class="panel">
      <h2 v-if="item.epitope">Epitope: <span class="mono">{{ item.epitope }}</span></h2>
      <h2 v-else>Structure</h2>
      <p class="subtle">PDB: <span class="mono">{{ item.id }}</span></p>
      <div :id="`viewer-${index}`" class="viewer" />
      <p v-if="errors[`${index}`]" class="error">{{ errors[`${index}`] }}</p>
    </article>
  </section>
</template>
