(() => {
  const nav = document.querySelector('.main-nav');
  const menuToggle = document.querySelector('.menu-toggle');
  const accountMenuToggle = document.getElementById('account-menu-toggle');
  const accountDropdown = document.getElementById('account-dropdown');

  if (nav && menuToggle) {
    menuToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  if (!accountMenuToggle || !accountDropdown) return;
  const closeAccountMenu = () => {
    accountMenuToggle.setAttribute('aria-expanded', 'false');
    accountDropdown.hidden = true;
  };
  accountMenuToggle.addEventListener('click', () => {
    const isOpen = accountMenuToggle.getAttribute('aria-expanded') === 'true';
    accountMenuToggle.setAttribute('aria-expanded', String(!isOpen));
    accountDropdown.hidden = isOpen;
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.account-menu')) closeAccountMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !accountDropdown.hidden) {
      closeAccountMenu();
      accountMenuToggle.focus();
    }
  });
})();
