const path = require('path');
const express = require('express');
require('./db');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', require('./routes/profiles'));
app.use('/api', require('./routes/import'));
app.use('/api', require('./routes/transactions'));
app.use('/api', require('./routes/categories'));
app.use('/api', require('./routes/rules'));
app.use('/api', require('./routes/balance'));
app.use('/api', require('./routes/reports'));

const webDist = path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(webDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(webDist, 'index.html'));
});

const PORT = process.env.PORT || 8099;
app.listen(PORT, () => {
  console.log(`FinTrack server listening on port ${PORT}`);
});
