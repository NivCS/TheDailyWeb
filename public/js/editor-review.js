(() => {
  const page = document.getElementById('editor-review');
  if (!page) return;
  const id = encodeURIComponent(page.dataset.articleId);
  const status = document.getElementById('editor-action-status');
  const imageField = document.getElementById('editor-image');
  const imagePreview = document.getElementById('editor-image-preview');
  const imagePreviewMessage = document.getElementById('editor-image-preview-message');
  function renderImagePreview() {
    if (!imageField || !imagePreview || !imagePreviewMessage) return;
    const url = imageField.value.trim();
    imagePreview.hidden = true;
    imagePreview.removeAttribute('src');
    imagePreviewMessage.classList.remove('is-error');
    if (!url) { imagePreviewMessage.textContent = 'Add an image URL to preview how it will appear on the homepage.'; return; }
    if (!(url.startsWith('/') || /^https?:\/\//i.test(url))) {
      imagePreviewMessage.textContent = 'Use a URL that starts with http://, https://, or /.';
      imagePreviewMessage.classList.add('is-error');
      return;
    }
    imagePreviewMessage.textContent = 'Loading image preview…';
    imagePreview.onload = () => { imagePreview.hidden = false; imagePreviewMessage.textContent = ''; };
    imagePreview.onerror = () => { imagePreview.hidden = true; imagePreviewMessage.textContent = 'This image could not be loaded. Check the URL.'; imagePreviewMessage.classList.add('is-error'); };
    imagePreview.src = url;
  }
  renderImagePreview();
  imageField?.addEventListener('input', renderImagePreview);
  const form = document.getElementById('editor-working-copy');
  const pending = page.dataset.workflowStatus === 'pending';
  const returned = page.dataset.workflowStatus === 'returned';
  const published = page.dataset.hasPublic === 'true' && !pending && !returned;
  const fields = (pending || published) ? {
    title: document.getElementById('editor-title'),
    excerpt: document.getElementById('editor-excerpt'),
    category: document.getElementById('editor-category'),
    image: document.getElementById('editor-image'),
    content: document.getElementById('editor-content')
  } : null;
  const workingCopy = () => ({
    title: fields.title.value,
    excerpt: fields.excerpt.value,
    category: fields.category.value,
    image: fields.image.value,
    content: fields.content.value.split(/\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
  });
  async function request(path, method, body) {
    const response = await fetch('/editor/api/articles/' + id + path, {
      method, headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'The action could not be completed.');
    return data;
  }
  function setBusy(isBusy) { page.querySelectorAll('button').forEach((button) => { button.disabled = isBusy; }); }
  document.getElementById('save-editor-changes')?.addEventListener('click', async () => {
    setBusy(true); status.textContent = 'Saving editor changes…';
    try { const data = await request('', 'PUT', { workingCopy: workingCopy() }); status.textContent = data.message; }
    catch (error) { status.textContent = error.message; }
    finally { setBusy(false); }
  });
  document.getElementById('save-published-editor-changes')?.addEventListener('click', async () => {
    const confirmed = await window.SiteDialog.confirm({
      title: 'Publish these changes?',
      message: 'The edited version will replace the article readers can see now.',
      confirmLabel: 'Publish changes'
    });
    if (!confirmed) return;
    setBusy(true); status.textContent = 'Publishing changes…';
    try {
      const data = await request('/published', 'PUT', { workingCopy: workingCopy() });
      status.textContent = data.message;
      location.href = data.redirectTo;
    } catch (error) { status.textContent = error.message; setBusy(false); }
  });

  document.getElementById('approve-editor-article')?.addEventListener('click', async () => {
    const confirmed = await window.SiteDialog.confirm({
      title: 'Approve this article?',
      message: 'This version will be published and visible to all readers.',
      confirmLabel: 'Approve and publish'
    });
    if (!confirmed) return;
    setBusy(true); status.textContent = 'Publishing…';
    try {
      const data = await request('/approve', 'POST', { workingCopy: workingCopy() });
      status.textContent = data.message; location.href = data.redirectTo;
    } catch (error) { status.textContent = error.message; setBusy(false); }
  });
  document.getElementById('return-editor-article')?.addEventListener('click', async () => {
    const note = document.getElementById('editor-review-note').value.trim();
    if (!note) { status.textContent = 'Add a note explaining the revisions needed.'; document.getElementById('editor-review-note').focus(); return; }
    const confirmed = await window.SiteDialog.confirm({
      title: 'Return this article for revisions?',
      message: 'The reporter will receive your note. You can still view the version sent for review and the published version, but editing will be disabled until it is resubmitted.',
      confirmLabel: 'Return to reporter',
      danger: true
    });
    if (!confirmed) return;
    setBusy(true); status.textContent = 'Returning article…';
    try {
      const data = await request('/return', 'POST', { note });
      status.textContent = data.message; location.href = data.redirectTo;
    } catch (error) { status.textContent = error.message; setBusy(false); }
  });
  document.getElementById('delete-editor-article')?.addEventListener('click', async () => {
    const confirmed = await window.SiteDialog.confirm({
      title: 'Delete this article?',
      message: 'This article will be permanently removed. This action cannot be undone.',
      confirmLabel: 'Delete article',
      danger: true
    });
    if (!confirmed) return;
    setBusy(true); status.textContent = 'Deleting article…';
    try { const data = await request('', 'DELETE'); location.href = data.redirectTo; }
    catch (error) { status.textContent = error.message; setBusy(false); }
  });
  if (form) form.addEventListener('submit', (event) => event.preventDefault());
})();
