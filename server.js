// Servidor local para desarrollo. En Vercel se usan los archivos en /api directamente.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const dashboardHandler = require('./api/dashboard');
const chatHandler = require('./api/chat');
const doneHandler = require('./api/tasks/[id]/done');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/dashboard', dashboardHandler);
app.post('/api/chat', chatHandler);
app.patch('/api/tasks/:id/done', (req, res) => {
  req.query.id = req.params.id;
  return doneHandler(req, res);
});

app.listen(PORT, () => {
  console.log(`✅ Servidor en http://localhost:${PORT}`);
  if (!process.env.NOTION_TOKEN) console.log('⚠ Falta NOTION_TOKEN en .env');
  if (!process.env.ANTHROPIC_API_KEY) console.log('⚠ Falta ANTHROPIC_API_KEY en .env (chat deshabilitado)');
});
