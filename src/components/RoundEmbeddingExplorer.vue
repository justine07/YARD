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

const clusterPalette = ['#197278', '#c44536', '#3d405b', '#f4a261', '#5f0f40', '#2a9d8f'];
const panelCanvases = new Map();
const animationCanvas = ref(null);
const onlyNonZero = ref(true);
const currentRoundIndex = ref(0);
let frameHandle = null;
let transitionStart = 0;
let transitionFrom = 0;
let transitionTo = 0;
let animating = false;

const rounds = computed(() => props.embedding?.rounds || []);
const points = computed(() => props.embedding?.points || []);

function clusterColor(clusterIndex, alpha = 1) {
  const hex = clusterPalette[Number(clusterIndex || 0) % clusterPalette.length];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundNorm(point, roundIndex) {
  const raw = Number(point?.c?.[roundIndex] || 0);
  const maxLog = Number(rounds.value?.[roundIndex]?.max_log || 0);
  if (raw <= 0 || maxLog <= 0) return 0;
  return Math.log10(raw + 1) / maxLog;
}

function shouldRenderPoint(point, fromIndex, toIndex = fromIndex) {
  if (!onlyNonZero.value) return true;
  return Number(point?.c?.[fromIndex] || 0) > 0 || Number(point?.c?.[toIndex] || 0) > 0;
}

function mapBasePoint(canvas, x, y) {
  const padding = 18;
  const width = canvas.width - (padding * 2);
  const height = canvas.height - (padding * 2);
  return {
    x: padding + ((Number(x) + 1) * 0.5 * width),
    y: padding + ((1 - ((Number(y) + 1) * 0.5)) * height),
  };
}

function drawRoundCanvas(canvas, roundIndex) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fbf8f2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#e2ddd4';
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

  for (const point of points.value) {
    const norm = roundNorm(point, roundIndex);
    if (onlyNonZero.value && norm <= 0) continue;

    const base = mapBasePoint(canvas, point.x, point.y);
    const radius = norm > 0 ? 0.8 + (norm * 2.6) : 0.6;
    const alpha = norm > 0 ? 0.14 + (norm * 0.68) : 0.06;
    ctx.beginPath();
    ctx.fillStyle = clusterColor(point.k, alpha);
    ctx.arc(base.x, base.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHighlightTrails(ctx, canvas, fromIndex, toIndex, mix) {
  const highlightPeptides = new Set(props.embedding?.highlight_peptides || []);

  for (const point of points.value) {
    if (!highlightPeptides.has(point.p)) continue;

    ctx.strokeStyle = clusterColor(point.k, 0.6);
    ctx.lineWidth = 1.3;
    ctx.beginPath();

    let started = false;
    for (let idx = 0; idx <= toIndex; idx += 1) {
      let norm = roundNorm(point, idx);
      if (idx === toIndex && toIndex !== fromIndex) {
        const prevNorm = roundNorm(point, fromIndex);
        norm = prevNorm + ((norm - prevNorm) * mix);
      }
      if (onlyNonZero.value && norm <= 0) continue;

      const base = mapBasePoint(canvas, point.x, point.y);
      const dx = Number(point.d?.[0] || 0) * norm * 14;
      const dy = Number(point.d?.[1] || 0) * norm * 14;
      const px = base.x + dx;
      const py = base.y + dy;

      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }

    if (started) ctx.stroke();
  }
}

function drawPointTrails(ctx, canvas, fromIndex, toIndex, mix) {
  if (fromIndex === toIndex) return;

  for (const point of points.value) {
    if (!shouldRenderPoint(point, fromIndex, toIndex)) continue;

    const fromNorm = roundNorm(point, fromIndex);
    const toNorm = roundNorm(point, toIndex);
    const currentNorm = fromNorm + ((toNorm - fromNorm) * mix);

    if (onlyNonZero.value && fromNorm <= 0 && currentNorm <= 0) continue;

    const base = mapBasePoint(canvas, point.x, point.y);
    const fromDx = Number(point.d?.[0] || 0) * fromNorm * 14;
    const fromDy = Number(point.d?.[1] || 0) * fromNorm * 14;
    const currentDx = Number(point.d?.[0] || 0) * currentNorm * 14;
    const currentDy = Number(point.d?.[1] || 0) * currentNorm * 14;
    const alpha = 0.04 + (Math.max(fromNorm, currentNorm) * 0.22);

    ctx.beginPath();
    ctx.strokeStyle = clusterColor(point.k, alpha);
    ctx.lineWidth = 0.7 + (Math.max(fromNorm, currentNorm) * 0.9);
    ctx.moveTo(base.x + fromDx, base.y + fromDy);
    ctx.lineTo(base.x + currentDx, base.y + currentDy);
    ctx.stroke();
  }
}

function renderAnimationCanvas(fromIndex = currentRoundIndex.value, toIndex = currentRoundIndex.value, mix = 0, keepTrail = false) {
  const canvas = animationCanvas.value;
  const ctx = canvas?.getContext?.('2d');
  if (!ctx || rounds.value.length === 0) return;

  if (keepTrail) {
    ctx.fillStyle = 'rgba(251, 248, 242, 0.22)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fbf8f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (const point of points.value) {
    if (!shouldRenderPoint(point, fromIndex, toIndex)) continue;

    const currentNorm = roundNorm(point, fromIndex);
    const nextNorm = roundNorm(point, toIndex);
    const norm = currentNorm + ((nextNorm - currentNorm) * mix);
    const base = mapBasePoint(canvas, point.x, point.y);
    const dx = Number(point.d?.[0] || 0) * norm * 14;
    const dy = Number(point.d?.[1] || 0) * norm * 14;
    const radius = norm > 0 ? 0.9 + (norm * 3.2) : 0.7;
    const alpha = norm > 0 ? 0.12 + (norm * 0.72) : 0.05;

    ctx.beginPath();
    ctx.fillStyle = clusterColor(point.k, alpha);
    ctx.arc(base.x + dx, base.y + dy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPointTrails(ctx, canvas, fromIndex, toIndex, mix);
  drawHighlightTrails(ctx, canvas, fromIndex, toIndex, mix);

  ctx.fillStyle = 'rgba(31, 31, 31, 0.92)';
  ctx.font = '600 14px Space Grotesk, sans-serif';
  const label = fromIndex === toIndex
    ? `Current round: ${rounds.value[fromIndex]?.label || ''}`
    : `Transition: ${rounds.value[fromIndex]?.label || ''} → ${rounds.value[toIndex]?.label || ''}`;
  ctx.fillText(label, 18, 26);
  ctx.fillText('Click the canvas to advance', 18, 46);
}

function animateStep(timestamp) {
  if (!animating) return;
  if (!transitionStart) transitionStart = timestamp;

  const duration = 520;
  const progress = Math.min((timestamp - transitionStart) / duration, 1);
  renderAnimationCanvas(transitionFrom, transitionTo, progress, true);

  if (progress >= 1) {
    animating = false;
    currentRoundIndex.value = transitionTo;
    transitionStart = 0;
    renderAnimationCanvas(currentRoundIndex.value, currentRoundIndex.value, 0, false);
    frameHandle = null;
    return;
  }

  frameHandle = requestAnimationFrame(animateStep);
}

function advanceRound() {
  if (rounds.value.length < 2 || animating) return;
  transitionFrom = currentRoundIndex.value;
  transitionTo = (currentRoundIndex.value + 1) % rounds.value.length;
  transitionStart = 0;
  animating = true;
  frameHandle = requestAnimationFrame(animateStep);
}

function redrawPanels() {
  rounds.value.forEach((round, index) => {
    const canvas = panelCanvases.get(round.key);
    if (canvas) drawRoundCanvas(canvas, index);
  });
}

function setPanelCanvas(roundKey, el) {
  if (el) panelCanvases.set(roundKey, el);
  else panelCanvases.delete(roundKey);
}

onMounted(async () => {
  await nextTick();
  redrawPanels();
  renderAnimationCanvas();
});

watch([() => props.embedding, onlyNonZero], async () => {
  currentRoundIndex.value = 0;
  animating = false;
  transitionStart = 0;
  if (frameHandle) {
    cancelAnimationFrame(frameHandle);
    frameHandle = null;
  }
  await nextTick();
  redrawPanels();
  renderAnimationCanvas();
}, { deep: true });

onBeforeUnmount(() => {
  if (frameHandle) cancelAnimationFrame(frameHandle);
});
</script>

<template>
  <section v-if="embedding" class="embedding-block">
    <div class="title-row">
      <h2>Sequence Embedding Map</h2>
      <div class="toolbar-right">
        <label>
          Point filter
          <select v-model="onlyNonZero">
            <option :value="true">Only non-zero</option>
            <option :value="false">Show all sampled</option>
          </select>
        </label>
      </div>
    </div>

    <p class="subtle chart-note">
      UMAP-like sequence map generated offline from peptide sequence features. Small multiples show each round on the same embedding;
      cluster colors are fixed across rounds so local structure is easier to compare.
    </p>

    <div class="embedding-grid">
      <article v-for="(round, index) in rounds" :key="round.key" class="embedding-card">
        <div class="embedding-card-head">
          <h3>{{ round.label }}</h3>
        </div>
        <canvas :ref="(el) => setPanelCanvas(round.key, el)" class="embedding-canvas" width="220" height="220" />
      </article>
    </div>

    <article class="embedding-animation-card">
      <div class="embedding-card-head">
        <h3>Round Transition Animation</h3>
      </div>
      <canvas
        ref="animationCanvas"
        :class="['embedding-animation-canvas', 'clickable-canvas', { 'embedding-animation-canvas-full': fullscreen }]"
        :width="fullscreen ? 1440 : 920"
        :height="fullscreen ? 720 : 340"
        @click="advanceRound"
      />
    </article>
  </section>
</template>
