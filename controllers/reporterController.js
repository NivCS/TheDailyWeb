const {
  articleWorkflowStatus,
  beginReporterEdit,
  createReporterArticle,
  deleteReporterDraft,
  listReporterArticles,
  saveReporterDraft,
  submitReporterArticle
} = require('../data/reporterArticleStore');

const categories = ['Science', 'Technology', 'Business', 'Climate', 'Culture', 'Health', 'World', 'Other'];
const workflowLabels = {
  draft: 'In preparation',
  pending: 'Awaiting editor approval',
  published: 'Published',
  returned: 'Returned for revisions'
};

function reporterArticlesPage(req, res, next) {
  const selectedStatus = ['draft', 'pending', 'published', 'returned'].includes(req.query.status) ? req.query.status : 'all';
  const selectedSort = req.query.sort === 'oldest' ? 'oldest' : 'newest';
  listReporterArticles(req.user.id, { status: selectedStatus, sort: selectedSort }).then((articles) => {
    res.render('reporter-articles', {
      pageTitle: 'My articles | The Daily Web',
      currentUser: req.user,
      selectedStatus,
      selectedSort,
      articles: articles.map((article) => ({
        ...article,
        displayTitle: article.workingCopy?.title || article.title || 'Untitled story',
        workflowStatus: articleWorkflowStatus(article),
        workflowLabel: workflowLabels[articleWorkflowStatus(article)] || workflowLabels.draft,
        isPublished: article.status === 'published' && article.approved
      }))
    });
  }).catch(next);
}

async function createArticle(req, res, next) {
  try {
    const article = await createReporterArticle(req.user.id, req.user.username);
    res.redirect(`/reporter/articles/${article._id}/edit`);
  } catch (error) {
    next(error);
  }
}

async function editArticlePage(req, res, next) {
  try {
    const article = await beginReporterEdit(req.params.id, req.user.id);
    if (!article) return res.status(404).render('access-denied', { pageTitle: 'Article unavailable' });
    res.render('reporter-editor', {
      pageTitle: 'Edit article | The Daily Web',
      currentUser: req.user,
      articleId: String(article._id),
      reviewNote: article.workflowStatus === 'returned' ? article.reviewNote : '',
      isPublished: article.status === 'published' && article.approved,
      articleStatus: articleWorkflowStatus(article)
    });
  } catch (error) {
    next(error);
  }
}

function normalizeWorkingCopy(input) {
  const source = input && typeof input === 'object' ? input : {};
  const title = String(source.title || '').trim().slice(0, 160);
  const excerpt = String(source.excerpt || '').trim().slice(0, 500);
  const category = categories.includes(source.category) ? source.category : 'World';
  const image = String(source.image || '').trim().slice(0, 1000);
  const paragraphs = Array.isArray(source.content)
    ? source.content.map((paragraph) => String(paragraph || '').trim()).filter(Boolean).slice(0, 100)
    : String(source.content || '').split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean).slice(0, 100);
  return { title, excerpt, content: paragraphs, category, image };
}

function validImageUrl(image) {
  if (!image) return true;
  return image.startsWith('/') || /^https:\/\//i.test(image) || /^http:\/\//i.test(image);
}

function editPayload(article) {
  const draft = article.workingCopy?.toObject ? article.workingCopy.toObject() : article.workingCopy || {};
  return {
    article: {
      id: String(article._id),
      status: articleWorkflowStatus(article),
      published: article.status === 'published' && article.approved,
      workingCopy: {
        title: draft.title || '',
        excerpt: draft.excerpt || '',
        content: Array.isArray(draft.content) ? draft.content : [],
        category: draft.category || 'World',
        image: draft.image || ''
      },
      reviewNote: articleWorkflowStatus(article) === 'returned' ? article.reviewNote : ''
    }
  };
}

async function getDraft(req, res, next) {
  try {
    const article = await beginReporterEdit(req.params.id, req.user.id);
    if (!article) return res.status(404).json({ error: 'This article is unavailable or cannot be edited right now.' });
    res.json(editPayload(article));
  } catch (error) {
    next(error);
  }
}

async function saveDraft(req, res, next) {
  try {
    const workingCopy = normalizeWorkingCopy(req.body?.workingCopy);
    if (!validImageUrl(workingCopy.image)) return res.status(400).json({ error: 'Use an image URL that starts with http://, https://, or /.' });
    const article = await saveReporterDraft(req.params.id, req.user.id, workingCopy);
    if (!article) return res.status(409).json({ error: 'This article can no longer be edited.' });
    res.json({ savedAt: article.updatedAt, status: articleWorkflowStatus(article) });
  } catch (error) {
    next(error);
  }
}

async function removeDraft(req, res, next) {
  try {
    const deleted = await deleteReporterDraft(req.params.id, req.user.id);
    if (!deleted) return res.status(409).json({ error: 'Only your unpublished drafts can be deleted.' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

async function submitForReview(req, res, next) {
  try {
    const article = await beginReporterEdit(req.params.id, req.user.id);
    if (!article) return res.status(409).json({ error: 'This article cannot be submitted from its current state.' });
    const workingCopy = normalizeWorkingCopy(req.body?.workingCopy || article.workingCopy);
    const missing = [];
    if (!workingCopy.title) missing.push('headline');
    if (!workingCopy.excerpt) missing.push('summary');
    if (!workingCopy.content.length) missing.push('at least one body paragraph');
    if (!workingCopy.image) missing.push('main image URL');
    if (missing.length) return res.status(400).json({ error: `Complete the ${missing.join(', ')} before submitting.` });
    if (!validImageUrl(workingCopy.image)) return res.status(400).json({ error: 'Use an image URL that starts with http://, https://, or /.' });
    await saveReporterDraft(req.params.id, req.user.id, workingCopy);
    const submitted = await submitReporterArticle(req.params.id, req.user.id);
    if (!submitted) return res.status(409).json({ error: 'This article cannot be submitted from its current state.' });
    res.json({ status: 'pending', message: 'Your article was sent to the editor for approval.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { createArticle, editArticlePage, getDraft, removeDraft, reporterArticlesPage, saveDraft, submitForReview };
