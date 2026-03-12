<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
import { loadExperiments, loadHomeStats } from '../services/dataApi';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, DoughnutController, ArcElement, Tooltip, Legend);

const stats = ref(null);
const loading = ref(true);
const hlaCanvas = ref(null);
const lenCanvas = ref(null);
let hlaChart = null;
let lenChart = null;

function summarizeExperiments(experiments) {
  const hlaCounts = new Map();
  const lenCounts = new Map();
  let totalPeptides = 0;

  for (const exp of experiments) {
    if (exp.hla) {
      hlaCounts.set(exp.hla, (hlaCounts.get(exp.hla) || 0) + 1);
    }
    if (exp.peptide_length != null) {
      const key = String(exp.peptide_length);
      lenCounts.set(key, (lenCounts.get(key) || 0) + 1);
    }
    totalPeptides += Number(exp.counts_rows || 0);
  }

  const lenKeys = [...lenCounts.keys()].sort((a, b) => Number(a) - Number(b));

  return {
    total_exps: experiments.length,
    total_peptides: totalPeptides,
    unique_tcrs: new Set(experiments.map((item) => item.tcr).filter(Boolean)).size,
    unique_hlas: new Set(experiments.map((item) => item.hla).filter(Boolean)).size,
    hla_labels: [...hlaCounts.keys()],
    hla_data: [...hlaCounts.values()],
    len_labels: lenKeys.map((item) => `${item}-mer`),
    len_data: lenKeys.map((item) => lenCounts.get(item)),
  };
}

const cards = computed(() => {
  if (!stats.value) {
    return [];
  }
  return [
    { label: 'Experiments', value: stats.value.total_exps || 0 },
    { label: 'Total Peptides', value: (stats.value.total_peptides || 0).toLocaleString() },
    { label: 'Unique TCRs', value: stats.value.unique_tcrs || 0 },
    { label: 'Unique HLAs', value: stats.value.unique_hlas || 0 },
  ];
});

function renderCharts() {
  if (!stats.value || !hlaCanvas.value || !lenCanvas.value) {
    return;
  }

  if (hlaChart) hlaChart.destroy();
  if (lenChart) lenChart.destroy();

  hlaChart = new Chart(hlaCanvas.value, {
    type: 'bar',
    data: {
      labels: stats.value.hla_labels,
      datasets: [
        {
          label: 'Experiments',
          data: stats.value.hla_data,
          backgroundColor: '#197278',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });

  lenChart = new Chart(lenCanvas.value, {
    type: 'doughnut',
    data: {
      labels: stats.value.len_labels,
      datasets: [
        {
          data: stats.value.len_data,
          backgroundColor: ['#197278', '#edddd4', '#c44536', '#283d3b', '#772e25'],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

onMounted(async () => {
  const [homeStats, experiments] = await Promise.all([loadHomeStats(), loadExperiments()]);
  const derivedStats = summarizeExperiments(experiments);
  const hasUsableHomeStats = homeStats && Number(homeStats.total_exps || 0) > 0;
  stats.value = hasUsableHomeStats ? homeStats : derivedStats;
  loading.value = false;
  await nextTick();
  renderCharts();
});

watch(stats, async () => {
  if (loading.value) return;
  await nextTick();
  renderCharts();
}, { deep: true });

onBeforeUnmount(() => {
  if (hlaChart) hlaChart.destroy();
  if (lenChart) lenChart.destroy();
});
</script>

<template>
  <section class="hero">
    <p class="eyebrow">TCR-pMHC Atlas</p>
    <h1>Static Vue SPA for TCR Landscape Exploration</h1>
    <p>Browse experiments, motifs, enrichment trajectories, and structure assets directly from static JSON files.</p>
  </section>

  <section v-if="loading" class="panel">Loading summary...</section>

  <section v-else class="stats-grid">
    <article v-for="card in cards" :key="card.label" class="stat-card">
      <p class="stat-label">{{ card.label }}</p>
      <p class="stat-value">{{ card.value }}</p>
    </article>
  </section>

  <section v-if="!loading" class="dashboard-grid">
    <article class="panel chart-panel">
      <h2>HLA Representation</h2>
      <div class="chart-wrap"><canvas ref="hlaCanvas" /></div>
    </article>
    <article class="panel chart-panel">
      <h2>Peptide Length Distribution</h2>
      <div class="chart-wrap"><canvas ref="lenCanvas" /></div>
    </article>
  </section>
</template>
