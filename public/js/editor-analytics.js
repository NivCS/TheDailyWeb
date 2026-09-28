(() => {
  const articleSelect = document.getElementById('analytics-article');
  const rangeSelect = document.getElementById('analytics-range');
  const status = document.getElementById('analytics-status');
  const canvas = document.getElementById('analytics-chart');
  const totalViewCount = document.getElementById('analytics-total-views');
  const rangeViewCount = document.getElementById('analytics-range-views');
  const trackingStart = document.getElementById('analytics-tracking-start');
  const eventList = document.getElementById('publication-event-list');
  if (!articleSelect || !rangeSelect || !canvas || !window.Chart || !articleSelect.value) return;

  const annotationPlugin = window['chartjs-plugin-annotation'];
  if (annotationPlugin) Chart.register(annotationPlugin);
  let chart;
  let activeRequest = 0;
  const numberFormat = new Intl.NumberFormat('en-US');
  const dateTimeFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

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
      return [`publication-${index}`, {
        type: 'line', xMin: position, xMax: position,
        borderColor: event.eventType === 'update' ? '#e86e55' : '#547d42',
        borderWidth: 2, borderDash: event.eventType === 'update' ? [6, 4] : [],
        label: { display: true, content: eventLabel(event.eventType), position: 'start', backgroundColor: event.eventType === 'update' ? '#e86e55' : '#547d42', color: '#fff', font: { size: 10 }, padding: 5 }
      }];
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
    setStatus('Loading readership data…');
    try {
      const url = `/editor/api/analytics/${encodeURIComponent(articleSelect.value)}?range=${encodeURIComponent(rangeSelect.value)}`;
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
      setStatus(`${data.article.title} · ${rangeSelect.options[rangeSelect.selectedIndex].text}`);
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

  articleSelect.addEventListener('change', loadAnalytics);
  rangeSelect.addEventListener('change', loadAnalytics);
  loadAnalytics();
})();
