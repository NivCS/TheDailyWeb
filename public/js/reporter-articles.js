(() => {
  document.querySelectorAll('[data-delete-draft]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Delete this draft permanently?')) return;
      button.disabled = true;
      try {
        const response = await fetch(`/reporter/api/articles/${encodeURIComponent(button.dataset.deleteDraft)}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'This draft could not be deleted.');
        }
        location.reload();
      } catch (error) {
        window.alert(error.message || 'This draft could not be deleted. Please try again.');
        button.disabled = false;
      }
    });
  });
})();
