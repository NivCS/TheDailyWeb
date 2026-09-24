const express = require('express');
const { loginPage, login, logout, reporterHome, reporterArticles, newReporterArticle, editorHome, editorArticles, editorAnalytics } = require('../controllers/authController');
const { requireRole } = require('../middleware/authentication');

const router = express.Router();
router.get('/login', loginPage);
router.post('/login', login);
router.post('/logout', logout);
router.get('/reporter', requireRole('reporter'), reporterHome);
router.get('/reporter/articles', requireRole('reporter'), reporterArticles);
router.get('/reporter/articles/new', requireRole('reporter'), newReporterArticle);
router.get('/editor', requireRole('editor'), editorHome);
router.get('/editor/articles', requireRole('editor'), editorArticles);
router.get('/editor/analytics', requireRole('editor'), editorAnalytics);

module.exports = router;
