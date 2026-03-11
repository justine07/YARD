<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, LineController } from 'chart.js';
import { loadExperimentDetail, loadExperiments } from '../services/dataApi';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, LineController);

const route = useRoute();
const detail = ref(null);
const loading = ref(true);
const sortBy = ref('r3');
const searchQuery = ref('');
const chartCanvas = ref(null);
let chart = null;

const expId = computed(() => route.params.expId);

const peptides = computed(() => {
  if (!detail.value) return [];
  const key = sortBy.value === 'r4' ? 'top50_r4' : 'top50_r3';
  let list = detail.value[key] || [];

  const q = searchQuery.value.trim().toUpperCase();
  if (q) {
    list = list.filter((item) => String(item.peptide || '').toUpperCase() === q);
  }
  return list;
});

const chartDatasets = computed(() => {
  return peptides.value.slice(0, 10).map((pep, index) => ({
    label: pep.peptide,
    data: [pep.naive || 0, pep.r1 || 0, pep.r2 || 0, pep.r3 || 0, pep.r4 || 0],
    borderColor: ['#197278', '#edddd4', '#c44536', '#283d3b', '#772e25', '#f4a261', '#2a9d8f', '#e76f51', '#264653', '#a8dadc'][index % 10],
    backgroundColor: 'transparent',
    tension: 0.2,
  }));
});

function drawChart() {
  if (!chartCanvas.value || !detail.value) return;
  if (chart) chart.destroy();

  chart = new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      labels: ['Naive', 'R1', 'R2', 'R3', 'R4'],
      datasets: chartDatasets.value,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10 } },
      },
    },
  });
}

async function loadDetail() {
  loading.value = true;

  const expDetails = await loadExperimentDetail(expId.value);
  if (expDetails) {
    detail.value = expDetails;
    loading.value = false;
    drawChart();
    return;
  }

  const all = await loadExperiments();
  const matched = all.find((item) => item.exp_id === expId.value);
  detail.value = matched
    ? {
        exp: matched,
        top50_r3: [],
        top50_r4: [],
        motif: null,
        binding: null,
      }
    : null;

  loading.value = false;
  drawChart();
}

watch([sortBy, searchQuery], () => drawChart());
watch(expId, () => loadDetail());

onMounted(() => loadDetail());
</script>

<template>
  <section v-if="loading" class="panel">Loading experiment detail...</section>

  <section v-else-if="!detail" class="panel">Experiment not found.</section>

  <template v-else>
    <section class="panel">
      <div class="title-row">
        <h1>Experiment <span class="mono">{{ detail.exp.exp_id }}</span></h1>
      </div>
      <div class="meta-grid">
        <div><span> TCR </span><strong>{{ detail.exp.tcr || '-' }}</strong></div>
        <div><span> HLA </span><strong>{{ detail.exp.hla || '-' }}</strong></div>
        <div><span> Peptide Length </span><strong>{{ detail.exp.peptide_length || '-' }}</strong></div>
        <div><span> Counts Rows </span><strong>{{ Number(detail.exp.counts_rows || 0).toLocaleString() }}</strong></div>
      </div>
      <p class="subtle" v-if="detail.exp.doi">DOI: {{ detail.exp.doi }}</p>
    </section>

    <section class="panel" v-if="detail.motif">
      <h2>Motif Analysis</h2>
      <div class="motif-grid" :style="{ '--cols': detail.motif.peptide_length }">
        <div class="cell head"></div>
        <div class="cell head" v-for="n in detail.motif.peptide_length" :key="`h-${n}`">{{ n }}</div>
        <template v-for="aa in detail.motif.amino_acids" :key="aa">
          <div class="cell row-head mono">{{ aa }}</div>
          <div
            class="cell"
            v-for="(pos, idx) in detail.motif.pfm"
            :key="`${aa}-${idx}`"
            :style="{ backgroundColor: `rgba(25,114,120,${pos[aa] || 0})` }"
            :title="`${aa} @ ${idx + 1}: ${(pos[aa] || 0).toFixed(3)}`"
          />
        </template>
      </div>
      <img
        v-if="detail.logo_url"
        class="logo"
        :src="detail.logo_url"
        alt="Sequence logo"
      />
    </section>

    <section class="panel" v-if="detail.binding">
      <h2>Binding Prediction</h2>
      <div class="binding-stats">
        <span>Strong: {{ detail.binding.counts?.strong_binder ?? 0 }}</span>
        <span>Weak: {{ detail.binding.counts?.weak_binder ?? 0 }}</span>
        <span>Non: {{ detail.binding.counts?.non_binder ?? 0 }}</span>
      </div>
      <img v-if="detail.binding.plot_url" class="binding-plot" :src="detail.binding.plot_url" alt="Binding distribution" />
    </section>

    <section class="panel">
      <div class="toolbar">
        <h2>Top Peptides</h2>
        <div class="toolbar-right">
          <label>
            Sort
            <select v-model="sortBy">
              <option value="r3">R3</option>
              <option value="r4">R4</option>
            </select>
          </label>
          <label>
            Exact peptide
            <input v-model="searchQuery" placeholder="e.g. LLFGYPVYV" />
          </label>
        </div>
      </div>

      <div class="chart-wrap"><canvas ref="chartCanvas" /></div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Peptide</th>
              <th>Naive</th>
              <th>R1</th>
              <th>R2</th>
              <th>R3</th>
              <th>R4</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pep in peptides" :key="pep.peptide">
              <td class="mono">{{ pep.peptide }}</td>
              <td>{{ pep.naive ?? '-' }}</td>
              <td>{{ pep.r1 ?? 0 }}</td>
              <td>{{ pep.r2 ?? 0 }}</td>
              <td>{{ pep.r3 ?? 0 }}</td>
              <td>{{ pep.r4 ?? 0 }}</td>
            </tr>
            <tr v-if="peptides.length === 0">
              <td colspan="6" class="empty">No peptides available for this experiment.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
