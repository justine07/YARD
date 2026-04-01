<template>
  <section class="hero compact content-page">
    <p class="eyebrow">About YARD</p>
    <h1>TCR Yeast Display Database</h1>
    <p>
      YARD is a curated resource for exploring high-throughput TCR-peptide landscape data generated from yeast display
      screening experiments. The platform is designed to support browsing, comparison, and interpretation of TCR
      specificity and cross-reactivity across peptide-MHC contexts.
    </p>
  </section>

  <section class="panel content-page about-sections">
    <div>
      <h2>What This Resource Contains</h2>
      <p>
        Each experiment page integrates study metadata, peptide enrichment profiles across selection rounds, motif
        summaries, binding prediction outputs, and selected structural annotations when available. Together, these views
        provide a compact overview of how an individual TCR responds to peptide sequence variation.
      </p>
    </div>

    <div>
      <h2>What You Can Do Here</h2>
      <ul class="about-list">
        <li>Browse published TCR yeast display experiments by TCR, HLA, peptide length, and study context.</li>
        <li>Inspect enriched peptide populations across selection rounds and compare experiments side by side.</li>
        <li>Review sequence logos, PFM heatmaps, MHC ligand motifs, and binding prediction summaries.</li>
        <li>Explore available protein complex structures linked to individual experiments.</li>
      </ul>
    </div>

    <div>
      <h2>Methods Overview</h2>
      <ul class="about-list">
        <li>Sequencing reads are processed to quantify peptide frequencies across Naive and enrichment rounds.</li>
        <li>Motif analysis summarizes peptide preferences within enriched populations to highlight recognition patterns.</li>
        <li>Comparison views emphasize overlap among top-enriched peptides across experiments.</li>
        <li>Where available, binding prediction and structural context are included to support interpretation.</li>
      </ul>
    </div>

    <div>
      <h2>Scope and Use</h2>
      <p>
        This website is intended as a research-facing reference and visualization layer. It is most useful for
        hypothesis generation, qualitative comparison, and rapid inspection of published yeast display datasets rather
        than as a substitute for reading the original studies and methods in full.
      </p>
    </div>

    <div>
      <h2>Contact</h2>
      <p>
        For scientific questions, please refer to the corresponding publication for each experiment. For database or
        website-related issues, contact
        <a href="mailto:yuzhu.chen@imm.ox.ac.uk">yuzhu.chen@imm.ox.ac.uk</a>.
      </p>
    </div>
  </section>
</template>
