<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import TemporalCosmograph from '../components/TemporalCosmograph.vue';
import { loadExperimentDetail, loadExperiments } from '../services/dataApi';

const route = useRoute();
const detail = ref(null);
const loading = ref(true);
const expId = computed(() => String(route.params.expId || ''));

async function loadPage() {
  loading.value = true;
  const expDetails = await loadExperimentDetail(expId.value);
  if (expDetails) {
    detail.value = expDetails;
    loading.value = false;
    return;
  }

  const all = await loadExperiments();
  const matched = all.find((item) => item.exp_id === expId.value);
  detail.value = matched ? { exp: matched, embedding_summary: null } : null;
  loading.value = false;
}

onMounted(() => loadPage());
</script>

<template>
  <section v-if="loading" class="panel">Loading peptide cosmograph...</section>
  <section v-else-if="!detail" class="panel">Experiment not found.</section>

  <template v-else>
    <section class="panel">
      <div class="title-row">
        <h1>Peptide Cosmograph <span class="mono">{{ expId }}</span></h1>
        <RouterLink class="btn ghost" :to="`/exp/${expId}`">Back to detail</RouterLink>
      </div>
      <p class="subtle">
        Full-screen time-layered network view. Each node is one peptide at one round, and edges connect the same peptide across adjacent rounds.
      </p>
    </section>

    <section class="panel panel-spacious" v-if="detail.embedding_summary">
      <TemporalCosmograph :embedding="detail.embedding_summary" :fullscreen="true" />
    </section>

    <section v-else class="panel">Embedding summary is not available for this experiment.</section>
  </template>
</template>
