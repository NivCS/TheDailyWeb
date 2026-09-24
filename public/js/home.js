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
      <a class="story-image-link" href="/article/${encodeURIComponent(article.slug)}" data-story-link="${escapeHtml(article.slug)}" aria-label="Read: ${escapeHtml(article.title)}">
        <img class="story-image" src="${escapeHtml(article.image)}" alt="Editorial photograph for ${escapeHtml(article.title)}" loading="lazy">
        <span class="story-category">${escapeHtml(article.category)}</span>
        <span class="story-read-mark ${isRead ? '' : 'is-unread'}" aria-label="${isRead ? 'Read' : 'Unread'}">${isRead ? '✓' : ''}</span>
      </a>
      <div class="story-card-content">
        <div class="story-overline"><span class="story-author">By ${escapeHtml(article.author)}</span><time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(date)}</time></div>
        <h3 class="story-title"><a href="/article/${encodeURIComponent(article.slug)}" data-story-link="${escapeHtml(article.slug)}">${escapeHtml(article.title)}</a></h3>
        <p class="story-excerpt">${escapeHtml(article.excerpt)}</p>
        <div class="story-card-footer"><span class="story-read-time">4 min read</span><span>${Number(article.views || 0).toLocaleString('en')} reads</span></div>
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
          <div class="detail-byline"><span>By <strong>${escapeHtml(article.author)}</strong></span><time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatDate(article.publishedAt))}</time><span>4 min read</span></div>
        </header>
        <div class="detail-image-wrap"><img class="detail-image" src="${escapeHtml(article.image)}" alt="Editorial photograph for ${escapeHtml(article.title)}"></div>
        <div class="detail-body">${(article.content || [article.excerpt]).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}<div class="detail-end">You’re reading The Daily Web</div></div>
      </article>`;
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
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput.focus();
    }
  });
  window.addEventListener('popstate', updateNavFromUrl);

  document.querySelector('.hero-link')?.addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth' });
  });

  if (location.pathname.startsWith('/article/')) {
    openStory(decodeURIComponent(location.pathname.split('/').pop()), { push: false });
  } else {
    restoreFilters();
    wireControls();
    observeFeed();
    loadStories({ reset: true });
  }
})();
