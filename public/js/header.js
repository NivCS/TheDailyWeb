(() => {
  const nav = document.querySelector('.main-nav');
  const menuToggle = document.querySelector('.menu-toggle');
  const accountMenuToggle = document.getElementById('account-menu-toggle');
  const accountDropdown = document.getElementById('account-dropdown');
  const weatherMenuToggle = document.getElementById('weather-menu-toggle');
  const weatherDropdown = document.getElementById('weather-dropdown');

  const closeWeatherMenu = () => {
    if (!weatherMenuToggle || !weatherDropdown) return;
    weatherMenuToggle.setAttribute('aria-expanded', 'false');
    weatherDropdown.hidden = true;
  };

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

  const closeAccountMenu = () => {
    if (!accountMenuToggle || !accountDropdown) return;
    accountMenuToggle.setAttribute('aria-expanded', 'false');
    accountDropdown.hidden = true;
  };
  accountMenuToggle?.addEventListener('click', () => {
    const isOpen = accountMenuToggle.getAttribute('aria-expanded') === 'true';
    closeWeatherMenu();
    accountMenuToggle.setAttribute('aria-expanded', String(!isOpen));
    accountDropdown.hidden = isOpen;
  });
  weatherMenuToggle?.addEventListener('click', () => {
    const isOpen = weatherMenuToggle.getAttribute('aria-expanded') === 'true';
    closeAccountMenu();
    weatherMenuToggle.setAttribute('aria-expanded', String(!isOpen));
    weatherDropdown.hidden = isOpen;
    if (!isOpen) weatherMenuToggle.dispatchEvent(new CustomEvent('weather:open'));
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.account-menu')) closeAccountMenu();
    if (!event.target.closest('.weather-menu')) closeWeatherMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && accountDropdown && !accountDropdown.hidden) {
      closeAccountMenu();
      accountMenuToggle.focus();
    } else if (event.key === 'Escape' && weatherDropdown && !weatherDropdown.hidden) {
      closeWeatherMenu();
      weatherMenuToggle.focus();
    }
  });
})();
