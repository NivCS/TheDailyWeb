require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const articleRoutes = require('./routes/articleRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const authRoutes = require('./routes/authRoutes');
const { loadUser } = require('./middleware/authentication');
const requestContext = require('./middleware/requestContext');
const { renderDetailPage } = require('./controllers/articleController');
const categories = require('./config/articleCategories');
const logger = require('./services/logger');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(requestContext);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/vendor/chart.js', express.static(path.join(__dirname, 'node_modules', 'chart.js', 'dist'), { maxAge: '1d' }));
app.use('/vendor/chartjs-plugin-annotation', express.static(path.join(__dirname, 'node_modules', 'chartjs-plugin-annotation', 'dist'), { maxAge: '1d' }));

app.use(loadUser);
app.use(authRoutes);
app.get('/article/:slug', renderDetailPage);
app.use('/api/articles', articleRoutes);
app.use('/api/weather', weatherRoutes);

app.get('*', (req, res) => {
  res.render('home', { pageTitle: 'The Daily Web', currentUser: req.user, activeNav: 'home', categories });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  logger.error('request_failed', error, {
    requestId: req.requestId,
    method: req.method,
    route: req.path,
    userId: req.user?.id,
    role: req.user?.role,
    durationMs: Date.now() - req.requestStartedAt
  });
  if (req.path.startsWith('/api/') || req.path.startsWith('/editor/api/')) {
    return res.status(500).json({ error: 'Something went wrong while processing this request.' });
  }
  res.status(500).send('Something went wrong. Please try again.');
});

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required. Add your MongoDB Atlas connection string to .env.');
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  logger.info('mongodb_connected');
  mongoose.connection.on('disconnected', () => logger.warn('mongodb_disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('mongodb_reconnected'));
  app.listen(port, () => {
    logger.info('server_started', { port, environment: process.env.NODE_ENV || 'development' });
  });
}

start().catch((error) => {
  logger.error('server_start_failed', error);
  process.exitCode = 1;
});

process.on('SIGINT', () => {
  logger.info('server_shutdown', { signal: 'SIGINT' });
  process.exit(0);
});
process.on('SIGTERM', () => {
  logger.info('server_shutdown', { signal: 'SIGTERM' });
  process.exit(0);
});
process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('unhandled_rejection', error);
  process.exit(1);
});
