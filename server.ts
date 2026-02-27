import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import Database from 'better-sqlite3';
import { pipeline } from '@huggingface/transformers';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DATA_DIR: set to a Render persistent disk mount path (e.g. /data) in production
// so that the database and uploaded images survive deploys/restarts.
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// RFC 4180 CSV parser (handles quoted fields with escaped double-quotes)
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(current); current = ''; }
      else { current += ch; }
    }
  }
  fields.push(current);
  return fields;
}

// Initialize DB — stored on persistent disk in production
const db = new Database(path.join(DATA_DIR, 'app.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_number TEXT UNIQUE,
    name TEXT,
    description TEXT,
    price REAL,
    vendor TEXT,
    type TEXT,
    size TEXT,
    image_url TEXT,
    h TEXT DEFAULT '',
    w TEXT DEFAULT '',
    b TEXT DEFAULT '',
    d TEXT DEFAULT '',
    base TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER,
    product_id INTEGER,
    PRIMARY KEY (user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// Insert admin user if not exists
const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)');
insertUser.run('admin', 'password');

// Migrate: add dimension columns to existing DBs that predate this schema
for (const col of ['h', 'w', 'b', 'd', 'base']) {
  try { db.exec(`ALTER TABLE products ADD COLUMN ${col} TEXT DEFAULT ''`); } catch { /* already exists */ }
}

// Seed products from products.csv if table is empty
const count = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
if (count.count === 0) {
  const csvPath = 'products.csv';
  if (fs.existsSync(csvPath)) {
    console.log('Seeding products from products.csv...');
    const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter(l => l.trim() !== '');
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO products (unit_number, name, description, price, vendor, type, size, image_url, h, w, b, d, base) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertMany = db.transaction((rows: string[]) => {
      for (const line of rows) {
        const [prod_num, name, type, h, w, b, d, base, dimensions, photo_filename, , vendor, price] = parseCSVLine(line);
        stmt.run(
          prod_num.trim(), name.trim(), '', parseFloat(price) || 0,
          vendor.trim(), type.trim(), dimensions.trim(), `/images/${photo_filename.trim()}`,
          h.trim(), w.trim(), b.trim(), d.trim(), base.trim()
        );
      }
    });
    insertMany(lines);
    console.log(`Seeded ${lines.length} products from CSV.`);
  } else {
    console.warn('products.csv not found — starting with empty catalog.');
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/images', express.static(path.join(process.cwd(), 'extracted')));
  app.use('/uploads', express.static(UPLOADS_DIR));

  const upload = multer({ dest: path.join(UPLOADS_DIR, 'tmp') });

  const productImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOADS_DIR, 'products');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    },
  });
  const productImageUpload = multer({ storage: productImageStorage });

  app.post('/api/upload-image', productImageUpload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    res.json({ success: true, url: `/uploads/products/${req.file.filename}` });
  });

  // API Routes
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT id, username FROM users WHERE username = ? AND password = ?').get(username, password);
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });

  app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    try {
      const insertUser = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
      const result = insertUser.run(username, password);
      const user = { id: result.lastInsertRowid, username };
      res.json({ success: true, user });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ success: false, message: 'Username already exists' });
      } else {
        res.status(500).json({ success: false, message: 'Failed to create user' });
      }
    }
  });

  app.get('/api/products', (req, res) => {
    const { vendor, type, minPrice, maxPrice, search, minH, maxH, minW, maxW } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];

    if (vendor) { query += ' AND vendor = ?'; params.push(vendor); }
    if (type) { query += ' AND type = ?'; params.push(type); }
    if (minPrice) { query += ' AND price >= ?'; params.push(minPrice); }
    if (maxPrice) { query += ' AND price <= ?'; params.push(maxPrice); }
    if (search) {
      query += ' AND (name LIKE ? OR unit_number LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (minH) { query += " AND h != '' AND CAST(h AS REAL) >= ?"; params.push(minH); }
    if (maxH) { query += " AND h != '' AND CAST(h AS REAL) <= ?"; params.push(maxH); }
    if (minW) { query += " AND w != '' AND CAST(w AS REAL) >= ?"; params.push(minW); }
    if (maxW) { query += " AND w != '' AND CAST(w AS REAL) <= ?"; params.push(maxW); }

    const products = db.prepare(query).all(...params);
    res.json(products);
  });

  app.post('/api/products', (req, res) => {
    const { unit_number, name, description, price, vendor, type, size, image_url, h, w, b, d, base } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO products (unit_number, name, description, price, vendor, type, size, image_url, h, w, b, d, base) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const info = stmt.run(unit_number, name, description, price, vendor, type, size, image_url, h || '', w || '', b || '', d || '', base || '');
      res.json({ success: true, id: info.lastInsertRowid });
      // If embeddings are ready, pre-compute embedding for the new product in the background
      if (image_url && embeddingsReady) {
        computeEmbedding(resolveImagePath(image_url))
          .then((emb: number[]) => {
            productEmbeddings.set(Number(info.lastInsertRowid), emb);
            saveEmbeddingsCache();
          })
          .catch((e: any) => console.error('Failed to embed new product:', e));
      }
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.get('/api/products/by-unit/:unit_number', (req, res) => {
    const product = db.prepare('SELECT * FROM products WHERE unit_number = ?').get(req.params.unit_number);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  });

  app.put('/api/products/:id', (req, res) => {
    const { unit_number, name, description, price, vendor, type, size, image_url, h, w, b, d, base } = req.body;
    try {
      const info = db.prepare(
        'UPDATE products SET unit_number=?, name=?, description=?, price=?, vendor=?, type=?, size=?, image_url=?, h=?, w=?, b=?, d=?, base=? WHERE id=?'
      ).run(unit_number, name, description, parseFloat(price) || 0, vendor, type, size, image_url, h || '', w || '', b || '', d || '', base || '', req.params.id);
      if (info.changes === 0) return res.status(404).json({ success: false, message: 'Product not found' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/products/bulk-price', (req, res) => {
    const { updates } = req.body; // Array of { unit_number, price }
    try {
      const updateStmt = db.prepare('UPDATE products SET price = ? WHERE unit_number = ?');
      const updateMany = db.transaction((items: any[]) => {
        for (const item of items) updateStmt.run(item.price, item.unit_number);
      });
      updateMany(updates);
      res.json({ success: true, message: 'Prices updated successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/products/bulk-price-file', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const vendor = (req.body.vendor || '').trim();
    const origName = req.file.originalname.toLowerCase();
    const isXlsx = origName.endsWith('.xlsx') || origName.endsWith('.xls');

    // Parse rows into { product_num, price }
    type Row = { product_num: string; price: number };
    let rows: Row[] = [];

    try {
      if (isXlsx) {
        const wb = XLSX.readFile(req.file.path);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
        if (data.length < 2) throw new Error('File has no data rows');
        const headers = data[0].map((h: any) => String(h).toLowerCase().trim());
        const numIdx = headers.findIndex((h: string) => /product|unit|num/.test(h));
        const priceIdx = headers.findIndex((h: string) => h.includes('price'));
        if (numIdx === -1 || priceIdx === -1) throw new Error('Could not find product_num and price columns');
        for (let i = 1; i < data.length; i++) {
          const product_num = String(data[i][numIdx] ?? '').trim();
          const rawPrice = String(data[i][priceIdx] ?? '').replace(/[$,\s]/g, '');
          const price = parseFloat(rawPrice);
          if (product_num && !isNaN(price)) rows.push({ product_num, price });
        }
      } else {
        // CSV
        const content = fs.readFileSync(req.file.path, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) throw new Error('File has no data rows');
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
        const numIdx = headers.findIndex(h => /product|unit|num/.test(h));
        const priceIdx = headers.findIndex(h => h.includes('price'));
        if (numIdx === -1 || priceIdx === -1) throw new Error('Could not find product_num and price columns');
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          const product_num = (cols[numIdx] ?? '').trim();
          const rawPrice = (cols[priceIdx] ?? '').replace(/[$,\s]/g, '');
          const price = parseFloat(rawPrice);
          if (product_num && !isNaN(price)) rows.push({ product_num, price });
        }
      }
    } catch (err: any) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ success: false, message: err.message });
    }

    try { fs.unlinkSync(req.file.path); } catch {}

    const updateStmt = vendor
      ? db.prepare('UPDATE products SET price = ? WHERE unit_number = ? AND vendor = ?')
      : db.prepare('UPDATE products SET price = ? WHERE unit_number = ?');

    let updatedCount = 0;
    const applyUpdates = db.transaction((items: Row[]) => {
      for (const item of items) {
        const info: any = vendor
          ? updateStmt.run(item.price, item.product_num, vendor)
          : updateStmt.run(item.price, item.product_num);
        updatedCount += info.changes;
      }
    });
    applyUpdates(rows);

    res.json({ success: true, message: `Updated ${updatedCount} product(s) from ${rows.length} rows in file.` });
  });

  app.get('/api/favorites/:userId', (req, res) => {
    const { userId } = req.params;
    const favorites = db.prepare(`
      SELECT p.* FROM products p
      JOIN favorites f ON p.id = f.product_id
      WHERE f.user_id = ?
    `).all(userId);
    res.json(favorites);
  });

  app.post('/api/favorites', (req, res) => {
    const { userId, productId } = req.body;
    try {
      db.prepare('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)').run(userId, productId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/favorites/:userId/:productId', (req, res) => {
    const { userId, productId } = req.params;
    try {
      db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(userId, productId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.put('/api/users/:id/password', (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND password = ?').get(id, currentPassword);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, id);
    res.json({ success: true, message: 'Password updated successfully' });
  });

  // DINOv2 image feature extractor for visual similarity search
  let extractor: any = null;
  const productEmbeddings = new Map<number, number[]>();
  let embeddingsReady = false;
  let warmupStarted = false;
  const EMBEDDINGS_CACHE = path.join(DATA_DIR, 'embeddings.json');

  async function getExtractor() {
    if (!extractor) {
      console.log('Loading DINOv2 image feature extraction model...');
      extractor = await pipeline('image-feature-extraction', 'Xenova/dinov2-base', { dtype: 'q8' });
      console.log('DINOv2 model loaded successfully.');
    }
    return extractor;
  }

  async function computeEmbedding(imageSource: string): Promise<number[]> {
    const ext = await getExtractor();
    const output = await ext(imageSource, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  function cosineSimilarity(a: number[], b: number[]): number {
    // Embeddings are normalized, so dot product == cosine similarity
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
  }

  // Resolve a URL-style image path to a local filesystem path for embedding
  function resolveImagePath(imageUrl: string): string {
    if (!imageUrl) return imageUrl;
    if (imageUrl.startsWith('/images/')) {
      return path.join(process.cwd(), 'extracted', path.basename(imageUrl));
    }
    if (imageUrl.startsWith('/uploads/')) {
      return path.join(process.cwd(), 'uploads', path.basename(imageUrl));
    }
    return imageUrl; // full HTTP URL or absolute path — use as-is
  }

  function saveEmbeddingsCache() {
    try {
      const data: Record<string, number[]> = {};
      for (const [id, emb] of productEmbeddings) data[String(id)] = emb;
      fs.writeFileSync(EMBEDDINGS_CACHE, JSON.stringify(data));
      console.log(`Embeddings cache saved (${productEmbeddings.size} entries).`);
    } catch (e) {
      console.error('Failed to save embeddings cache:', e);
    }
  }

  async function warmupEmbeddings() {
    try {
      // Load from disk cache first — avoids re-computing on restarts/redeploys
      if (fs.existsSync(EMBEDDINGS_CACHE)) {
        const cached = JSON.parse(fs.readFileSync(EMBEDDINGS_CACHE, 'utf-8'));
        for (const [id, emb] of Object.entries(cached)) {
          productEmbeddings.set(Number(id), emb as number[]);
        }
        console.log(`Loaded ${productEmbeddings.size} embeddings from disk cache.`);
      }

      // Compute any missing embeddings (loads model only if needed)
      const products = db.prepare('SELECT id, image_url FROM products').all() as any[];
      const missing = products.filter((p: any) => !productEmbeddings.has(p.id));
      if (missing.length > 0) {
        console.log(`Computing embeddings for ${missing.length} product(s)...`);
        for (const product of missing) {
          try {
            const localPath = resolveImagePath(product.image_url);
            const emb = await computeEmbedding(localPath);
            productEmbeddings.set(product.id, emb);
          } catch (e) {
            console.error(`Failed to embed product ${product.id}:`, e);
          }
        }
        saveEmbeddingsCache();
      }

      embeddingsReady = true;
      console.log('Visual search ready.');
    } catch (e) {
      console.error('Embedding warmup failed:', e);
    }
  }

  app.post('/api/search-by-image', upload.single('image'), async (req, res) => {
    console.log('Received search-by-image request');
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    if (!embeddingsReady) {
      // Kick off warmup on first search attempt — lazy load avoids OOM at startup
      try { fs.unlinkSync(req.file.path); } catch {}
      if (!warmupStarted) {
        warmupStarted = true;
        warmupEmbeddings();
      }
      return res.status(503).json({ success: false, message: 'Visual search is warming up, please try again in a minute.' });
    }

    try {
      const imagePath = req.file.path + '.jpg';
      fs.renameSync(req.file.path, imagePath);
      console.log('Image saved to', imagePath);

      // Compute embedding for the uploaded query image
      console.log('Computing query image embedding...');
      const queryEmbedding = await computeEmbedding(imagePath);
      console.log('Query embedding computed.');

      try {
        fs.unlinkSync(imagePath);
      } catch (e) {
        console.error('Failed to delete uploaded file', e);
      }

      // Rank all products by cosine similarity to the query image
      const allProducts = db.prepare('SELECT * FROM products').all() as any[];
      const scored = allProducts
        .filter((p: any) => productEmbeddings.has(p.id))
        .map((p: any) => ({
          product: p,
          score: cosineSimilarity(queryEmbedding, productEmbeddings.get(p.id)!),
        }))
        .sort((a: any, b: any) => b.score - a.score);

      const topResults = scored.slice(0, 6).map((s: any) => s.product);

      res.json({ success: true, keywords: [], results: topResults });
    } catch (err: any) {
      console.error('Image search error:', err);
      res.status(500).json({ success: false, message: 'Image search failed.', error: err.message, stack: err.stack });
    }
  });

  // API 404 handler
  app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'API route not found' });
  });

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
