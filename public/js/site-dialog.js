(() => {
  let activeConfirmation = null;
  let noticeTimer;

  function confirmAction({
    title = 'Are you sure?',
    message = 'This action may be difficult to undo.',
    confirmLabel = 'Continue',
    cancelLabel = 'Cancel',
    danger = false
  } = {}) {
    if (activeConfirmation) activeConfirmation.finish(false);

    return new Promise((resolve) => {
      const previousFocus = document.activeElement;
      const layer = document.createElement('div');
      layer.className = 'site-dialog-layer';
      const panel = document.createElement('section');
      panel.className = 'site-dialog-panel';
      panel.setAttribute('role', 'alertdialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', 'site-dialog-title');
      panel.setAttribute('aria-describedby', 'site-dialog-message');
      panel.tabIndex = -1;

      const messageRow = document.createElement('div');
      messageRow.className = 'site-dialog-copy';
      const symbol = document.createElement('span');
      symbol.className = 'site-dialog-symbol';
      symbol.setAttribute('aria-hidden', 'true');
      symbol.textContent = '!';
      const copy = document.createElement('div');
      const heading = document.createElement('h2');
      heading.id = 'site-dialog-title';
      heading.textContent = title;
      const description = document.createElement('p');
      description.id = 'site-dialog-message';
      description.textContent = message;
      copy.append(heading, description);
      messageRow.append(symbol, copy);

      const actions = document.createElement('div');
      actions.className = 'site-dialog-actions';
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'site-dialog-cancel';
      cancelButton.textContent = cancelLabel;
      const confirmButton = document.createElement('button');
      confirmButton.type = 'button';
      confirmButton.className = danger ? 'site-dialog-confirm is-danger' : 'site-dialog-confirm';
      confirmButton.textContent = confirmLabel;
      actions.append(cancelButton, confirmButton);
      panel.append(messageRow, actions);
      layer.append(panel);
      document.body.append(layer);

      const finish = (confirmed) => {
        document.removeEventListener('keydown', onKeyDown);
        layer.remove();
        activeConfirmation = null;
        if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
        resolve(confirmed);
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        } else if (event.key === 'Tab') {
          event.preventDefault();
          (document.activeElement === cancelButton ? confirmButton : cancelButton).focus();
        }
      };

      activeConfirmation = { finish };
      cancelButton.addEventListener('click', () => finish(false));
      confirmButton.addEventListener('click', () => finish(true));
      layer.addEventListener('click', (event) => { if (event.target === layer) finish(false); });
      document.addEventListener('keydown', onKeyDown);
      cancelButton.focus();
    });
  }

  function showNotice(message, { title = 'Action not completed', type = 'error', duration = 6000 } = {}) {
    document.querySelector('.site-notice')?.remove();
    clearTimeout(noticeTimer);
    const notice = document.createElement('section');
    notice.className = `site-notice is-${type}`;
    notice.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const copy = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const text = document.createElement('span');
    text.textContent = message;
    copy.append(heading, text);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'site-notice-close';
    close.setAttribute('aria-label', 'Dismiss message');
    close.textContent = '×';
    close.addEventListener('click', () => notice.remove());
    notice.append(copy, close);
    document.body.append(notice);
    noticeTimer = setTimeout(() => notice.remove(), duration);
  }

  window.SiteDialog = { confirm: confirmAction, notice: showNotice };
})();
