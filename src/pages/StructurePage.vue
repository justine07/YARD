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

async function initViewer(structure, index) {
  const key = `${structure.id}-${index}`;
  const el = document.getElementById(`viewer-${key}`);
  if (!el) return;

  if (!window.$3Dmol) {
    errors.value[key] = '3Dmol.js is not available in this environment.';
    return;
  }

  try {
    const response = await fetch(structure.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const pdbData = await response.text();

    const viewer = window.$3Dmol.createViewer(el, { backgroundColor: 'white' });
    viewer.addModel(pdbData, 'pdb');
    viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
    viewer.zoomTo();
    viewer.render();
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
      <h2>PDB {{ item.id }}</h2>
      <div :id="`viewer-${item.id}-${index}`" class="viewer" />
      <p v-if="errors[`${item.id}-${index}`]" class="error">{{ errors[`${item.id}-${index}`] }}</p>
    </article>
  </section>
</template>
