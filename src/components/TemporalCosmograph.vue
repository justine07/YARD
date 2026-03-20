<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  embedding: {
    type: Object,
    default: null,
  },
  fullscreen: {
    type: Boolean,
    default: false,
  },
});

const clusterPalette = ['#49c6b8', '#ff8a5b', '#7c8cf8', '#f4d35e', '#ea638c', '#86baa1'];
const wrapper = ref(null);
const canvasRef = ref(null);
const onlyNonZero = ref(true);
const edgeMode = ref('all');
const activeCluster = ref('all');
const searchQuery = ref('');
const layoutMeta = ref({
  visiblePeptides: 0,
  visibleNodes: 0,
  visibleEdges: 0,
  visibleCounts: [],
});
let resizeFrame = null;

const rounds = computed(() => props.embedding?.rounds || []);
const points = computed(() => props.embedding?.points || []);
const highlightPeptides = computed(() => new Set(props.embedding?.highlight_peptides || []));
const clusterIds = computed(() => {
  const ids = new Set();
  points.value.forEach((point) => ids.add(Number(point.k || 0)));
  return Array.from(ids).sort((a, b) => a - b);
});
const searchToken = computed(() => searchQuery.value.trim().toUpperCase());

function clusterColor(clusterIndex, alpha = 1) {
  const hex = clusterPalette[Number(clusterIndex || 0) % clusterPalette.length];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function stableFraction(seed) {
  let hash = 2166136261;
  for (let idx = 0; idx < seed.length; idx += 1) {
    hash ^= seed.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function roundNorm(point, roundIndex) {
  const raw = Number(point?.c?.[roundIndex] || 0);
  const maxLog = Number(rounds.value?.[roundIndex]?.max_log || 0);
  if (raw <= 0 || maxLog <= 0) return 0;
  return Math.log10(raw + 1) / maxLog;
}

function peptideMatches(point) {
  if (!searchToken.value) return false;
  return String(point?.p || '').toUpperCase().includes(searchToken.value);
}

function clusterAllowed(point) {
  return activeCluster.value === 'all' || Number(point?.k || 0) === Number(activeCluster.value);
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  const host = wrapper.value;
  if (!canvas || !host) return null;

  const cssWidth = Math.max(360, Math.floor(host.clientWidth || 920));
  const cssHeight = props.fullscreen
    ? Math.max(520, Math.min(window.innerHeight - 280, 860))
    : 430;
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, ctx, cssWidth, cssHeight };
}

function buildLayout(width, height) {
  const roundCount = rounds.value.length;
  if (!roundCount || !points.value.length) {
    return {
      nodes: [],
      edges: [],
      visibleCounts: [],
      visiblePeptides: 0,
    };
  }

  const left = 78;
  const right = 56;
  const top = 88;
  const bottom = 68;
  const innerWidth = Math.max(width - left - right, 120);
  const innerHeight = Math.max(height - top - bottom, 120);
  const columnGap = roundCount > 1 ? innerWidth / (roundCount - 1) : 0;
  const columnSpread = roundCount > 1 ? Math.min(90, columnGap * 0.34) : Math.min(140, innerWidth * 0.34);

  const edges = [];
  const nodes = [];
  const visibleCounts = Array.from({ length: roundCount }, () => 0);
  let visiblePeptides = 0;

  for (const point of points.value) {
    if (!clusterAllowed(point)) continue;

    const matched = peptideMatches(point);
    const highlighted = matched || highlightPeptides.value.has(point.p);
    const cluster = Number(point.k || 0);
    const baseY = top + ((1 - ((Number(point.y || 0) + 1) * 0.5)) * innerHeight);
    const positions = [];
    let peptideVisible = false;

    for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
      const roundKey = rounds.value[roundIndex]?.key || `round-${roundIndex}`;
      const raw = Number(point.c?.[roundIndex] || 0);
      const norm = roundNorm(point, roundIndex);
      const jitterX = (stableFraction(`${point.p}:${roundKey}:x`) - 0.5) * 10;
      const jitterY = (stableFraction(`${point.p}:${roundKey}:y`) - 0.5) * 10;
      const clusterShift = (cluster - ((props.embedding?.cluster_count || 1) - 1) / 2) * 3.5;
      const centerX = roundCount > 1 ? (left + (roundIndex * columnGap)) : (left + (innerWidth / 2));
      const x = centerX + (Number(point.x || 0) * columnSpread) + clusterShift + jitterX;
      const y = baseY + jitterY;
      const showNode = !onlyNonZero.value || raw > 0;

      positions.push({ x, y, raw, norm, showNode });

      if (showNode) {
        peptideVisible = true;
        visibleCounts[roundIndex] += 1;
        nodes.push({
          x,
          y,
          raw,
          norm,
          peptide: point.p,
          cluster,
          matched,
          highlighted,
        });
      }
    }

    if (peptideVisible) visiblePeptides += 1;

    if (edgeMode.value === 'none') continue;
    if (edgeMode.value === 'focus' && !highlighted) continue;

    for (let roundIndex = 0; roundIndex < roundCount - 1; roundIndex += 1) {
      const from = positions[roundIndex];
      const to = positions[roundIndex + 1];
      if (!from || !to) continue;
      if (onlyNonZero.value && from.raw <= 0 && to.raw <= 0) continue;

      const maxNorm = Math.max(from.norm, to.norm);
      let alpha = 0.03 + (maxNorm * 0.18);
      let widthValue = 0.35 + (maxNorm * 0.9);

      if (highlighted) {
        alpha = matched ? 0.88 : Math.max(alpha, 0.36);
        widthValue = matched ? 2.4 : Math.max(widthValue, 1.35);
      }

      edges.push({
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        alpha,
        width: widthValue,
        cluster,
      });
    }
  }

  nodes.sort((a, b) => {
    const rankA = (a.matched ? 3 : a.highlighted ? 2 : 0) + a.norm;
    const rankB = (b.matched ? 3 : b.highlighted ? 2 : 0) + b.norm;
    return rankA - rankB;
  });

  return {
    nodes,
    edges,
    visibleCounts,
    visiblePeptides,
    bounds: {
      left,
      right,
      top,
      bottom,
      innerWidth,
      innerHeight,
      columnGap,
    },
  };
}

function drawRoundGuides(ctx, width, height, bounds, visibleCounts) {
  const { left, top, innerHeight, columnGap } = bounds;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.textAlign = 'center';
  ctx.font = '600 12px Space Grotesk, sans-serif';

  rounds.value.forEach((round, index) => {
    const x = rounds.value.length > 1 ? left + (index * columnGap) : left + (bounds.innerWidth / 2);
    ctx.beginPath();
    ctx.moveTo(x, top - 18);
    ctx.lineTo(x, top + innerHeight + 16);
    ctx.stroke();
    ctx.fillText(round.label, x, 34);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.font = '500 11px IBM Plex Mono, monospace';
    ctx.fillText(`${Number(visibleCounts[index] || 0).toLocaleString()} nodes`, x, height - 20);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.font = '600 12px Space Grotesk, sans-serif';
  });
  ctx.restore();
}

function drawLegend(ctx, width) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '600 12px Space Grotesk, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText('Node = peptide at one round  |  Edge = same peptide across adjacent rounds', 18, 28);
  ctx.font = '500 11px IBM Plex Mono, monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
  ctx.fillText('Node size = log10(count + 1)  |  Color = sequence cluster', 18, 48);

  const rightStart = Math.max(width - 260, 320);
  clusterIds.value.slice(0, 6).forEach((clusterId, index) => {
    const x = rightStart + ((index % 3) * 78);
    const y = 22 + (Math.floor(index / 3) * 20);
    ctx.fillStyle = clusterColor(clusterId, 0.95);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(`C${clusterId + 1}`, x + 10, y + 4);
  });
  ctx.restore();
}

