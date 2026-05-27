import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDb } from './db';
import authRouter from './routes/auth';
import dimensionsRouter from './routes/dimensions';
import itemsRouter from './routes/items';
import relationshipsRouter from './routes/relationships';
import usersRouter from './routes/users';
import settingsRouter from './routes/settings';
import chatRouter from './routes/chat';
import systemsRouter from './routes/systems';
import orgRouter from './routes/org';
import fieldsRouter from './routes/fields';

const app = express();
const PORT = parseInt(process.env.PORT || '3002');

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRouter);
app.use('/api/dimensions', dimensionsRouter);
app.use('/api/items', itemsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/systems', systemsRouter);
app.use('/api/org', orgRouter);
app.use('/api/fields', fieldsRouter);

// Serve built React frontend (production)
const distPath = path.join(__dirname, '../../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'CMDB360 API server running. Frontend dist/ not found — run npm run build in the root directory.' });
  });
}

// Start server
initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`CMDB360 server listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
