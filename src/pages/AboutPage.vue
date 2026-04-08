<template>
  <div class="about-shell">
    <section class="hero compact about-hero">
      <div class="about-hero-copy">
        <p class="eyebrow">About YARD</p>
        <h1>TCR Yeast Display Database</h1>
        <p class="about-lead">
          A curated resource for exploring high-throughput TCR-peptide landscape data from yeast display screening
          experiments, with an emphasis on specificity, cross-reactivity, motif patterns, and structural context.
        </p>
      </div>

      <div class="about-hero-panel">
        <p class="about-hero-label">Designed For</p>
        <ul class="about-highlight-list">
          <li>Experiment browsing across TCR, HLA, and peptide settings</li>
          <li>Rapid visual inspection of enriched peptide landscapes</li>
          <li>Side-by-side comparison of published datasets</li>
          <li>Interpretation of motifs, binding predictions, and structures</li>
        </ul>
      </div>
    </section>

    <section class="about-grid">
      <article class="panel about-card about-card-wide">
        <h2>What This Resource Contains</h2>
        <p>
          Each experiment page integrates study metadata, peptide enrichment profiles across selection rounds, motif
          summaries, binding prediction outputs, and selected structural annotations when available. Together, these
          views provide a practical overview of how an individual TCR responds to peptide sequence variation within a
          peptide-MHC context.
        </p>
      </article>

      <article class="panel about-card">
        <h2>What You Can Do Here</h2>
        <ul class="about-list">
          <li>Browse published TCR yeast display experiments by TCR, HLA, peptide length, and study context.</li>
          <li>Inspect enriched peptide populations across selection rounds and compare experiments side by side.</li>
          <li>Review sequence logos, PFM heatmaps, MHC ligand motifs, and binding prediction summaries.</li>
          <li>Explore available protein complex structures linked to individual experiments.</li>
        </ul>
      </article>

      <article class="panel about-card">
        <h2>Methods Overview</h2>
        <ul class="about-list">
          <li>Sequencing reads are processed to quantify peptide frequencies across Naive and enrichment rounds.</li>
          <li>Motif analysis summarizes peptide preferences within enriched populations to highlight recognition patterns.</li>
          <li>Comparison views emphasize overlap among top-enriched peptides across experiments.</li>
          <li>Where available, binding prediction and structural context are included to support interpretation.</li>
        </ul>
      </article>

      <article class="panel about-card">
        <h2>Scope and Use</h2>
        <p>
          This website is intended as a research-facing reference and visualization layer. It is most useful for
          hypothesis generation, qualitative comparison, and rapid inspection of published yeast display datasets rather
          than as a substitute for reading the original studies and methods in full.
        </p>
      </article>

      <article class="panel about-card">
        <h2>Contact</h2>
        <p>
          For scientific questions, please refer to the corresponding publication for each experiment. For database or
          website-related issues, contact
          <a href="mailto:hashem.koohy@rdm.ox.ac.uk">Prof. Hashem Koohy</a>
          or
          <a href="mailto:yuzhu.chen@imm.ox.ac.uk">Yuzhu Chen</a>.
        </p>
      </article>
    </section>
  </div>
</template>
