<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Chart, ScatterController, LinearScale, PointElement, LineElement, Tooltip, Legend, LineController } from 'chart.js';
import { loadExperimentDetail, loadExperiments } from '../services/dataApi';

Chart.register(ScatterController, LinearScale, PointElement, LineElement, Tooltip, Legend, LineController);

const route = useRoute();
const detail = ref(null);
const loading = ref(true);
const searchQuery = ref('');
const traceMode = ref('20');
const chartCanvas = ref(null);
let chart = null;

const expId = computed(() => String(route.params.expId || ''));
const tracePalette = ['#197278', '#c44536', '#264653', '#2a9d8f', '#e76f51', '#283d3b', '#f4a261', '#5f0f40', '#7f5539', '#3d405b', '#8d99ae', '#b56576'];

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

const trajectorySummary = computed(() => detail.value?.trajectory_summary || null);

const roundLabels = computed(() => trajectorySummary.value?.rounds?.map((round) => round.label) || []);
const showLineLegend = computed(() => (trajectorySummary.value?.trace_count || 0) <= 24);
const pointRadius = computed(() => {
  const totalPoints = trajectorySummary.value?.distribution_points?.length || 0;
  if (totalPoints > 40000) return 0.9;
  if (totalPoints > 20000) return 1.1;
  if (totalPoints > 10000) return 1.25;
  return 1.5;
});
const availableTraceCount = computed(() => trajectorySummary.value?.trace_lines?.length || 0);
const visibleTraceLines = computed(() => {
  const traces = trajectorySummary.value?.trace_lines || [];
  if (traceMode.value === 'all') return traces;

  const limit = Number(traceMode.value || 0);
  if (!Number.isFinite(limit) || limit <= 0) return [];
  return traces.slice(0, limit);
});
const visibleTraceCount = computed(() => visibleTraceLines.value.length + (highlightedTrace.value ? 1 : 0));

const highlightedTrace = computed(() => {
  const q = searchQuery.value.trim().toUpperCase();
  if (!q || !trajectorySummary.value) return null;

  const matched = peptides.value.find((item) => String(item.peptide || '').toUpperCase() === q);
  if (!matched) return null;

  const points = (trajectorySummary.value.rounds || []).map((round, index) => {
    const rawValue = Number(matched[round.key] ?? 0);
    return {
      x: index,
      y: Math.log10(Math.max(rawValue, 0) + 1),
      raw: rawValue,
      round_key: round.key,
      round_label: round.label,
    };
  });

  return {
    peptide: matched.peptide,
    points,
  };
});

const chartDatasets = computed(() => {
  if (!trajectorySummary.value) return [];

  const datasets = [
    {
      type: 'scatter',
      label: 'All peptides',
      data: trajectorySummary.value.distribution_points || [],
      backgroundColor: 'rgba(25, 114, 120, 0.28)',
      borderColor: 'rgba(25, 114, 120, 0.28)',
      pointRadius: pointRadius.value,
      pointHoverRadius: Math.max(pointRadius.value + 1.2, 2.2),
      showLine: false,
    },
  ];

  if (highlightedTrace.value) {
    datasets.push({
      type: 'line',
      label: `${highlightedTrace.value.peptide} (matched)`,
      data: highlightedTrace.value.points,
      borderColor: '#111111',
      backgroundColor: '#111111',
      borderWidth: 2.4,
      pointRadius: 3,
      pointHoverRadius: 4,
      tension: 0.2,
    });
  }

  visibleTraceLines.value.forEach((trace, index) => {
    if (highlightedTrace.value?.peptide === trace.peptide) return;

    datasets.push({
      type: 'line',
      label: trace.peptide,
      data: trace.points,
      borderColor: tracePalette[index % tracePalette.length],
      backgroundColor: tracePalette[index % tracePalette.length],
      borderWidth: 1.8,
      pointRadius: 2.2,
      pointHoverRadius: 3,
      tension: 0.2,
    });
  });

  return datasets;
});

