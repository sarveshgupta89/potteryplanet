import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import Database from 'better-sqlite3';
import { GoogleGenAI } from '@google/genai';
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

  app.post('/api/search-by-image', upload.single('image'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(400).json({ 
          success: false, 
          message: 'Please configure your Gemini API key in the AI Studio Secrets panel.' 
        });
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const imagePath = req.file.path;
      const imageBytes = fs.readFileSync(imagePath);
      const base64Image = imageBytes.toString('base64');

      // Fetch all products to provide context to Gemini
      const allProducts = db.prepare('SELECT id, unit_number, name, description, type FROM products').all() as any[];
      const catalogText = allProducts.map(p => `ID: ${p.id}, Unit: ${p.unit_number}, Name: ${p.name}, Type: ${p.type}, Desc: ${p.description}`).join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: req.file.mimetype,
                data: base64Image,
              },
            },
            {
              text: `Analyze this image of a garden ornament/planter/fountain. Compare it against the following product catalog:\n\n${catalogText}\n\nIdentify the most likely matching products from the catalog. Return ONLY a JSON array of the matching product IDs (e.g., [1, 4, 5]). If no good match is found, return an empty array []. Do not include any markdown formatting or other text.`,
            },
          ],
        },
      });

      fs.unlinkSync(imagePath); // Clean up uploaded file

      let matchedIds: number[] = [];
      try {
        const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || '[]';
        matchedIds = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse Gemini response:', response.text);
      }

      if (Array.isArray(matchedIds) && matchedIds.length > 0) {
        const placeholders = matchedIds.map(() => '?').join(',');
        const results = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...matchedIds);
        res.json({ success: true, keywords: ['Catalog Match'], results });
      } else {
        res.json({ success: true, keywords: [], results: [] });
      }
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      let errorMessage = err.message || 'An error occurred during visual search.';
      
      // Handle invalid API key error specifically
      if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('API key not valid')) {
        errorMessage = 'Invalid Gemini API Key. Please configure a valid API key in the AI Studio Secrets panel.';
      } else if (errorMessage.startsWith('{')) {
        try {
          const parsed = JSON.parse(errorMessage);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
          }
        } catch (e) {
          // Ignore parsing error
        }
      }
      
      res.status(500).json({ success: false, message: errorMessage });
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
