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
    ['2316', 'Anduze de Lys Pot Medium', 'Medium size pot with lys design', 150.00, 'Pottery Planet', 'Planter', '27"H x 24"W x 13" Dia Base', 'https://picsum.photos/seed/2316/400/400'],
    ['2315', 'Anduze de Lys Pot Large', 'Large size pot with lys design', 250.00, 'Pottery Planet', 'Planter', '33"H x 29"W x 17" Dia Base', 'https://picsum.photos/seed/2315/400/400'],
    ['2317', 'Anduze de Lys Pot Small', 'Small size pot with lys design', 95.00, 'Pottery Planet', 'Planter', 'Small', 'https://picsum.photos/seed/2317/400/400'],
    ['2094', 'Estate Urn', 'Classic estate urn', 120.00, 'Pottery Planet', 'Urn', '26"H x 26"W x 13" sq base', 'https://picsum.photos/seed/2094/400/400'],
    ['2095', 'Venetian Urn', 'Venetian style urn', 180.00, 'Pottery Planet', 'Urn', '28"H x 23"W x 13" sq base', 'https://picsum.photos/seed/2095/400/400'],
    ['2092', 'Rolled Rim Square Pot', 'Square pot with rolled rim', 110.00, 'Pottery Planet', 'Planter', '24"H x 24"W', 'https://picsum.photos/seed/2092/400/400'],
    ['871', 'Garden Ball', 'Decorative garden ball', 45.00, 'Pottery Planet', 'Ornament', '10" diam', 'https://picsum.photos/seed/871/400/400'],
    ['2093', 'Commercial Tree Planter', 'Large commercial planter', 350.00, 'Pottery Planet', 'Planter', '31"H x 38"W', 'https://picsum.photos/seed/2093/400/400'],
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

  // Initialize the model lazily
  let classifier: any = null;
  async function getClassifier() {
    if (!classifier) {
      console.log('Loading local zero-shot image classification model...');
      classifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
      console.log('Model loaded successfully.');
    }
    return classifier;
  }

  app.post('/api/search-by-image', upload.single('image'), async (req, res) => {
    console.log('Received search-by-image request');
    if (!req.file) {
      console.log('No image uploaded');
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    try {
      const imagePath = req.file.path + '.jpg';
      fs.renameSync(req.file.path, imagePath);
      console.log('Image saved to', imagePath);

      // Fetch all products to use their names as candidate labels
      const allProducts = db.prepare('SELECT id, name, type FROM products').all() as any[];
      const candidateLabels = allProducts.map(p => p.name);

      // Load the local open-source model
      console.log('Getting classifier...');
      const classify = await getClassifier();
      
      // Run classification
      console.log('Running classification...');
      const results = await classify(imagePath, candidateLabels);
      console.log('Classification complete');
      
      try {
        fs.unlinkSync(imagePath); // Clean up uploaded file
      } catch (e) {
        console.error('Failed to delete uploaded file', e);
      }

      // Results is an array of { score, label } sorted by score descending
      let topLabels: string[] = [];
      if (results && results.length > 0) {
        // Always take the best guess as the exact match
        topLabels.push(results[0].label);
        
        // Add other good matches from the model
        const threshold = 0.05;
        const otherGoodMatches = results.slice(1).filter((r: any) => r.score > threshold).map((r: any) => r.label);
        topLabels.push(...otherGoodMatches);
      }

      let finalProducts: any[] = [];
      let keywords: string[] = [];

      if (topLabels.length > 0) {
        const topMatchName = topLabels[0];
        const topProductInfo = allProducts.find(p => p.name === topMatchName);
        keywords = topLabels.slice(0, 3); // Keep top 3 for keywords display
        
        if (topProductInfo) {
          // 1. Get the exact match
          const exactMatch = db.prepare('SELECT * FROM products WHERE id = ?').get(topProductInfo.id);
          if (exactMatch) finalProducts.push(exactMatch);

          // 2. Get other model matches
          const otherModelNames = topLabels.slice(1, 4); // next 3 matches from model
          if (otherModelNames.length > 0) {
            const otherIds = otherModelNames.map(name => allProducts.find(p => p.name === name)?.id).filter(Boolean);
            if (otherIds.length > 0) {
              const placeholders = otherIds.map(() => '?').join(',');
              const otherMatches = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...otherIds) as any[];
              // Sort them by model confidence
              otherMatches.sort((a, b) => otherIds.indexOf(a.id) - otherIds.indexOf(b.id));
              finalProducts.push(...otherMatches);
            }
          }

          // 3. Fill with similar pots (same type) up to 6 total results
          const currentIds = finalProducts.map(p => p.id);
          const limit = 6 - finalProducts.length;
          
          if (limit > 0) {
            let similarPots;
            if (currentIds.length > 0) {
              const placeholders = currentIds.map(() => '?').join(',');
              similarPots = db.prepare(`SELECT * FROM products WHERE type = ? AND id NOT IN (${placeholders}) LIMIT ?`).all(topProductInfo.type, ...currentIds, limit) as any[];
            } else {
              similarPots = db.prepare(`SELECT * FROM products WHERE type = ? LIMIT ?`).all(topProductInfo.type, limit) as any[];
            }
            finalProducts.push(...similarPots);
          }
        }
      }

      res.json({ success: true, keywords: keywords, results: finalProducts });
    } catch (err: any) {
      console.error('Local AI Error:', err);
      res.status(500).json({ success: false, message: 'An error occurred during local visual search.', error: err.message, stack: err.stack });
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
