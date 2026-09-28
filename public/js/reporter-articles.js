(() => {
  document.querySelectorAll('[data-delete-draft], [data-discard-published-draft]').forEach((button) => {
    button.addEventListener('click', async () => {
      const restoresPublishedVersion = button.hasAttribute('data-discard-published-draft');
      const articleId = button.dataset.discardPublishedDraft || button.dataset.deleteDraft;
      const confirmed = await window.SiteDialog.confirm({
        title: restoresPublishedVersion ? 'Discard this draft?' : 'Delete this draft?',
        message: restoresPublishedVersion
          ? 'The published article will stay live and this draft will be removed.'
          : 'This draft will be permanently deleted.',
        confirmLabel: restoresPublishedVersion ? 'Discard draft' : 'Delete draft',
        danger: true
      });
      if (!confirmed) return;
      button.disabled = true;
      try {
        const response = await fetch(`/reporter/api/articles/${encodeURIComponent(articleId)}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'This draft could not be deleted.');
        }
        const data = await response.json();
        location.href = data.action === 'restored' ? '/reporter/articles?status=published' : '/reporter/articles?status=draft';
      } catch (error) {
        window.SiteDialog.notice(error.message || 'This draft could not be removed. Please try again.', { title: 'Draft could not be updated' });
        button.disabled = false;
      }
    });
  });
})();
