<script setup>
import { computed, onMounted, ref } from 'vue';
import { loadCompareTop, loadExperiments } from '../services/dataApi';

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

  compareResult.value = {
    commonCount: intersection.size,
    commonPeptides: [...intersection].slice(0, 50),
    pairwise,
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
  </section>
</template>
