<script setup>
import { computed, onMounted, ref } from 'vue';
import { loadCompareTop, loadExperimentDetail, loadExperiments } from '../services/dataApi';

const experiments = ref([]);
const selectedIds = ref([]);
const loading = ref(true);
const compareResult = ref(null);
const error = ref('');

const selectedExperiments = computed(() => experiments.value.filter((exp) => selectedIds.value.includes(exp.exp_id)));

function jaccard(a, b) {
  const intersectionSize = [...a].filter((item) => b.has(item)).length;
  const unionSize = new Set([...a, ...b]).size;
  return unionSize ? Number((intersectionSize / unionSize).toFixed(4)) : 0;
}

async function runCompare() {
  error.value = '';
  compareResult.value = null;

  if (selectedIds.value.length < 2) {
    error.value = 'Select at least two experiments.';
    return;
  }

  const payloads = await Promise.all(selectedIds.value.map((id) => loadCompareTop(id)));
  const valid = payloads.every((item) => item && Array.isArray(item.peptides));
  if (!valid) {
    error.value = 'Missing compare/top1000 data for one or more selected experiments.';
    return;
  }

  const sets = payloads.map((item) => new Set(item.peptides));
  const intersection = sets.reduce((acc, set) => new Set([...acc].filter((item) => set.has(item))), sets[0]);

  let pairwise = null;
  if (sets.length === 2) {
    pairwise = jaccard(sets[0], sets[1]);
  }

  const detailPayloads = await Promise.all(selectedIds.value.map((id) => loadExperimentDetail(id)));
  const motifs = selectedIds.value.map((id, idx) => {
    const exp = experiments.value.find((item) => item.exp_id === id) || null;
    const payload = detailPayloads[idx];
    return {
      exp_id: id,
      tcr: exp?.tcr || '-',
      motif: payload?.motif || null,
      logo_url: payload?.logo_url || null,
    };
  });

  compareResult.value = {
    commonCount: intersection.size,
    commonPeptides: [...intersection].slice(0, 50),
    pairwise,
    motifs,
  };
}

onMounted(async () => {
  experiments.value = await loadExperiments();
  loading.value = false;
});
</script>

<template>
  <section class="hero compact">
    <p class="eyebrow">Cross Experiment Analysis</p>
    <h1>Compare</h1>
    <p>Compare overlap based on precomputed top1000 peptide sets.</p>
  </section>

  <section class="panel">
    <p v-if="loading">Loading experiments...</p>
    <template v-else>
      <div class="selector-grid">
        <label v-for="exp in experiments" :key="exp.exp_id" class="checkbox-row">
          <input v-model="selectedIds" type="checkbox" :value="exp.exp_id" />
          <span><strong>{{ exp.exp_id }}</strong> | {{ exp.tcr }} | {{ exp.hla }}</span>
        </label>
      </div>
      <button class="btn" type="button" @click="runCompare">Run Comparison</button>
      <p class="error" v-if="error">{{ error }}</p>
    </template>
  </section>

  <section v-if="compareResult" class="panel">
    <h2>Results</h2>
    <p>Common peptides (top1000 intersection): <strong>{{ compareResult.commonCount }}</strong></p>
    <p v-if="compareResult.pairwise !== null">Pairwise Jaccard: <strong>{{ compareResult.pairwise }}</strong></p>

    <h3>Selected Experiments</h3>
    <ul class="flat-list">
      <li v-for="exp in selectedExperiments" :key="exp.exp_id">{{ exp.exp_id }} - {{ exp.tcr }} - {{ exp.hla }}</li>
    </ul>

    <h3>Common Peptides (Top 50)</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Peptide</th></tr>
        </thead>
        <tbody>
          <tr v-for="pep in compareResult.commonPeptides" :key="pep"><td class="mono">{{ pep }}</td></tr>
          <tr v-if="compareResult.commonPeptides.length === 0"><td class="empty">No common peptides in selected sets.</td></tr>
        </tbody>
      </table>
    </div>

    <h3>Motif Comparison</h3>
    <div class="motif-compare-grid">
      <article class="motif-compare-card" v-for="item in compareResult.motifs" :key="item.exp_id">
        <h4>{{ item.exp_id }} ({{ item.tcr }})</h4>
        <img v-if="item.logo_url" class="logo" :src="item.logo_url" alt="Motif logo" />
        <div v-if="item.motif" class="motif-grid mini" :style="{ '--cols': item.motif.peptide_length }">
          <div class="cell head"></div>
          <div class="cell head" v-for="n in item.motif.peptide_length" :key="`${item.exp_id}-head-${n}`">{{ n }}</div>
          <template v-for="aa in item.motif.amino_acids" :key="`${item.exp_id}-${aa}`">
            <div class="cell row-head mono">{{ aa }}</div>
            <div
              class="cell"
              v-for="(pos, idx) in item.motif.pfm"
              :key="`${item.exp_id}-${aa}-${idx}`"
              :style="{ backgroundColor: `rgba(25,114,120,${pos[aa] || 0})` }"
            />
          </template>
        </div>
        <p v-if="!item.motif && !item.logo_url" class="empty">No motif data available.</p>
      </article>
    </div>
  </section>
</template>
