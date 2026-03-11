<script setup>
import { onMounted, ref } from 'vue';
import { loadManifest } from '../services/dataApi';

const manifest = ref(null);

onMounted(async () => {
  manifest.value = await loadManifest();
});
</script>

<template>
  <section class="panel content-page">
    <h1>Release</h1>
    <div v-if="manifest" class="manifest">
      <p><strong>Version:</strong> {{ manifest.version }}</p>
      <p><strong>Generated at:</strong> {{ manifest.generated_at }}</p>
      <p><strong>Experiments:</strong> {{ manifest.counts?.total_experiments ?? 0 }}</p>
      <p><strong>Total peptides:</strong> {{ manifest.counts?.total_peptides ?? 0 }}</p>
    </div>
    <p v-else>Manifest is not available yet.</p>
  </section>
</template>
