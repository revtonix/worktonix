require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const exampleRoutes = require('./routes/example-usage');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'https://worktonix.vercel.app',
    'https://worktonix-workspace.vercel.app',
    'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json());

// Auth routes — no role filtering on login
app.use('/api/auth', authRoutes);

// Protected resource routes
app.use(exampleRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`WorkTonix API running on port ${PORT}`);
});
