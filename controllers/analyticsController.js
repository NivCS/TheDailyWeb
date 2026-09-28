const {
  getArticleAnalytics, listAnalyticsArticles
} = require('../data/analyticsStore');

const ranges = ['1h', '24h', '7d', '30d', '90d'];

async function editorAnalytics(req, res, next) {
  try {
    const articles = await listAnalyticsArticles();
    res.render('editor-analytics', {
      pageTitle: 'Impact analytics | The Daily Web',
      currentUser: req.user,
      activeNav: 'analytics',
      articles
    });
  } catch (error) {
    next(error);
  }
}

async function articleAnalytics(req, res, next) {
  try {
    const range = ranges.includes(req.query.range) ? req.query.range : '30d';
    const analytics = await getArticleAnalytics(req.params.articleId, range);
    if (!analytics) return res.status(404).json({ error: 'Published article not found.' });
    res.json({ analytics });
  } catch (error) {
    next(error);
  }
}

module.exports = { articleAnalytics, editorAnalytics };
