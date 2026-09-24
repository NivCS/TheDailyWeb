require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const articleRoutes = require('./routes/articleRoutes');
const authRoutes = require('./routes/authRoutes');
const { loadUser } = require('./middleware/authentication');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.use(loadUser);
app.use(authRoutes);
app.use('/api/articles', articleRoutes);

app.get('*', (req, res) => {
  res.render('home', { pageTitle: 'The Daily Web', currentUser: req.user });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (req.path.startsWith('/api/')) {
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
  app.listen(port, () => {
    console.log(`The Daily Web is ready at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error(`The Daily Web could not connect to MongoDB: ${error.message}`);
  process.exitCode = 1;
});
