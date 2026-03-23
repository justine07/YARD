<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { clusterColor, clusterLabel, clusterShortLabel, sortClusterIds } from '../utils/clusterColors';

const props = defineProps({
  data: {
    type: Object,
    default: null,
  },
});

const wrapper = ref(null);
const canvasRef = ref(null);
const activeRound = ref(0);
const onlyNonZero = ref(true);
const activeCluster = ref('all');
const searchQuery = ref('');
const rotationX = ref(-0.45);
const rotationY = ref(0.72);
const zoom = ref(0.72);
const stats = ref({ visible: 0, total: 0 });
let pointer = null;
let frameHandle = null;

const rounds = computed(() => props.data?.rounds || []);
const points = computed(() => props.data?.points || []);
const clusterLabels = computed(() => props.data?.cluster_labels || {});
const clusterIds = computed(() => {
  const ids = new Set();
  points.value.forEach((point) => ids.add(Number(point.k || 0)));
  return sortClusterIds(Array.from(ids));
});
const searchToken = computed(() => searchQuery.value.trim().toUpperCase());
const clusterSummary = computed(() => {
  const counts = new Map();
  points.value.forEach((point) => {
    const cluster = Number(point.k || 0);
    counts.set(cluster, (counts.get(cluster) || 0) + 1);
  });
  return clusterIds.value
    .map((clusterId) => ({
      id: clusterId,
      count: counts.get(clusterId) || 0,
      color: clusterColor(clusterId, 0.92),
      label: clusterLabels.value[String(clusterId)] || clusterShortLabel(clusterId),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return Number(left.id) - Number(right.id);
    });
});
const visibleLegendItems = computed(() => clusterSummary.value.slice(0, 12));
const hiddenLegendCount = computed(() => Math.max(clusterSummary.value.length - visibleLegendItems.value.length, 0));

function ensureCanvas() {
  const host = wrapper.value;
  const canvas = canvasRef.value;
  if (!host || !canvas) return null;
  const width = Math.max(420, Math.floor(host.clientWidth || 960));
  const height = Math.max(520, Math.floor(Math.min(window.innerHeight - 240, 860)));
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function rotatePoint(point) {
  const cosY = Math.cos(rotationY.value);
  const sinY = Math.sin(rotationY.value);
  const cosX = Math.cos(rotationX.value);
  const sinX = Math.sin(rotationX.value);

  const x1 = (point.x * cosY) + (point.z * sinY);
  const z1 = (-point.x * sinY) + (point.z * cosY);
  const y2 = (point.y * cosX) - (z1 * sinX);
  const z2 = (point.y * sinX) + (z1 * cosX);
  return { x: x1, y: y2, z: z2 };
}

function draw() {
  const state = ensureCanvas();
  if (!state || !rounds.value.length) return;
  const { ctx, width, height } = state;
  const roundIndex = Math.min(activeRound.value, rounds.value.length - 1);
  const round = rounds.value[roundIndex];
  const maxLog = Math.max(Number(round?.max_log || 0), 1e-6);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#111315';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  const cx = width / 2;
  const cy = height / 2 + 10;
  const baseScale = Math.min(width, height) * 0.19;
  const visible = [];

  for (const point of points.value) {
    const cluster = Number(point.k || 0);
    if (activeCluster.value !== 'all' && cluster !== Number(activeCluster.value)) continue;
    const raw = Number(point.c?.[roundIndex] || 0);
    if (onlyNonZero.value && raw <= 0) continue;

    const matched = searchToken.value && String(point.p || '').toUpperCase().includes(searchToken.value);
    const rotated = rotatePoint(point);
    const depth = rotated.z + 2.8;
    const perspective = zoom.value * (1.8 / Math.max(depth, 1.15));

    visible.push({
      x: cx + (rotated.x * perspective * baseScale),
      y: cy - (rotated.y * perspective * baseScale),
      z: rotated.z,
      raw,
      norm: raw > 0 ? Math.log10(raw + 1) / maxLog : 0,
      cluster,
      matched,
    });
  }

  visible.sort((a, b) => a.z - b.z);

  for (const point of visible) {
    const radius = point.raw > 0 ? 1.6 + (point.norm * 4.8) : 0.9;
    const alpha = point.raw > 0 ? 0.74 + (point.norm * 0.18) : 0.18;
    ctx.beginPath();
    ctx.fillStyle = clusterColor(point.cluster, alpha);
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (point.matched) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.lineWidth = 1.4;
      ctx.arc(point.x, point.y, radius + 2.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.font = '600 14px Space Grotesk, sans-serif';
  ctx.fillText(`Round: ${round?.label || ''}`, 18, 28);
  ctx.font = '500 12px IBM Plex Mono, monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.64)';
  ctx.fillText('Drag to rotate • wheel to zoom', 18, 48);

  stats.value = {
    visible: visible.length,
    total: points.value.length,
  };
}

function requestDraw() {
  if (frameHandle) cancelAnimationFrame(frameHandle);
  frameHandle = requestAnimationFrame(() => {
    frameHandle = null;
    draw();
  });
}

function onPointerDown(event) {
  pointer = { x: event.clientX, y: event.clientY };
}

function onPointerMove(event) {
  if (!pointer) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  pointer = { x: event.clientX, y: event.clientY };
  rotationY.value += dx * 0.01;
  rotationX.value = Math.max(-1.4, Math.min(1.4, rotationX.value + (dy * 0.01)));
  requestDraw();
}

function onPointerUp() {
  pointer = null;
}

function onWheel(event) {
  event.preventDefault();
  zoom.value = Math.max(0.38, Math.min(1.8, zoom.value * (event.deltaY > 0 ? 0.92 : 1.08)));
  requestDraw();
}

function resetView() {
  rotationX.value = -0.45;
  rotationY.value = 0.72;
  zoom.value = 0.72;
  requestDraw();
}

onMounted(async () => {
  await nextTick();
  requestDraw();
  window.addEventListener('resize', requestDraw);
});

watch([() => props.data, activeRound, onlyNonZero, activeCluster, searchQuery], async () => {
  await nextTick();
  requestDraw();
}, { deep: true });

onBeforeUnmount(() => {
  if (frameHandle) cancelAnimationFrame(frameHandle);
  window.removeEventListener('resize', requestDraw);
});
</script>

<template>
  <section v-if="data" class="embedding-block">
    <div class="title-row">
      <h2>3D UMAP Landscape</h2>
      <div class="toolbar-right">
        <label>
          Round
          <select v-model="activeRound">
            <option v-for="(round, index) in rounds" :key="round.key" :value="index">{{ round.label }}</option>
          </select>
        </label>
        <label>
          Node filter
          <select v-model="onlyNonZero">
            <option :value="true">Only non-zero</option>
            <option :value="false">Show all sampled</option>
          </select>
        </label>
        <label>
          Cluster
          <select v-model="activeCluster">
            <option value="all">All clusters</option>
            <option v-for="clusterId in clusterIds" :key="clusterId" :value="clusterId">{{ labelForCluster(clusterId) }}</option>
          </select>
        </label>
        <label>
          Highlight peptide
          <input v-model="searchQuery" placeholder="Peptide substring" />
        </label>
        <button type="button" class="btn ghost" @click="resetView">Reset view</button>
      </div>
    </div>

    <p class="subtle chart-note">
      Offline 3D UMAP built from peptide biochemical features: BLOSUM indices, hydrophobicity, and isoelectric point.
      Cluster colors now follow the report's UMAP + HDBSCAN path, while the 3D view uses the first three UMAP components so we can inspect the same sequence landscape interactively.
    </p>
    <p class="subtle chart-note">
      Visible nodes: {{ Number(stats.visible || 0).toLocaleString() }} / {{ Number(stats.total || 0).toLocaleString() }}.
      Method: {{ data.method }}.
      Cluster method: {{ data.cluster_method }}.
      Clusters: {{ Number(data.cluster_count || 0).toLocaleString() }}.
      <template v-if="Number(data.noise_count || 0) > 0">
        Noise peptides: {{ Number(data.noise_count || 0).toLocaleString() }}.
      </template>
    </p>

    <div class="cluster-legend">
      <div v-for="item in visibleLegendItems" :key="item.id" class="cluster-legend-item">
        <span class="cluster-swatch" :style="{ backgroundColor: item.color }"></span>
        <span>{{ item.label }} ({{ Number(item.count).toLocaleString() }})</span>
      </div>
      <div v-if="hiddenLegendCount > 0" class="cluster-legend-item">
        <span>+ {{ hiddenLegendCount }} more clusters</span>
      </div>
    </div>

    <div
      ref="wrapper"
      class="viewer-3d-shell"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @wheel="onWheel"
    >
      <canvas ref="canvasRef" class="viewer-3d-canvas" @pointerdown="onPointerDown" />
    </div>
  </section>
</template>
function labelForCluster(clusterId) {
  return clusterLabels.value[String(clusterId)] || clusterLabel(clusterId);
}