function redraw() {
  const sized = resizeCanvas();
  if (!sized) return;
  const { canvas, ctx, cssWidth, cssHeight } = sized;
  const layout = buildLayout(cssWidth, cssHeight);
  const { nodes, edges, visibleCounts, visiblePeptides, bounds } = layout;

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = '#111315';
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = 'rgba(30, 37, 40, 0.92)';
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.strokeRect(0.5, 0.5, cssWidth - 1, cssHeight - 1);

  drawRoundGuides(ctx, cssWidth, cssHeight, bounds, visibleCounts);

  for (const edge of edges) {
    ctx.beginPath();
    ctx.strokeStyle = clusterColor(edge.cluster, edge.alpha);
    ctx.lineWidth = edge.width;
    ctx.moveTo(edge.x1, edge.y1);
    ctx.lineTo(edge.x2, edge.y2);
    ctx.stroke();
  }

  for (const node of nodes) {
    ctx.beginPath();
    ctx.fillStyle = clusterColor(node.cluster, node.matched ? 0.98 : 0.18 + (node.norm * 0.76));
    ctx.arc(node.x, node.y, node.raw > 0 ? 1 + (node.norm * 4) : 0.7, 0, Math.PI * 2);
    ctx.fill();

    if (node.highlighted) {
      ctx.beginPath();
      ctx.strokeStyle = node.matched ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.48)';
      ctx.lineWidth = node.matched ? 1.2 : 0.7;
      ctx.arc(node.x, node.y, 2.4 + (node.norm * 4.2), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawLegend(ctx, cssWidth);

  layoutMeta.value = {
    visiblePeptides,
    visibleNodes: nodes.length,
    visibleEdges: edges.length,
    visibleCounts,
  };

  return { canvas, ctx };
}

function requestRedraw() {
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    redraw();
  });
}

