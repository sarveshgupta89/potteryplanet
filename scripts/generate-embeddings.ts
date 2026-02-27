/**
 * One-off script to pre-compute DINOv2 embeddings for all products and save to embeddings.json.
 * Run with: npx tsx scripts/generate-embeddings.ts
 */
import Database from 'better-sqlite3';
import { pipeline } from '@huggingface/transformers';
import path from 'path';
import fs from 'fs';

const db = new Database(path.join(process.cwd(), 'app.db'));
const EMBEDDINGS_CACHE = path.join(process.cwd(), 'embeddings.json');

function resolveImagePath(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  if (imageUrl.startsWith('/images/')) {
    return path.join(process.cwd(), 'extracted', path.basename(imageUrl));
  }
  if (imageUrl.startsWith('/uploads/')) {
    return path.join(process.cwd(), 'uploads', path.basename(imageUrl));
  }
  return imageUrl;
}

async function main() {
  console.log('Loading DINOv2 q8 model...');
  const extractor = await pipeline('image-feature-extraction', 'Xenova/dinov2-base', { dtype: 'q8' });
  console.log('Model loaded.');

  const products = db.prepare('SELECT id, image_url FROM products').all() as any[];
  console.log(`Computing embeddings for ${products.length} products...`);

  // Load existing cache to skip already-computed ones
  const embeddings: Record<string, number[]> = fs.existsSync(EMBEDDINGS_CACHE)
    ? JSON.parse(fs.readFileSync(EMBEDDINGS_CACHE, 'utf-8'))
    : {};

  // Open file for incremental writing to avoid JSON.stringify string-length limits
  const tmpFile = EMBEDDINGS_CACHE + '.tmp';
  const fd = fs.openSync(tmpFile, 'w');
  fs.writeSync(fd, '{');
  let first = true;

  // Write already-cached entries first
  for (const [id, emb] of Object.entries(embeddings)) {
    if (!first) fs.writeSync(fd, ',');
    fs.writeSync(fd, `${JSON.stringify(id)}:${JSON.stringify(emb)}`);
    first = false;
  }

  let done = Object.keys(embeddings).length;
  for (const product of products) {
    if (embeddings[String(product.id)]) continue; // already written above
    try {
      const localPath = resolveImagePath(product.image_url);
      const output = await extractor(localPath, { pooling: 'mean', normalize: true });
      // Take only the last-dimension values (768 for dinov2-base) in case output is unpooled
      const data = output.data as Float32Array;
      const hiddenSize = output.dims[output.dims.length - 1];
      const vec = Array.from(data.slice(0, hiddenSize));
      if (!first) fs.writeSync(fd, ',');
      fs.writeSync(fd, `${JSON.stringify(String(product.id))}:${JSON.stringify(vec)}`);
      first = false;
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${products.length}`);
    } catch (e: any) {
      console.error(`  Failed product ${product.id} (${product.image_url}): ${e.message}`);
    }
  }

  fs.writeSync(fd, '}');
  fs.closeSync(fd);
  fs.renameSync(tmpFile, EMBEDDINGS_CACHE);
  console.log(`Done. Saved ${done} embeddings to embeddings.json`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
