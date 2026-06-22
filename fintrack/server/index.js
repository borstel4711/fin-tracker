const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('./db');
const { log, logError } = require('./log');

process.on('uncaughtException', (err) => {
  logError('Uncaught exception, exiting:', err.stack || err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logError('Unhandled promise rejection, exiting:', reason);
  process.exit(1);
});

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  } catch (err) {
    logError('Health check failed:', err.stack || err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.use('/api', require('./routes/profiles'));
app.use('/api', require('./routes/import'));
app.use('/api', require('./routes/transactions'));
app.use('/api', require('./routes/categories'));
app.use('/api', require('./routes/rules'));
app.use('/api', require('./routes/balance'));
app.use('/api', require('./routes/reports'));

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Unknown endpoint: ${req.method} ${req.originalUrl}` });
});

const webDist = path.join(__dirname, '..', 'web', 'dist');
const indexHtml = path.join(webDist, 'index.html');
if (!fs.existsSync(indexHtml)) {
  logError(
    `Frontend build not found at ${indexHtml}. Did the Docker build run "npm run build" in web/? The UI will not load until this exists.`
  );
}
app.use(express.static(webDist));
app.get('*', (req, res) => {
  res.sendFile(indexHtml, (err) => {
    if (err) {
      logError(`Failed to serve frontend (${indexHtml}):`, err.message);
      res.status(500).json({ error: 'Frontend nicht gefunden. Wurde der Web-Build ausgeführt?' });
    }
  });
});

// Must be registered after all routes; Express only invokes 4-arg
// middleware as an error handler.
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    logError(`${req.method} ${req.originalUrl}: upload exceeded size limit`);
    return res.status(400).json({ error: 'Datei zu groß (max. 25 MB)' });
  }
  logError(`${req.method} ${req.originalUrl} failed:`, err.stack || err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 8099;
const server = app.listen(PORT, () => {
  log(`My Cash Supervisor server listening on port ${PORT}`);
});

function shutdown(signal) {
  log(`Received ${signal}, shutting down...`);
  server.close(() => {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    process.exit(0);
  });
  // Force-exit if requests/connections don't drain in time
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