onMounted(async () => {
  await nextTick();
  requestRedraw();
  window.addEventListener('resize', requestRedraw);
});

watch([() => props.embedding, onlyNonZero, edgeMode, activeCluster, searchQuery], async () => {
  await nextTick();
  requestRedraw();
}, { deep: true });

onBeforeUnmount(() => {
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  window.removeEventListener('resize', requestRedraw);
});
</script>

<template>
  <section v-if="embedding" class="cosmograph-block">
    <div class="title-row">
      <h2>Temporal Peptide Cosmograph</h2>
      <div class="toolbar-right">
        <label>
          Node filter
          <select v-model="onlyNonZero">
            <option :value="true">Only non-zero</option>
            <option :value="false">Show all sampled</option>
          </select>
        </label>
        <label>
          Edge overlay
          <select v-model="edgeMode">
            <option value="all">All trajectories</option>
            <option value="focus">Highlights only</option>
            <option value="none">Nodes only</option>
          </select>
        </label>
        <label>
          Cluster
          <select v-model="activeCluster">
            <option value="all">All clusters</option>
            <option v-for="clusterId in clusterIds" :key="clusterId" :value="clusterId">
              Cluster {{ clusterId + 1 }}
            </option>
          </select>
        </label>
        <label>
          Highlight peptide
          <input v-model="searchQuery" placeholder="Peptide substring" />
        </label>
      </div>
    </div>

    <p class="subtle chart-note">
      This view treats each visible node as one peptide in one round. Edges connect the same peptide across adjacent rounds,
      so line density shows how many trajectories persist while node size shows abundance within each round.
    </p>
    <p class="subtle chart-note">
      Visible peptides: {{ Number(layoutMeta.visiblePeptides || 0).toLocaleString() }}.
      Rendered nodes: {{ Number(layoutMeta.visibleNodes || 0).toLocaleString() }}.
      Rendered edges: {{ Number(layoutMeta.visibleEdges || 0).toLocaleString() }}.
      {{ onlyNonZero ? 'Zero-count states are hidden by default.' : 'Zero-count states remain in the layout as sampled background.' }}
    </p>

    <div ref="wrapper" class="cosmograph-canvas-wrap">
      <canvas ref="canvasRef" class="cosmograph-canvas" />
    </div>
  </section>
</template>
