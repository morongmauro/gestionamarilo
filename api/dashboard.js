const { getDashboard } = require('../lib/db');

module.exports = async (req, res) => {
  try {
    const data = await getDashboard();
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
