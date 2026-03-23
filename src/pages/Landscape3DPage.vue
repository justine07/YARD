<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import UMAP3DExplorer from '../components/UMAP3DExplorer.vue';
import { loadExperimentDetail, loadExperiments, loadLandscape3d } from '../services/dataApi';

const route = useRoute();
const detail = ref(null);
const landscape = ref(null);
const loading = ref(true);
const expId = computed(() => String(route.params.expId || ''));

async function loadPage() {
  loading.value = true;
  const [expDetails, landscapeData] = await Promise.all([
    loadExperimentDetail(expId.value),
    loadLandscape3d(expId.value),
  ]);

  if (expDetails) {
    detail.value = expDetails;
    landscape.value = landscapeData;
    loading.value = false;
    return;
  }

  const all = await loadExperiments();
  const matched = all.find((item) => item.exp_id === expId.value);
  detail.value = matched ? { exp: matched } : null;
  landscape.value = landscapeData;
  loading.value = false;
}

onMounted(() => loadPage());
</script>

<template>
  <section v-if="loading" class="panel">Loading 3D UMAP landscape...</section>
  <section v-else-if="!detail" class="panel">Experiment not found.</section>

  <template v-else>
    <section class="panel">
      <div class="title-row">
        <h1>3D UMAP <span class="mono">{{ expId }}</span></h1>
        <div class="actions">
          <RouterLink class="btn ghost" :to="`/exp/${expId}`">Back to detail</RouterLink>
          <RouterLink class="btn ghost" :to="`/embedding/${expId}`">Open cosmograph</RouterLink>
        </div>
      </div>
      <p class="subtle">
        Full-screen 3D view of the offline biochemical-feature UMAP. The colors come from HDBSCAN clusters on the first two UMAP dimensions, while the 3D view uses the first three dimensions of the same embedding.
      </p>
    </section>

    <section v-if="landscape" class="panel panel-spacious">
      <UMAP3DExplorer :data="landscape" />
    </section>

    <section v-else class="panel">3D UMAP data is not available for this experiment yet.</section>
  </template>
</template>
