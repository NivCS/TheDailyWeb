require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const articleRoutes = require('./routes/articleRoutes');
const { seedSampleArticles } = require('./data/articleStore');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.use('/api/articles', articleRoutes);

app.get('*', (req, res) => {
  res.render('home', { pageTitle: 'The Daily Web' });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Something went wrong while loading stories.' });
  }
  res.status(500).send('Something went wrong. Please try again.');
});

app.listen(port, () => {
  console.log(`The Daily Web is ready at http://localhost:${port}`);
});

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/thedailyweb';
mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2500 })
  .then(seedSampleArticles)
  .then(() => console.log('MongoDB connected; sample stories are ready.'))
  .catch(() => console.log('MongoDB is unavailable; serving the built-in sample stories.'));
