(() => {
  document.querySelectorAll('.user-delete-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const confirmed = window.SiteDialog
        ? await window.SiteDialog.confirm({ title: 'Delete this account?', message: 'The account will be removed and its active sessions revoked. Existing articles and bylines will remain.', confirmLabel: 'Delete account', danger: true })
        : window.confirm('Delete this account? Existing articles and bylines will remain.');
      if (confirmed) form.submit();
    });
  });
})();
