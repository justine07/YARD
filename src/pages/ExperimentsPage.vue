<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { loadExperiments } from '../services/dataApi';

const experiments = ref([]);
const loading = ref(true);
const hlaFilter = ref('');
const lengthFilter = ref('');
const query = ref('');

const allHlas = computed(() => [...new Set(experiments.value.map((exp) => exp.hla).filter(Boolean))].sort());
const allLengths = computed(() => [...new Set(experiments.value.map((exp) => exp.peptide_length).filter((item) => item != null))].sort((a, b) => Number(a) - Number(b)));

const filteredExperiments = computed(() => {
  const q = query.value.trim().toLowerCase();
  return experiments.value.filter((exp) => {
    if (hlaFilter.value && exp.hla !== hlaFilter.value) return false;
    if (lengthFilter.value && String(exp.peptide_length) !== lengthFilter.value) return false;
    if (q) {
      const text = `${exp.exp_id || ''} ${exp.tcr || ''} ${exp.first_author || ''}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
});

onMounted(async () => {
  experiments.value = await loadExperiments();
  loading.value = false;
});
</script>

<template>
  <section class="hero compact">
    <p class="eyebrow">Dataset Browser</p>
    <h1>Experiments</h1>
  </section>

  <section class="panel">
    <form class="filters">
      <label>
        HLA
        <select v-model="hlaFilter">
          <option value="">All</option>
          <option v-for="hla in allHlas" :key="hla" :value="hla">{{ hla }}</option>
        </select>
      </label>
      <label>
        Peptide Length
        <select v-model="lengthFilter">
          <option value="">All</option>
          <option v-for="len in allLengths" :key="len" :value="String(len)">{{ len }}</option>
        </select>
      </label>
      <label>
        Search (TCR / ID / Author)
        <input v-model="query" type="text" placeholder="e.g. A3A" />
      </label>
    </form>
  </section>

  <section class="panel">
    <p v-if="loading">Loading experiments...</p>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Experiment ID</th>
            <th>TCR</th>
            <th>HLA</th>
            <th>Length</th>
            <th>Peptides</th>
            <th>Source</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="exp in filteredExperiments" :key="exp.exp_id">
            <td class="mono">{{ exp.exp_id }}</td>
            <td>{{ exp.tcr || '-' }}</td>
            <td>{{ exp.hla || '-' }}</td>
            <td>{{ exp.peptide_length || '-' }}</td>
            <td>{{ Number(exp.counts_rows || 0).toLocaleString() }}</td>
            <td>
              <a v-if="exp.doi && !['unpublish', 'unpublished'].includes(String(exp.doi).toLowerCase())" :href="`https://doi.org/${exp.doi}`" target="_blank" rel="noreferrer">DOI</a>
              <span v-else>{{ exp.first_author || '-' }}</span>
            </td>
            <td class="actions">
              <RouterLink class="btn" :to="`/exp/${exp.exp_id}`">View</RouterLink>
              <RouterLink v-if="exp.has_structure" class="btn ghost" :to="`/structure/${exp.exp_id}`">3D</RouterLink>
            </td>
          </tr>
          <tr v-if="filteredExperiments.length === 0">
            <td colspan="7" class="empty">No experiments matched your filters.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
