# Pottery Planet

A mobile-first product catalog app for browsing, searching, and managing garden pottery and outdoor decor. Built for sales reps and buyers to explore inventory from vendors like Giannini, Campia, and Herit.

## Features

- **Catalog** — Browse all products in a filterable grid. Filter by vendor, type, price, height, and width. Tap any card to open the full product detail page.
- **Visual Search** — Upload or take a photo to find visually similar products using DINOv2 image embeddings.
- **Wishlist** — Save products to a personal favorites list.
- **Admin Panel** — Add products, edit existing products by unit number, bulk update prices via CSV, and manage passwords.
- **Product Detail** — Full uncropped image, dimensions, description, price, and vendor info.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, React Router v7 |
| Backend | Express 4, TypeScript (tsx) |
| Database | SQLite (better-sqlite3) |
| Visual Search | DINOv2 (`Xenova/dinov2-base` via @huggingface/transformers, q8 quantized) |
| Build | Vite 6 |

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example env file:
   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The app runs at [http://localhost:3001](http://localhost:3001).

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the server listens on | `3001` |
| `DATA_DIR` | Directory for `app.db` and `uploads/` (set to a persistent disk path in production) | `process.cwd()` |

## Visual Search

Product embeddings are pre-computed and stored in `embeddings.json` (committed to the repo). On first search, the DINOv2 q8 model is loaded on-demand (~22MB download) and the uploaded image is embedded for cosine similarity ranking.

To regenerate embeddings after adding new products:

```bash
npx tsx scripts/generate-embeddings.ts
```

Then commit the updated `embeddings.json`.

## Deploy to Railway

1. Push to GitHub.
2. Create a new Railway project from the repo.
3. Set `NODE_ENV=production` in Railway environment variables.
4. Railway runs `npm run build` (Vite frontend build) then `npm run start` (`npx tsx server.ts`).

Optionally set `DATA_DIR` to a Railway persistent volume mount path so the database and uploads survive redeploys.
