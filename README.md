# YARD Vue SPA

This folder is the production frontend for the TCR database migration:
- Framework: Vue 3 + Vite
- Deployment target: Cloudflare Pages
- Data source: static JSON files under `public/data`

## Local Development

```bash
cd vue-framework
npm install
npm run build:data
npm run dev
```

## Build for Cloudflare Pages

```bash
cd vue-framework
npm run build:data
npm run build
```

Build output is generated in `dist/`.

## Cloudflare Pages Settings

- Project repository: `YARD`
- Root directory: `vue-framework`
- Build command: `npm run build:data && npm run build`
- Build output directory: `dist`

SPA fallback is configured by `public/_redirects`:

```text
/* /index.html 200
```
