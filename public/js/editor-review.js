(() => {
  const page = document.getElementById('editor-review');
  if (!page) return;
  const id = encodeURIComponent(page.dataset.articleId);
  const status = document.getElementById('editor-action-status');
  const form = document.getElementById('editor-working-copy');
  const pending = page.dataset.workflowStatus === 'pending';
  const published = page.dataset.hasPublic === 'true' && !pending;
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
    content: fields.content.value.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
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
    if (!window.confirm('Save and publish these changes to the live article?')) return;
    setBusy(true); status.textContent = 'Publishing changes…';
    try {
      const data = await request('/published', 'PUT', { workingCopy: workingCopy() });
      status.textContent = data.message;
      location.href = data.redirectTo;
    } catch (error) { status.textContent = error.message; setBusy(false); }
  });

  document.getElementById('approve-editor-article')?.addEventListener('click', async () => {
    if (!window.confirm('Approve and publish this version?')) return;
    setBusy(true); status.textContent = 'Publishing…';
    try {
      const data = await request('/approve', 'POST', { workingCopy: workingCopy() });
      status.textContent = data.message; location.href = data.redirectTo;
    } catch (error) { status.textContent = error.message; setBusy(false); }
  });
  document.getElementById('return-editor-article')?.addEventListener('click', async () => {
    const note = document.getElementById('editor-review-note').value.trim();
    if (!note) { status.textContent = 'Add a note explaining the revisions needed.'; document.getElementById('editor-review-note').focus(); return; }
    if (!window.confirm('Return this article to the reporter for revisions?')) return;
    setBusy(true); status.textContent = 'Returning article…';
    try {
      const data = await request('/return', 'POST', { note });
      status.textContent = data.message; location.href = data.redirectTo;
    } catch (error) { status.textContent = error.message; setBusy(false); }
  });
  document.getElementById('delete-editor-article')?.addEventListener('click', async () => {
    if (!window.confirm('Delete this article permanently? This cannot be undone.')) return;
    setBusy(true); status.textContent = 'Deleting article…';
    try { const data = await request('', 'DELETE'); location.href = data.redirectTo; }
    catch (error) { status.textContent = error.message; setBusy(false); }
  });
  if (form) form.addEventListener('submit', (event) => event.preventDefault());
})();
