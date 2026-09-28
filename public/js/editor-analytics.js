(() => {
  const articleButton = document.getElementById('analytics-article-button');
  const articlePicker = document.getElementById('analytics-article-picker');
  const articleMenu = document.getElementById('analytics-article-menu');
  const articleSearch = document.getElementById('analytics-article-search');
  const noArticleResults = document.getElementById('analytics-article-no-results');
  const articleLabel = document.getElementById('analytics-selected-article');
  const articleOptions = [...document.querySelectorAll('.analytics-article-option')];
  const rangeSelect = document.getElementById('analytics-range');
  const status = document.getElementById('analytics-status');
  const canvas = document.getElementById('analytics-chart');
  const totalViewCount = document.getElementById('analytics-total-views');
  const rangeViewCount = document.getElementById('analytics-range-views');
  const trackingStart = document.getElementById('analytics-tracking-start');
  const eventList = document.getElementById('publication-event-list');
  if (!articleButton || !articleSearch || !rangeSelect || !canvas || !window.Chart || !articleButton.dataset.articleId) return;

  const annotationPlugin = window['chartjs-plugin-annotation'];
  if (annotationPlugin) Chart.register(annotationPlugin);
  let chart;
  let activeRequest = 0;
  let selectedArticleId = articleButton.dataset.articleId;
  let hoveredUpdateAnnotationId = null;
  const numberFormat = new Intl.NumberFormat('en-US');
  const dateTimeFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function setPickerOpen(open, focusSearch = false) {
    articleMenu.hidden = !open;
    articleButton.setAttribute('aria-expanded', String(open));
    if (open) {
      articleSearch.value = '';
      filterArticleOptions('');
      if (focusSearch) articleSearch.focus();
    }
  }

  function filterArticleOptions(query) {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    let visibleCount = 0;
    for (const option of articleOptions) {
      const matches = option.textContent.trim().toLocaleLowerCase().includes(normalizedQuery);
      option.hidden = !matches;
      if (matches) visibleCount += 1;
    }
    noArticleResults.hidden = visibleCount > 0;
  }

  function selectArticle(option) {
    selectedArticleId = option.dataset.articleId;
    articleButton.dataset.articleId = selectedArticleId;
    articleLabel.textContent = option.textContent.trim();
    for (const item of articleOptions) {
      const selected = item === option;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    }
    setPickerOpen(false);
    loadAnalytics();
    articleButton.focus();
  }

  articleButton.addEventListener('click', () => setPickerOpen(articleMenu.hidden, articleMenu.hidden));
  articleSearch.addEventListener('input', () => filterArticleOptions(articleSearch.value));
  articleSearch.addEventListener('keydown', (event) => {
    const visibleOptions = articleOptions.filter((option) => !option.hidden);
    if (event.key === 'Escape') {
      event.preventDefault();
      setPickerOpen(false);
      articleButton.focus();
    } else if (event.key === 'ArrowDown' && visibleOptions.length) {
      event.preventDefault();
      const selected = visibleOptions.find((option) => option.dataset.articleId === selectedArticleId);
      (selected || visibleOptions[0]).focus();
    }
  });
  articleOptions.forEach((option) => option.addEventListener('click', () => selectArticle(option)));
  articleMenu.addEventListener('keydown', (event) => {
    const visibleOptions = articleOptions.filter((option) => !option.hidden);
    const current = visibleOptions.indexOf(document.activeElement);
    let next = current;
    if (event.key === 'ArrowDown' && visibleOptions.length) next = (current + 1 + visibleOptions.length) % visibleOptions.length;
    else if (event.key === 'ArrowUp' && visibleOptions.length) next = (current - 1 + visibleOptions.length) % visibleOptions.length;
    else if (event.key === 'Home' && visibleOptions.length) next = 0;
    else if (event.key === 'End' && visibleOptions.length) next = visibleOptions.length - 1;
    else if (event.key === 'Escape') {
      event.preventDefault();
      setPickerOpen(false);
      articleButton.focus();
      return;
    } else return;
    event.preventDefault();
    visibleOptions[next]?.focus();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!articlePicker.contains(event.target)) setPickerOpen(false);
  });

  function eventLabel(type) {
    return type === 'update' ? 'Published update' : 'Publication';
  }

  function renderEvents(events) {
    eventList.replaceChildren();
    if (!events.length) {
      const empty = document.createElement('li');
      empty.className = 'analytics-events-empty';
      empty.textContent = 'No publication or update point falls within this time range.';
      eventList.append(empty);
      return;
    }
    for (const event of events) {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      const time = document.createElement('time');
      const actor = document.createElement('span');
      const date = new Date(event.eventAt);
      title.textContent = eventLabel(event.eventType);
      time.dateTime = date.toISOString();
      time.textContent = dateTimeFormat.format(date);
      actor.textContent = event.editor ? ` by ${event.editor}` : '';
      item.append(title, time, actor);
      eventList.append(item);
    }
  }

  function makeAnnotations(events) {
    return Object.fromEntries(events.map((event, index) => {
      const position = Date.parse(event.eventAt);
      const isUpdate = event.eventType === 'update';
      const color = isUpdate ? '#e86e55' : '#547d42';
      const annotationId = `publication-${index}`;
      const annotation = {
        type: 'line', xMin: position, xMax: position,
        borderColor: color, borderWidth: isUpdate ? 2.5 : 2, borderDash: isUpdate ? [6, 4] : [],
        label: {
          display: isUpdate ? (context) => context.id === hoveredUpdateAnnotationId : true,
          content: eventLabel(event.eventType), position: 'start', backgroundColor: color,
          color: '#fff', font: { size: 10 }, padding: 5
        }
      };
      if (isUpdate) {
        annotation.enter = ({ chart: currentChart }) => {
          hoveredUpdateAnnotationId = annotationId;
          currentChart.canvas.style.cursor = 'pointer';
          return true;
        };
        annotation.leave = ({ chart: currentChart }) => {
          if (hoveredUpdateAnnotationId === annotationId) hoveredUpdateAnnotationId = null;
          currentChart.canvas.style.cursor = '';
          return true;
        };
      }
      return [annotationId, annotation];
    }));
  }

  function renderChart(data) {
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Total views',
          data: data.points.map((point) => ({ x: Date.parse(point.at), y: point.totalViews })),
          borderColor: '#547d42', backgroundColor: 'transparent',
          borderWidth: 2.5, pointRadius: 1.5, pointHoverRadius: 5, tension: 0, stepped: 'after', fill: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, parsing: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          annotation: { annotations: makeAnnotations(data.publicationEvents) },
          tooltip: {
            callbacks: {
              title: (items) => items.length ? dateTimeFormat.format(new Date(items[0].parsed.x)) : '',
              label: (item) => `${numberFormat.format(item.parsed.y)} total views`
            }
          }
        },
        scales: {
          x: {
            type: 'linear', min: Date.parse(data.rangeStart), max: Date.parse(data.rangeEnd),
            grid: { color: 'rgb(220 226 220 / 65%)' },
            ticks: { maxTicksLimit: 8, color: '#71807a', callback: (value) => dateTimeFormat.format(new Date(Number(value))) },
            title: { display: true, text: 'Time' }
          },
          y: {
            beginAtZero: true, suggestedMin: 0, ticks: { precision: 0, color: '#71807a' },
            grid: { color: 'rgb(220 226 220 / 65%)' }, title: { display: true, text: 'Total views' }
          }
        }
      }
    });
  }

  async function loadAnalytics() {
    const requestId = ++activeRequest;
    setStatus('', false);
    try {
      const url = `/editor/api/analytics/${encodeURIComponent(selectedArticleId)}?range=${encodeURIComponent(rangeSelect.value)}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load this article’s analytics.');
      if (requestId !== activeRequest) return;
      const data = result.analytics;
      totalViewCount.textContent = numberFormat.format(data.totalViews);
      rangeViewCount.textContent = numberFormat.format(data.rangeViews);
      trackingStart.textContent = dateFormat.format(new Date(data.trackingStartedAt));
      renderChart(data);
      renderEvents(data.publicationEvents);
    } catch (error) {
      if (requestId !== activeRequest) return;
      if (chart) { chart.destroy(); chart = null; }
      totalViewCount.textContent = '—';
      rangeViewCount.textContent = '—';
      trackingStart.textContent = '—';
      renderEvents([]);
      setStatus(error.message, true);
    }
  }

  rangeSelect.addEventListener('change', loadAnalytics);
  loadAnalytics();
})();