function drawChart() {
  if (!chartCanvas.value || !detail.value || !trajectorySummary.value) return;
  if (chart) chart.destroy();

  chart = new Chart(chartCanvas.value, {
    type: 'scatter',
    data: {
      datasets: chartDatasets.value,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: {
          display: showLineLegend.value,
          position: 'right',
          labels: {
            boxWidth: 10,
            filter: (item, data) => data.datasets[item.datasetIndex]?.type === 'line',
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              const raw = context.raw || {};
              if (context.dataset.type === 'scatter') {
                return `${raw.round_label}: ${Number(raw.raw || 0).toLocaleString()} counts`;
              }
              return `${context.dataset.label} • ${raw.round_label}: ${Number(raw.raw || 0).toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: -0.45,
          max: Math.max((roundLabels.value.length || 1) - 0.55, 0.45),
          ticks: {
            stepSize: 1,
            callback(value) {
              const index = Number(value);
              return Number.isInteger(index) ? (roundLabels.value[index] || '') : '';
            },
          },
          title: {
            display: true,
            text: 'Selection round',
          },
          grid: {
            color: '#ebe3d7',
          },
        },
        y: {
          title: {
            display: true,
            text: 'log10(count + 1)',
          },
          suggestedMax: (trajectorySummary.value?.max_log_count || 0) + 0.35,
          grid: {
            color: '#ebe3d7',
          },
        },
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
watch([trajectorySummary, searchQuery, traceMode], async () => {
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
        <h2>Peptide Enrichment Trajectories</h2>
        <div class="toolbar-right">
          <label>
            Trace overlay
            <select v-model="traceMode">
              <option value="0">Points only</option>
              <option value="20">Top 20 traces</option>
              <option value="50">Top 50 traces</option>
              <option value="100">Top 100 traces</option>
              <option value="all">All exported traces</option>
            </select>
          </label>
          <label>
            Highlight peptide from table
            <input v-model="searchQuery" placeholder="e.g. LLFGYPVYV" />
          </label>
        </div>
      </div>

      <p class="subtle chart-note" v-if="trajectorySummary">
        {{ trajectorySummary.distribution_mode === 'all' ? 'All peptides are rendered as points.' : 'A stable high-density peptide sample is rendered as points for performance.' }}
        Colored lines track as many high-information trajectories as the browser can reasonably handle, and the y-axis uses log10(count + 1) so low-abundance and highly enriched peptides remain visible on the same plot.
      </p>
      <p class="subtle chart-note" v-if="trajectorySummary">
        Peptides with any non-zero count: {{ Number(trajectorySummary.total_peptides || 0).toLocaleString() }}.
        Rendered point peptides: {{ Number(trajectorySummary.sampled_peptides || 0).toLocaleString() }}.
        Exported traces: {{ trajectorySummary.trace_count || 0 }}.
        Visible traces: {{ visibleTraceCount }}.
      </p>

      <div v-if="trajectorySummary" class="chart-wrap trajectory-chart"><canvas ref="chartCanvas" /></div>
      <p v-else class="subtle">Trajectory summary is not available for this experiment yet.</p>

      <article v-if="detail.landscape_map?.url" class="analysis-card landscape-card">
        <div class="title-row">
          <h3>Hamming Distance UMAP</h3>
          <span class="pill">{{ detail.landscape_map.method }}</span>
        </div>
        <p class="subtle chart-note">
          Static 2D landscape computed offline from pairwise peptide Hamming distance. Clusters are assigned with Hamming-distance k-medoids so local groups stay consistent across rounds.
        </p>
        <p class="subtle chart-note">
          Sampled peptides: {{ Number(detail.landscape_map.sampled_peptides || 0).toLocaleString() }}.
          Clusters: {{ detail.landscape_map.cluster_count || 0 }}.
          Rounds: {{ (detail.landscape_map.available_rounds || []).join(', ') }}.
        </p>
        <img class="binding-plot" :src="detail.landscape_map.url" alt="Offline Hamming-distance UMAP landscape" />
      </article>

      <div class="toolbar compact-toolbar">
        <h2>Top Peptides (Default sorted by R3)</h2>
        <div class="toolbar-right" v-if="detail.embedding_summary">
          <RouterLink class="btn ghost" :to="`/embedding/${detail.exp.exp_id}`">Open Full Screen Cosmograph</RouterLink>
        </div>
      </div>

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
