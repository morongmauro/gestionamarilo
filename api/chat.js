const { chat } = require('../lib/chat');
const { getDashboard } = require('../lib/notion');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array requerido' });
    }

    // Cargar contexto actual de Notion para que Claude tenga datos reales
    let dashboardData = null;
    try {
      dashboardData = await getDashboard();
    } catch (e) {
      console.error('No se pudo cargar dashboard para contexto del chat:', e.message);
    }

    const reply = await chat(messages, dashboardData);
    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
