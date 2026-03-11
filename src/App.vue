<template>
  <div class="app-shell">
    <header class="site-header">
      <div class="container header-inner">
        <RouterLink class="site-title" to="/">TCR Yeast Display Database</RouterLink>
        <nav class="site-nav">
          <RouterLink to="/">Home</RouterLink>
          <RouterLink to="/experiments">Experiments</RouterLink>
          <RouterLink to="/compare">Compare</RouterLink>
          <RouterLink to="/about">About</RouterLink>
          <RouterLink to="/release">Release</RouterLink>
        </nav>
      </div>
    </header>

    <main class="container main-content">
      <RouterView />
    </main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <p>TCR-pMHC Interaction Database. Static SPA build for Cloudflare Pages.</p>
        <div class="footer-links">
          <RouterLink to="/data">Data</RouterLink>
          <RouterLink to="/citation">Citation</RouterLink>
        </div>
      </div>
    </footer>
  </div>
</template>
