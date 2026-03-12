<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, LineController } from 'chart.js';
import { loadExperimentDetail, loadExperiments } from '../services/dataApi';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, LineController);

const route = useRoute();
const detail = ref(null);
const loading = ref(true);
const searchQuery = ref('');
const chartCanvas = ref(null);
let chart = null;

const expId = computed(() => String(route.params.expId || ''));

const sourceDoi = computed(() => {
  const doi = detail.value?.exp?.doi;
  if (!doi) return null;
  const normalized = String(doi).toLowerCase();
  if (normalized === 'unpublish' || normalized === 'unpublished') return null;
  return doi;
});

const peptides = computed(() => {
  if (!detail.value) return [];
  let list = detail.value.top50_r3 || [];

  const q = searchQuery.value.trim().toUpperCase();
  if (q) {
    list = list.filter((item) => String(item.peptide || '').toUpperCase() === q);
  }
  return list;
});

const motifPositiveCount = computed(() => detail.value?.motif?.actual_n ?? null);

const hasAnalysis = computed(() => {
  if (!detail.value) return false;
  return Boolean(detail.value.motif || detail.value.logo_url || detail.value.mhc_motif || detail.value.mhc_logo_url || detail.value.binding);
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
    await nextTick();
    drawChart();
    return;
  }

  const all = await loadExperiments();
  const matched = all.find((item) => item.exp_id === expId.value);
  detail.value = matched
    ? {
        exp: matched,
        top50_r3: [],
        motif: null,
        binding: null,
        logo_url: null,
      }
    : null;

  loading.value = false;
  await nextTick();
  drawChart();
}

watch(expId, () => loadDetail());
watch(peptides, async () => {
  if (loading.value) return;
  await nextTick();
  drawChart();
}, { deep: true });

onMounted(() => loadDetail());

onBeforeUnmount(() => {
  if (chart) chart.destroy();
});
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
      <p class="subtle">
        Source:
        <a v-if="sourceDoi" :href="`https://doi.org/${sourceDoi}`" target="_blank" rel="noreferrer">{{ sourceDoi }}</a>
        <span v-else>unpublish</span>
      </p>

      <details class="sequence-details">
        <summary>View TCR Sequence Details (CDR3, V/J Genes)</summary>
        <div class="sequence-grid">
          <div class="seq-item"><strong>TRAV:</strong> {{ detail.exp.trav || '-' }}</div>
          <div class="seq-item"><strong>CDR3a:</strong> <span class="mono">{{ detail.exp.cdr3a || '-' }}</span></div>
          <div class="seq-item"><strong>TRAJ:</strong> {{ detail.exp.traj || '-' }}</div>
          <div class="seq-item"><strong>TRBV:</strong> {{ detail.exp.trbv || '-' }}</div>
          <div class="seq-item"><strong>CDR3b:</strong> <span class="mono">{{ detail.exp.cdr3b || '-' }}</span></div>
          <div class="seq-item"><strong>TRBJ:</strong> {{ detail.exp.trbj || '-' }}</div>
        </div>
      </details>
    </section>

    <section class="panel" v-if="hasAnalysis">
      <div class="title-row">
        <h2>Motif Analysis & Binding Prediction</h2>
        <span v-if="motifPositiveCount !== null" class="pill">R3 &gt; 0: {{ motifPositiveCount }}</span>
      </div>

      <div class="analysis-grid">
        <article class="analysis-card" v-if="detail.logo_url || detail.mhc_logo_url">
          <h3>Sequence Logo</h3>
          <img v-if="detail.logo_url" class="logo" :src="detail.logo_url" alt="Sequence logo" />

          <div v-if="detail.mhc_motif || detail.mhc_logo_url" class="stacked-logo-block">
            <div class="analysis-divider"></div>
            <h3>MHC Ligand Logo</h3>
            <p class="subtle" v-if="detail.mhc_motif">
              Reference ligands: {{ detail.mhc_motif.actual_n }}
            </p>
            <p class="subtle" v-if="detail.mhc_motif?.matched_alleles?.length">
              Matched allele source: {{ detail.mhc_motif.matched_alleles.join(', ') }}
            </p>
            <p class="subtle" v-if="detail.mhc_motif?.source_class === 'classII_core'">
              Class II core motif
            </p>
            <img v-if="detail.mhc_logo_url" class="logo" :src="detail.mhc_logo_url" alt="MHC ligand motif logo" />
          </div>
        </article>

        <article class="analysis-card" v-if="detail.motif">
          <h3>PFM Heatmap</h3>
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
        </article>

        <article class="analysis-card" v-if="detail.binding">
          <h3>Binding Prediction</h3>
          <div class="binding-stats">
            <span>Strong: {{ detail.binding.counts?.strong_binder ?? 0 }}</span>
            <span>Weak: {{ detail.binding.counts?.weak_binder ?? 0 }}</span>
            <span>Non: {{ detail.binding.counts?.non_binder ?? 0 }}</span>
          </div>
          <img v-if="detail.binding.plot_url" class="binding-plot" :src="detail.binding.plot_url" alt="Binding distribution" />
        </article>
      </div>
    </section>

    <section class="panel">
      <div class="toolbar">
        <h2>Top Peptides (Default sorted by R3)</h2>
        <div class="toolbar-right">
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
