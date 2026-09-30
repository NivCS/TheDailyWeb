const { listPublishedArticles, findPublishedArticle } = require('../data/articleStore');
const { listArticleComments } = require('../data/commentStore');
const { recordArticleView } = require('../data/analyticsStore');

const categories = require('../config/articleCategories');

async function list(req, res, next) {
  try {
    const requestedCategory = String(req.query.category || '');
    const readState = ['read', 'unread'].includes(req.query.readState) ? req.query.readState : 'all';
    const sort = req.query.sort === 'popular' ? 'popular' : 'date';
    const viewedIds = String(req.query.viewedIds || '').split(',').filter(Boolean).slice(0, 1000);
    const result = await listPublishedArticles({
      search: String(req.query.search || '').slice(0, 120),
      category: categories.includes(requestedCategory) ? requestedCategory : '',
      readState,
      viewedIds,
      sort,
      offset: req.query.offset,
      limit: req.query.limit || 20
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const article = await findPublishedArticle(req.params.id);
    if (!article) return res.status(404).json({ error: 'This story could not be found.' });
    try {
      const totalViews = await recordArticleView(article._id);
      if (totalViews !== false) article.views = totalViews;
    } catch (analyticsError) {
      console.error('Could not record article view:', analyticsError.message);
    }
    res.json({ article });
  } catch (error) {
    next(error);
  }
}

async function renderDetailPage(req, res, next) {
  try {
    const article = await findPublishedArticle(req.params.slug);
    if (!article) return res.status(404).render('article-not-found', { pageTitle: 'Story not found | The Daily Web', currentUser: req.user, activeNav: 'home' });
    try {
      const totalViews = await recordArticleView(article._id);
      if (totalViews !== false) article.views = totalViews;
    } catch (analyticsError) {
      console.error('Could not record article view:', analyticsError.message);
    }
    const comments = await listArticleComments(article._id);
    res.render('article', {
      pageTitle: `${article.title} | The Daily Web`,
      currentUser: req.user,
      activeNav: 'home',
      article,
      comments
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, detail, renderDetailPage };
