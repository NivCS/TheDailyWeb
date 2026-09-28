(() => {
  const page = document.getElementById('reporter-editor');
  if (!page) return;

  const articleId = page.dataset.articleId;
  const form = document.getElementById('article-editor-form');
  const saveState = document.getElementById('editor-save-state');
  const pageState = document.getElementById('save-state');
  const submitStatus = document.getElementById('submit-status');
  const submitButton = document.getElementById('submit-for-review');
  const deleteButton = document.getElementById('delete-draft');
  const workflowBadge = document.getElementById('article-workflow-status');
  const imagePreview = document.getElementById('article-image-preview');
  const imagePreviewMessage = document.getElementById('article-image-preview-message');
  const fields = {
    title: document.getElementById('article-title'),
    excerpt: document.getElementById('article-excerpt'),
    category: document.getElementById('article-category'),
    image: document.getElementById('article-image'),
    content: document.getElementById('article-content')
  };

  let saveTimer;
  let dirty = false;
  let saving = false;
  let activeSave = Promise.resolve();
  let canSubmit = false;

  const currentWorkingCopy = () => ({
    title: fields.title.value,
    excerpt: fields.excerpt.value,
    category: fields.category.value,
    image: fields.image.value,
    content: fields.content.value.split(/\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
  });

  function updateWorkflowStatus(status) {
    const labels = { draft: 'In preparation', pending: 'Awaiting editor approval', returned: 'Returned for revisions', published: 'Published' };
    page.dataset.workflowStatus = status;
    if (workflowBadge) {
      workflowBadge.textContent = labels[status] || labels.draft;
      workflowBadge.className = `reporter-status reporter-status-${status}`;
    }
    if (deleteButton) {
      deleteButton.hidden = status !== 'draft';
      deleteButton.lastChild.textContent = page.dataset.isPublished === 'true' ? ' Discard draft' : ' Delete draft';
    }
    submitButton.hidden = page.dataset.isPublished === 'true' && status === 'published';
  }

  function renderImagePreview() {
    if (!imagePreview || !imagePreviewMessage) return;
    const url = fields.image.value.trim();
    imagePreview.hidden = true;
    imagePreview.removeAttribute('src');
    if (!url) {
      imagePreviewMessage.textContent = 'Add an image URL to preview how it will appear on the site.';
      imagePreviewMessage.classList.remove('is-error');
      return;
    }
    if (!(url.startsWith('/') || /^https?:\/\//i.test(url))) {
      imagePreviewMessage.textContent = 'Use a URL that starts with http://, https://, or /.';
      imagePreviewMessage.classList.add('is-error');
      return;
    }
    imagePreviewMessage.textContent = 'Loading image preview…';
    imagePreviewMessage.classList.remove('is-error');
    imagePreview.onload = () => {
      imagePreview.hidden = false;
      imagePreviewMessage.textContent = '';
    };
    imagePreview.onerror = () => {
      imagePreview.hidden = true;
      imagePreviewMessage.textContent = 'This image could not be loaded. Check the URL.';
      imagePreviewMessage.classList.add('is-error');
    };
    imagePreview.src = url;
  }

  const setSaved = (savedAt) => {
    const when = savedAt ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(savedAt)) : '';
    saveState.textContent = when ? `Saved at ${when}` : 'All changes saved';
    pageState.textContent = when ? `Saved at ${when}` : 'Your latest work is saved.';
    saveState.classList.remove('is-error');
    pageState.classList.remove('is-error');
  };

  const setSaveError = (message) => {
    saveState.textContent = message;
    pageState.textContent = message;
    saveState.classList.add('is-error');
    pageState.classList.add('is-error');
  };

  async function persistDraft() {
    if (saving) {
      try { await activeSave; } catch { /* The save handler displays the failure and keeps the draft dirty. */ }
      if (dirty) return persistDraft();
      return;
    }
    if (!dirty) return;

    saving = true;
    dirty = false;
    const workingCopy = currentWorkingCopy();
    saveState.textContent = 'Saving…';
    pageState.textContent = 'Saving your latest changes…';
    activeSave = (async () => {
      const response = await fetch(`/reporter/api/articles/${encodeURIComponent(articleId)}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ workingCopy })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your changes could not be saved.');
      updateWorkflowStatus(data.status);
      setSaved(data.savedAt);
    })();
    try {
      await activeSave;
    } catch (error) {
      dirty = true;
      setSaveError(error.message || 'Your changes could not be saved. Check your connection.');
    } finally {
      saving = false;
    }
    if (dirty && !saveState.classList.contains('is-error')) return persistDraft();
  }

  function queueSave() {
    if (!canSubmit) return;
    dirty = true;
    saveState.textContent = 'Unsaved changes…';
    pageState.textContent = 'Saving your changes automatically…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistDraft, 500);
  }

  async function flushDraft() {
    clearTimeout(saveTimer);
    if (dirty && !saving) await persistDraft();
    if (saving) {
      try { await activeSave; } catch { /* The save handler displays the failure and keeps the draft dirty. */ }
    }
    if (dirty && !saveState.classList.contains('is-error')) await persistDraft();
    return !dirty && !saving;
  }

  async function loadDraft() {
    try {
      const response = await fetch(`/reporter/api/articles/${encodeURIComponent(articleId)}`, { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your draft could not be loaded.');
      const draft = data.article.workingCopy;
      fields.title.value = draft.title;
      fields.excerpt.value = draft.excerpt;
      fields.category.value = draft.category;
      fields.image.value = draft.image;
      fields.content.value = draft.content.join('\n');
      page.dataset.isPublished = String(data.article.published);
      updateWorkflowStatus(data.article.status);
      renderImagePreview();
      setSaved();
      canSubmit = true;
    } catch (error) {
      setSaveError(error.message || 'Your draft could not be loaded. Refresh to try again.');
      form.querySelectorAll('input, textarea, select, button').forEach((field) => { field.disabled = true; });
    }
  }

  async function submitForReview() {
    submitStatus.textContent = '';
    submitButton.disabled = true;
    const saved = await flushDraft();
    if (!saved) {
      submitStatus.textContent = 'Your latest changes are not saved yet. Please check the save message and try again.';
      submitButton.disabled = false;
      return;
    }
    try {
      const response = await fetch(`/reporter/api/articles/${encodeURIComponent(articleId)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ workingCopy: currentWorkingCopy() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'This article could not be submitted.');
      submitStatus.textContent = data.message;
      form.querySelectorAll('input, textarea, select').forEach((field) => { field.disabled = true; });
      setTimeout(() => { location.href = '/reporter/articles'; }, 1000);
    } catch (error) {
      submitStatus.textContent = error.message || 'This article could not be submitted. Please try again.';
      submitButton.disabled = false;
    }
  }

  async function deleteDraft() {
    const publishedVersionExists = page.dataset.isPublished === 'true';
    const confirmed = await window.SiteDialog.confirm({
      title: publishedVersionExists ? 'Discard this draft?' : 'Delete this draft?',
      message: publishedVersionExists
        ? 'Your published article will stay live, and this unpublished draft will be removed.'
        : 'This draft will be permanently deleted.',
      confirmLabel: publishedVersionExists ? 'Discard draft' : 'Delete draft',
      danger: true
    });
    if (!confirmed) return;
    deleteButton.disabled = true;
    submitButton.disabled = true;
    clearTimeout(saveTimer);
    if (saving) {
      try { await activeSave; } catch { /* Deletion will report if the draft is no longer available. */ }
    }
    try {
      const response = await fetch(`/reporter/api/articles/${encodeURIComponent(articleId)}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'This draft could not be deleted.');
      }
      const data = await response.json();
      location.href = data.action === 'restored' ? '/reporter/articles?status=published' : '/reporter/articles';
    } catch (error) {
      submitStatus.textContent = error.message || 'This draft could not be deleted. Please try again.';
      deleteButton.disabled = false;
      submitButton.disabled = false;
    }
  }

  form.addEventListener('input', (event) => {
    if (event.target === fields.image) renderImagePreview();
    queueSave();
  });
  form.addEventListener('change', queueSave);
  submitButton.addEventListener('click', submitForReview);
  deleteButton?.addEventListener('click', deleteDraft);
  window.addEventListener('pagehide', () => {
    clearTimeout(saveTimer);
    if ((!dirty && !saving) || !canSubmit) return;
    const payload = JSON.stringify({ workingCopy: currentWorkingCopy() });
    navigator.sendBeacon(`/reporter/api/articles/${encodeURIComponent(articleId)}/autosave`, new Blob([payload], { type: 'application/json' }));
  });

  loadDraft();
})();
