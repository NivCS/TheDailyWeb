(() => {
  const PAGE_SIZE = 20;
  const STORAGE_KEY = 'dailyweb-read-stories-v1';
  let searchInput = document.getElementById('story-search');
  let categoryFilter = document.getElementById('category-filter');
  let readFilter = document.getElementById('read-filter');
  let sortFilter = document.getElementById('sort-filter');
  let feedGrid = document.getElementById('feed-grid');
  let resultSummary = document.getElementById('result-summary');
  let feedStatus = document.getElementById('feed-status');
  let sentinel = document.getElementById('feed-sentinel');
  const nav = document.querySelector('.main-nav');
  const menuToggle = document.querySelector('.menu-toggle');
  const app = document.getElementById('app');
  const homeMarkup = app.innerHTML;
  const serverRenderedArticle = document.querySelector('[data-article-detail]');

  let offset = 0;
  let hasMore = true;
  let loading = false;
  let requestVersion = 0;
  let debounceTimer;
  let toastTimer;
  let observer;
  let savedHomeUrl = location.pathname === '/' ? `${location.pathname}${location.search}` : '/';

  const getReadIds = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  const formatDate = (value) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));

  const showToast = (message) => {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  };

  const currentFilters = () => ({
    search: searchInput.value.trim(),
    category: categoryFilter.value,
    readState: readFilter.value,
    sort: sortFilter.value
  });

  const syncUrl = () => {
    const filters = currentFilters();
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.category) params.set('category', filters.category);
    if (filters.readState !== 'all') params.set('read', filters.readState);
    if (filters.sort !== 'date') params.set('sort', filters.sort);
    const query = params.toString();
    savedHomeUrl = query ? `/?${query}` : '/';
    history.replaceState(history.state, '', savedHomeUrl);
  };

  const restoreFilters = () => {
    const params = new URLSearchParams(location.search);
    searchInput.value = params.get('search') || '';
    categoryFilter.value = params.get('category') || '';
    const readState = params.get('read');
    readFilter.value = ['read', 'unread'].includes(readState) ? readState : 'all';
    sortFilter.value = params.get('sort') === 'popular' ? 'popular' : 'date';
    updateActiveCategory();
  };

  const updateActiveCategory = () => {
    const selected = categoryFilter.value;
    document.querySelectorAll('[data-category-link]').forEach((link) => {
      link.classList.toggle('is-active', link.dataset.categoryLink === selected);
    });
    document.querySelector('[data-home-link]')?.classList.toggle('is-active', !selected);
  };

  const showLoading = (append) => {
    if (append) {
      feedStatus.innerHTML = '<span class="loading-dots" aria-label="Loading more stories"><i></i><i></i><i></i></span>';
      return;
    }
    feedGrid.setAttribute('aria-busy', 'true');
    feedStatus.textContent = '';
  };

  const storyCard = (article) => {
    const isRead = getReadIds().includes(article.slug);
    const date = formatDate(article.publishedAt);
    return `<article class="story-card">
      <a class="story-image-link article-image-crop" href="/article/${encodeURIComponent(article.slug)}" data-story-link="${escapeHtml(article.slug)}" aria-label="Read: ${escapeHtml(article.title)}">
        <img class="story-image article-image-crop-image" src="${escapeHtml(article.image)}" alt="Editorial photograph for ${escapeHtml(article.title)}" loading="lazy">
        <span class="story-category">${escapeHtml(article.category)}</span>
        <span class="story-read-mark ${isRead ? '' : 'is-unread'}" aria-label="${isRead ? 'Read' : 'Unread'}">${isRead ? '✓' : ''}</span>
      </a>
      <div class="story-card-content">
        <div class="story-overline"><span class="story-author">By ${escapeHtml(article.author)}</span><time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(date)}</time></div>
        <h3 class="story-title"><a href="/article/${encodeURIComponent(article.slug)}" data-story-link="${escapeHtml(article.slug)}">${escapeHtml(article.title)}</a></h3>
        <p class="story-excerpt">${escapeHtml(article.excerpt)}</p>
        <div class="story-card-footer"><span>${Number(article.views || 0).toLocaleString('en')} reads</span></div>
      </div>
    </article>`;
  };

  async function loadStories({ reset = false } = {}) {
    if (loading && !reset) return;
    if (reset) {
      requestVersion += 1;
      offset = 0;
      hasMore = true;
      feedGrid.innerHTML = '';
      syncUrl();
    }
    const version = requestVersion;
    const append = offset > 0;
    if (!hasMore && append) return;
    loading = true;
    showLoading(append);
    const filters = currentFilters();
    const params = new URLSearchParams({
      search: filters.search,
      category: filters.category,
      readState: filters.readState,
      sort: filters.sort,
      viewedIds: getReadIds().join(','),
      offset: String(offset),
      limit: String(PAGE_SIZE)
    });
    try {
      const response = await fetch(`/api/articles?${params.toString()}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('The stories could not be loaded.');
      const data = await response.json();
      if (version !== requestVersion) return;
      const articles = Array.isArray(data.articles) ? data.articles : [];
      if (reset && articles.length === 0) {
        feedGrid.innerHTML = `<div class="empty-state"><strong>No stories found.</strong>Try another search or adjust your filters.</div>`;
      } else if (articles.length) {
        feedGrid.insertAdjacentHTML('beforeend', articles.map(storyCard).join(''));
        bindStoryLinks();
      }
      offset += articles.length;
      hasMore = Boolean(data.hasMore);
      const total = Number(data.total || 0);
      resultSummary.textContent = total === 1 ? '1 story to explore' : `${total.toLocaleString('en')} stories to explore`;
      feedStatus.textContent = hasMore ? '' : (total ? 'You’re all caught up.' : '');
      feedGrid.setAttribute('aria-busy', 'false');
    } catch (error) {
      if (version !== requestVersion) return;
      if (reset) feedGrid.innerHTML = `<div class="empty-state"><strong>We couldn’t load the stories.</strong>Please check your connection and try again.</div>`;
      feedStatus.innerHTML = '<button class="retry-button" type="button">Try again</button>';
      feedStatus.querySelector('.retry-button')?.addEventListener('click', () => loadStories({ reset: !offset }));
      resultSummary.textContent = 'Stories are temporarily unavailable';
    } finally {
      if (version === requestVersion) loading = false;
    }
  }

  const markRead = (slug) => {
    const ids = new Set(getReadIds());
    ids.add(slug);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])); } catch { /* Reading still works if storage is disabled. */ }
  };

  const commentMarkup = (comment) => `<article class="comment-item" data-comment-id="${escapeHtml(comment._id)}">
    <div class="comment-meta"><strong>${escapeHtml(comment.author || 'Guest')}</strong><time datetime="${escapeHtml(comment.createdAt)}">${escapeHtml(formatDate(comment.createdAt))}</time>${comment.wasEdited ? '<span class="comment-edited">Edited</span>' : ''}${document.body.dataset.editor === 'true' ? `<span class="comment-actions"><button class="comment-action" type="button" data-comment-action="edit" aria-label="Edit comment" title="Edit comment"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19.8 7.7a2.1 2.1 0 0 0-3-3L4 16.5Z"></path><path d="m15.5 6 3 3"></path></svg></button><button class="comment-action is-danger" type="button" data-comment-action="delete" aria-label="Delete comment" title="Delete comment"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5"></path></svg></button></span>` : ''}</div>
    <p class="comment-body">${escapeHtml(comment.body)}</p>
  </article>`;

  function bindCommentActions(slug) {
    const list = document.getElementById('comment-list');
    if (!list || document.body.dataset.editor !== 'true' || list.dataset.actionsBound === 'true') return;
    list.dataset.actionsBound = 'true';
    list.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-comment-action]');
      if (!button) return;
      const item = button.closest('.comment-item');
      const commentId = item?.dataset.commentId;
      if (!commentId) return;

      if (button.dataset.commentAction === 'edit') {
        const original = item.querySelector('.comment-body')?.textContent || '';
        const form = document.createElement('form');
        form.className = 'comment-edit-form';
        const textarea = document.createElement('textarea');
        textarea.name = 'body';
        textarea.maxLength = 1000;
        textarea.required = true;
        textarea.rows = 4;
        textarea.value = original;
        const actions = document.createElement('div');
        actions.className = 'comment-edit-actions';
        const save = document.createElement('button');
        save.type = 'submit';
        save.className = 'comment-edit-save';
        save.textContent = 'Save changes';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'comment-edit-cancel';
        cancel.textContent = 'Cancel';
        actions.append(save, cancel);
        form.append(textarea, actions);
        item.querySelector('.comment-body')?.replaceWith(form);
        textarea.focus();
        cancel.addEventListener('click', () => loadComments(slug));
        form.addEventListener('submit', async (submitEvent) => {
          submitEvent.preventDefault();
          save.disabled = true;
          try {
            const response = await fetch(`/api/articles/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ body: textarea.value })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'The comment could not be updated.');
            item.outerHTML = commentMarkup(data.comment);
            document.getElementById('comment-status').textContent = 'Comment updated.';
          } catch (error) {
            save.disabled = false;
            document.getElementById('comment-status').textContent = error.message || 'The comment could not be updated.';
          }
        });
        return;
      }

      const confirmed = window.SiteDialog
        ? await window.SiteDialog.confirm({ title: 'Delete this comment?', message: 'This comment will be permanently removed.', confirmLabel: 'Delete comment', danger: true })
        : window.confirm('Delete this comment?');
      if (!confirmed) return;
      button.disabled = true;
      try {
        const response = await fetch(`/api/articles/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'The comment could not be deleted.');
        item.remove();
        if (!list.querySelector('.comment-item')) list.innerHTML = '<p class="comment-empty">No comments yet. Start the conversation.</p>';
        document.getElementById('comment-status').textContent = 'Comment deleted.';
      } catch (error) {
        button.disabled = false;
        document.getElementById('comment-status').textContent = error.message || 'The comment could not be deleted.';
      }
    });
  }

  async function loadComments(slug) {
    const list = document.getElementById('comment-list');
    const status = document.getElementById('comment-status');
    try {
      const response = await fetch(`/api/articles/${encodeURIComponent(slug)}/comments`, { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Comments could not be loaded.');
      list.innerHTML = data.comments.length ? data.comments.map(commentMarkup).join('') : '<p class="comment-empty">No comments yet. Start the conversation.</p>';
      bindCommentActions(slug);
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message || 'Comments could not be loaded. Please try again.';
    }
  }

  function bindCommentForm(slug) {
    const form = document.getElementById('comment-form');
    const status = document.getElementById('comment-status');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      const payload = { author: formData.get('author'), body: formData.get('body') };
      submit.disabled = true;
      status.textContent = 'Posting your comment…';
      try {
        const response = await fetch(`/api/articles/${encodeURIComponent(slug)}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Your comment could not be posted.');
        const list = document.getElementById('comment-list');
        list.querySelector('.comment-empty')?.remove();
        list.insertAdjacentHTML('beforeend', commentMarkup(data.comment));
        form.reset();
        status.textContent = 'Your comment was posted.';
      } catch (error) {
        status.textContent = error.message || 'Your comment could not be posted. Please try again.';
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function openStory(slug, { push = true } = {}) {
    if (push) {
      if (location.pathname === '/') savedHomeUrl = `${location.pathname}${location.search}`;
      history.pushState({ article: slug, homeUrl: savedHomeUrl }, '', `/article/${encodeURIComponent(slug)}`);
    }
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    app.innerHTML = '<section class="detail-page"><p class="detail-error">Loading story…</p></section>';
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const response = await fetch(`/api/articles/${encodeURIComponent(slug)}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Story not found');
      const { article } = await response.json();
      markRead(article.slug);
      app.innerHTML = `<article class="detail-page">
        <a class="detail-back" href="/" data-back-to-feed><span aria-hidden="true">←</span> Back to all stories</a>
        <header class="detail-header">
          <div class="detail-category">${escapeHtml(article.category)} <span aria-hidden="true">·</span> The Daily Web</div>
          <h1 class="detail-title">${escapeHtml(article.title)}</h1>
          <p class="detail-excerpt">${escapeHtml(article.excerpt)}</p>
          <div class="detail-byline"><span>By <strong>${escapeHtml(article.author)}</strong></span><time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatDate(article.publishedAt))}</time></div>
        </header>
        <div class="detail-image-wrap"><img class="detail-image" src="${escapeHtml(article.image)}" alt="Editorial photograph for ${escapeHtml(article.title)}"></div>
        <div class="detail-body">${(article.content || [article.excerpt]).flatMap((paragraph) => String(paragraph || '').split(/\r?\n/)).filter((paragraph) => paragraph.trim()).map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`).join('')}<div class="detail-end">You’re reading The Daily Web</div></div>
        <section class="comments-section" aria-labelledby="comments-title">
          <div class="comments-heading"><p class="eyebrow"><span class="eyebrow-line"></span> Join the conversation</p><h2 id="comments-title">Comments</h2></div>
          <div id="comment-list" class="comment-list" aria-live="polite"><p class="comment-empty">Loading comments…</p></div>
          <form id="comment-form" class="comment-form">
            <label for="comment-author">Name <span>(optional)</span></label>
            <input id="comment-author" name="author" type="text" maxlength="40" autocomplete="name" placeholder="Guest">
            <label for="comment-body">Your comment</label>
            <textarea id="comment-body" name="body" maxlength="1000" rows="4" required placeholder="Share a thoughtful response…"></textarea>
            <div class="comment-form-footer"><span>Up to 1,000 characters. Guests can post 3 comments per minute per device.</span><button class="comment-submit" type="submit">Post comment <span aria-hidden="true">→</span></button></div>
            <p id="comment-status" class="comment-status" role="status" aria-live="polite"></p>
          </form>
        </section>
      </article>`;
      bindCommentForm(article.slug);
      loadComments(article.slug);
      bindStoryLinks();
    } catch {
      app.innerHTML = `<section class="detail-page"><a class="detail-back" href="/" data-back-to-feed><span aria-hidden="true">←</span> Back to all stories</a><div class="detail-error"><h1>Story not found</h1><p>This story may no longer be available.</p></div></section>`;
      bindStoryLinks();
    }
  }

  function bindStoryLinks() {
    app.querySelectorAll('[data-story-link]:not([data-bound])').forEach((link) => {
      link.dataset.bound = 'true';
      link.addEventListener('click', (event) => {
      event.preventDefault();
      openStory(link.dataset.storyLink);
      });
    });
    app.querySelectorAll('[data-back-to-feed]').forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      history.pushState({}, '', history.state?.homeUrl || savedHomeUrl || '/');
      restoreFilters();
      renderFeed();
    }));
  }

  function renderFeed() {
    app.innerHTML = homeMarkup;
    searchInput = document.getElementById('story-search');
    categoryFilter = document.getElementById('category-filter');
    readFilter = document.getElementById('read-filter');
    sortFilter = document.getElementById('sort-filter');
    feedGrid = document.getElementById('feed-grid');
    resultSummary = document.getElementById('result-summary');
    feedStatus = document.getElementById('feed-status');
    sentinel = document.getElementById('feed-sentinel');
    restoreFilters();
    wireControls();
    observeFeed();
    loadStories({ reset: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector('.hero-link')?.addEventListener('click', (event) => {
      event.preventDefault();
      document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function wireControls() {
    const controls = document.getElementById('feed-controls');
    controls.addEventListener('submit', (event) => event.preventDefault());
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadStories({ reset: true }), 230);
    });
    [categoryFilter, readFilter, sortFilter].forEach((control) => control.addEventListener('change', () => {
      updateActiveCategory();
      loadStories({ reset: true });
    }));
    bindStoryLinks();
  }

  function observeFeed() {
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window) || !sentinel) return;
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && hasMore && !loading && location.pathname === '/') loadStories();
    }, { rootMargin: '480px 0px' });
    observer.observe(sentinel);
  }

  function updateNavFromUrl() {
    if (location.pathname.startsWith('/article/')) {
      openStory(decodeURIComponent(location.pathname.split('/').pop()), { push: false });
      return;
    }
    if (app.querySelector('.detail-page')) {
      restoreFilters();
      renderFeed();
    } else {
      restoreFilters();
      loadStories({ reset: true });
    }
  }

  if (!serverRenderedArticle) {
    document.querySelectorAll('[data-category-link]').forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      if (!document.getElementById('category-filter')) renderFeed();
      categoryFilter.value = link.dataset.categoryLink;
      nav.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      updateActiveCategory();
      loadStories({ reset: true });
      document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth' });
    }));
    document.querySelector('[data-home-link]')?.addEventListener('click', (event) => {
      event.preventDefault();
      if (!document.getElementById('category-filter')) renderFeed();
      categoryFilter.value = '';
      searchInput.value = '';
      readFilter.value = 'all';
      sortFilter.value = 'date';
      updateActiveCategory();
      loadStories({ reset: true });
      nav.classList.remove('is-open');
    });
  }
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput?.focus();
    }
  });
  window.addEventListener('popstate', updateNavFromUrl);

  document.querySelector('.hero-link')?.addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth' });
  });

  if (serverRenderedArticle) {
    const slug = serverRenderedArticle.dataset.articleSlug;
    if (slug) {
      markRead(slug);
      bindCommentForm(slug);
      loadComments(slug);
    }
  } else if (location.pathname.startsWith('/article/')) {
    openStory(decodeURIComponent(location.pathname.split('/').pop()), { push: false });
  } else {
    restoreFilters();
    wireControls();
    observeFeed();
    loadStories({ reset: true });
  }
})();
