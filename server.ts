import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import Database from 'better-sqlite3';
import { pipeline } from '@huggingface/transformers';
import path from 'path';
import fs from 'fs';

// Initialize DB
const db = new Database('app.db');

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
    image_url TEXT
  );
  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER,
    product_id INTEGER,
    PRIMARY KEY (user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// Insert dummy user if not exists
const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)');
insertUser.run('admin', 'password');

// Dummy data for products if empty
const count = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
if (count.count === 0) {
  const insertProduct = db.prepare('INSERT INTO products (unit_number, name, description, price, vendor, type, size, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const dummyProducts = [
    ['2316', 'Anduze de Lys Pot Medium', 'Medium size pot with lys design', 150.00, 'Giannini', 'Planter', '27"H x 24"W x 13" Dia Base', 'https://picsum.photos/seed/2316/400/400'],
    ['2315', 'Anduze de Lys Pot Large', 'Large size pot with lys design', 250.00, 'Giannini', 'Planter', '33"H x 29"W x 17" Dia Base', 'https://picsum.photos/seed/2315/400/400'],
    ['2317', 'Anduze de Lys Pot Small', 'Small size pot with lys design', 95.00, 'Giannini', 'Planter', 'Small', 'https://picsum.photos/seed/2317/400/400'],
    ['2094', 'Estate Urn', 'Classic estate urn', 120.00, 'Giannini', 'Urn', '26"H x 26"W x 13" sq base', 'https://picsum.photos/seed/2094/400/400'],
    ['2095', 'Venetian Urn', 'Venetian style urn', 180.00, 'Giannini', 'Urn', '28"H x 23"W x 13" sq base', 'https://picsum.photos/seed/2095/400/400'],
    ['2092', 'Rolled Rim Square Pot', 'Square pot with rolled rim', 110.00, 'Giannini', 'Planter', '24"H x 24"W', 'https://picsum.photos/seed/2092/400/400'],
    ['871', 'Garden Ball', 'Decorative garden ball', 45.00, 'Giannini', 'Ornament', '10" diam', 'https://picsum.photos/seed/871/400/400'],
    ['2093', 'Commercial Tree Planter', 'Large commercial planter', 350.00, 'Giannini', 'Planter', '31"H x 38"W', 'https://picsum.photos/seed/2093/400/400'],
    ['2450', 'Venetian Lion Wall Plaque', 'Lion head wall plaque', 85.00, 'Campia', 'Wall Ornament', '8"x15"x17"', 'https://picsum.photos/seed/2450/400/400'],
    ['2467', 'Rams Head Wall Plaque', 'Rams head wall plaque', 75.00, 'Campia', 'Wall Ornament', '3"x8"x9"', 'https://picsum.photos/seed/2467/400/400'],
    ['2019', 'Deruta Lemon Planter', 'Lemon design planter', 160.00, 'Campia', 'Planter', '12"b x 16"w', 'https://picsum.photos/seed/2019/400/400'],
    ['2020', 'Deruta Lemon Planter Box', 'Lemon design planter box', 220.00, 'Campia', 'Planter', '18"b x 41"l x 15"w', 'https://picsum.photos/seed/2020/400/400'],
  ];
  const insertMany = db.transaction((products) => {
    for (const p of products) insertProduct.run(...p);
  });
  insertMany(dummyProducts);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Ensure uploads directory exists
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }

  const upload = multer({ dest: 'uploads/' });

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
    const { vendor, type, minPrice, maxPrice, search } = req.query;
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

    const products = db.prepare(query).all(...params);
    res.json(products);
  });

  app.post('/api/products', (req, res) => {
    const { unit_number, name, description, price, vendor, type, size, image_url } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO products (unit_number, name, description, price, vendor, type, size, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const info = stmt.run(unit_number, name, description, price, vendor, type, size, image_url);
      res.json({ success: true, id: info.lastInsertRowid });
      // If the model is already loaded, pre-compute embedding for the new product in the background
      if (image_url && extractor) {
        computeEmbedding(image_url)
          .then((emb: number[]) => productEmbeddings.set(Number(info.lastInsertRowid), emb))
          .catch((e: any) => console.error('Failed to embed new product:', e));
      }
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

  // DINOv2 image feature extractor for visual similarity search
  let extractor: any = null;
  const productEmbeddings = new Map<number, number[]>();

  async function getExtractor() {
    if (!extractor) {
      console.log('Loading DINOv2 image feature extraction model...');
      extractor = await pipeline('image-feature-extraction', 'Xenova/dinov2-base');
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

  async function ensureProductEmbeddings() {
    const products = db.prepare('SELECT id, image_url FROM products').all() as any[];
    const missing = products.filter((p: any) => !productEmbeddings.has(p.id));
    if (missing.length === 0) return;
    console.log(`Computing embeddings for ${missing.length} product(s)...`);
    for (const product of missing) {
      try {
        const emb = await computeEmbedding(product.image_url);
        productEmbeddings.set(product.id, emb);
      } catch (e) {
        console.error(`Failed to embed product ${product.id}:`, e);
      }
    }
  }

  app.post('/api/search-by-image', upload.single('image'), async (req, res) => {
    console.log('Received search-by-image request');
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    try {
      const imagePath = req.file.path + '.jpg';
      fs.renameSync(req.file.path, imagePath);
      console.log('Image saved to', imagePath);

      // Ensure all product embeddings are ready (loads model on first call)
      await ensureProductEmbeddings();

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

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
