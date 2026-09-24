const {
  approveEditorArticle, deleteEditorArticle, findEditorArticle, listEditorArticles,
  returnEditorArticle, saveEditorChanges, savePublishedEditorChanges
} = require('../data/editorArticleStore');
const categories = ['Science', 'Technology', 'Business', 'Climate', 'Culture', 'Health', 'World', 'Other'];
const statuses = ['draft', 'pending', 'returned', 'published'];
const labels = { draft: 'In preparation', pending: 'Awaiting editor approval', returned: 'Returned for revisions', published: 'Published' };
function editorHome(req, res) { res.redirect('/editor/articles?status=pending'); }
async function editorArticles(req, res, next) {
  try {
    const selectedStatus = statuses.includes(req.query.status) ? req.query.status : 'all';
    const search = String(req.query.search || '').trim().slice(0, 120);
    let articles = await listEditorArticles();
    if (selectedStatus !== 'all') articles = articles.filter((article) => article.workflowStatus === selectedStatus);
    if (search) {
      const query = search.toLocaleLowerCase();
      articles = articles.filter((article) => [
        article.title, article.author, article.category, article.workingCopy.title, article.workingCopy.excerpt, article.excerpt
      ].some((value) => String(value || '').toLocaleLowerCase().includes(query)));
    }
    res.render('editor-articles', {
      pageTitle: 'All articles | The Daily Web', currentUser: req.user, selectedStatus, search,
      articles: articles.map((article) => ({
        ...article, displayTitle: article.workingCopy.title || article.title || 'Untitled story',
        displayExcerpt: article.workingCopy.excerpt || article.excerpt || 'No summary yet.',
        statusLabel: article.workflowStatus === 'pending' && article.hasPublicVersion
          ? 'Update awaiting approval' : labels[article.workflowStatus] || 'In preparation'
      }))
    });
  } catch (error) { next(error); }
}
async function editorReviewPage(req, res, next) {
  try {
    const article = await findEditorArticle(req.params.id);
    if (!article) return res.status(404).render('access-denied', { pageTitle: 'Article unavailable' });
    res.render('editor-review', {
      pageTitle: 'Review article | The Daily Web', currentUser: req.user, article,
      proposed: article.hasPublicVersion && article.workflowStatus !== 'pending'
        ? { title: article.title, excerpt: article.excerpt, content: article.content, category: article.category, image: article.image }
        : article.workingCopy,
      canEdit: article.workflowStatus === 'pending' || article.hasPublicVersion,
      activeNav: 'editor',
      workflowLabel: article.workflowStatus === 'pending' && article.hasPublicVersion
        ? 'Update awaiting approval' : labels[article.workflowStatus] || 'In preparation'
    });
  } catch (error) { next(error); }
}
function normalizeWorkingCopy(input) {
  const source = input && typeof input === 'object' ? input : {};
  const title = String(source.title || '').trim().slice(0, 160);
  const excerpt = String(source.excerpt || '').trim().slice(0, 500);
  const category = categories.includes(source.category) ? source.category : 'World';
  const image = String(source.image || '').trim().slice(0, 1000);
  const content = Array.isArray(source.content)
    ? source.content.map((paragraph) => String(paragraph || '').trim()).filter(Boolean).slice(0, 100)
    : String(source.content || '').split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean).slice(0, 100);
  return { title, excerpt, content, category, image };
}
function validateWorkingCopy(copy) {
  const missing = [];
  if (!copy.title) missing.push('headline');
  if (!copy.excerpt) missing.push('summary');
  if (!copy.content.length) missing.push('at least one body paragraph');
  if (!copy.image) missing.push('main image URL');
  if (missing.length) return 'Complete the ' + missing.join(', ') + ' before approving.';
  if (copy.image && !/^https?:\/\//i.test(copy.image) && !copy.image.startsWith('/')) return 'Use an image URL that starts with http://, https://, or /.';
  return '';
}
function articleJson(article) { return { id: String(article._id), status: article.workflowStatus }; }
async function saveChanges(req, res, next) {
  try {
    const workingCopy = normalizeWorkingCopy(req.body?.workingCopy);
    const problem = validateWorkingCopy(workingCopy);
    if (problem) return res.status(400).json({ error: problem });
    const article = await saveEditorChanges(req.params.id, workingCopy);
    if (!article) return res.status(409).json({ error: 'This article is no longer awaiting review.' });
    res.json({ article: articleJson(article), message: 'Editor changes saved. The article is still awaiting approval.' });
  } catch (error) { next(error); }
}
async function savePublishedChanges(req, res, next) {
  try {
    const workingCopy = normalizeWorkingCopy(req.body?.workingCopy);
    const problem = validateWorkingCopy(workingCopy);
    if (problem) return res.status(400).json({ error: problem });
    const article = await savePublishedEditorChanges(req.params.id, workingCopy);
    if (!article) return res.status(409).json({ error: 'This article is no longer available as a published article.' });
    res.json({ article: articleJson(article), redirectTo: '/editor/articles/' + article._id, message: 'Changes are now published.' });
  } catch (error) { next(error); }
}

async function approve(req, res, next) {
  try {
    const workingCopy = normalizeWorkingCopy(req.body?.workingCopy);
    const problem = validateWorkingCopy(workingCopy);
    if (problem) return res.status(400).json({ error: problem });
    const article = await approveEditorArticle(req.params.id, workingCopy);
    if (!article) return res.status(409).json({ error: 'This article is no longer awaiting review.' });
    res.json({ article: articleJson(article), redirectTo: '/editor/articles?status=published', message: 'The article is now published.' });
  } catch (error) { next(error); }
}
async function returnForRevisions(req, res, next) {
  try {
    const note = String(req.body?.note || '').trim().slice(0, 2000);
    if (!note) return res.status(400).json({ error: 'Add a note explaining the revisions needed.' });
    const article = await returnEditorArticle(req.params.id, note);
    if (!article) return res.status(409).json({ error: 'This article is no longer awaiting review.' });
    res.json({ article: articleJson(article), redirectTo: '/editor/articles?status=returned', message: 'The article was returned to the reporter.' });
  } catch (error) { next(error); }
}
async function removeArticle(req, res, next) {
  try {
    const deleted = await deleteEditorArticle(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'This article no longer exists.' });
    res.json({ redirectTo: '/editor/articles', message: 'The article was deleted.' });
  } catch (error) { next(error); }
}
module.exports = {
  approve, editorArticles, editorHome, editorReviewPage, removeArticle,
  returnForRevisions, saveChanges, savePublishedChanges
};
