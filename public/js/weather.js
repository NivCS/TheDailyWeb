(() => {
  const widget = document.querySelector('[data-weather-widget]');
  if (!widget) return;

  const descriptions = {
    0: ['Clear sky', '☀'], 1: ['Mainly clear', '🌤'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁'],
    45: ['Fog', '🌫'], 48: ['Depositing rime fog', '🌫'], 51: ['Light drizzle', '🌦'], 53: ['Drizzle', '🌦'], 55: ['Heavy drizzle', '🌧'],
    56: ['Light freezing drizzle', '🌧'], 57: ['Freezing drizzle', '🌧'], 61: ['Light rain', '🌦'], 63: ['Rain', '🌧'], 65: ['Heavy rain', '🌧'],
    66: ['Light freezing rain', '🌧'], 67: ['Freezing rain', '🌧'], 71: ['Light snow', '🌨'], 73: ['Snow', '🌨'], 75: ['Heavy snow', '❄'],
    77: ['Snow grains', '❄'], 80: ['Light rain showers', '🌦'], 81: ['Rain showers', '🌧'], 82: ['Heavy rain showers', '🌧'],
    85: ['Light snow showers', '🌨'], 86: ['Heavy snow showers', '❄'], 95: ['Thunderstorm', '⛈'], 96: ['Thunderstorm with hail', '⛈'], 99: ['Thunderstorm with heavy hail', '⛈']
  };
  const retry = widget.querySelector('[data-weather-retry]');
  const toggle = document.getElementById('weather-menu-toggle');
  let loadedAt = 0;
  let activeRequest = null;
  const round = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : '--';

  async function loadWeather() {
    if (activeRequest) return activeRequest;
    retry.hidden = true;
    widget.classList.add('is-loading');
    const condition = widget.querySelector('[data-weather-condition]');
    condition.textContent = 'Loading current weather…';
    activeRequest = (async () => { try {
      const response = await fetch('/api/weather', { cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Weather is temporarily unavailable.');
      const [description, icon] = descriptions[data.weatherCode] || ['Current conditions', '☁'];
      widget.querySelector('[data-weather-temperature]').textContent = round(data.temperatureC);
      widget.querySelector('[data-weather-feels]').textContent = round(data.feelsLikeC);
      widget.querySelector('[data-weather-humidity]').textContent = round(data.humidityPercent);
      widget.querySelector('[data-weather-wind]').textContent = round(data.windSpeedKmh);
      widget.querySelector('[data-weather-high]').textContent = round(data.highC);
      widget.querySelector('[data-weather-low]').textContent = round(data.lowC);
      widget.querySelector('[data-weather-icon]').textContent = icon;
      condition.textContent = description;
      widget.querySelector('[data-weather-updated]').textContent = `Updated ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Jerusalem' }).format(new Date(data.observedAt))}`;
      widget.classList.remove('is-error');
      loadedAt = Date.now();
    } catch (error) {
      condition.textContent = error.message || 'Weather is temporarily unavailable.';
      retry.hidden = false;
      widget.classList.add('is-error');
    } finally {
      widget.classList.remove('is-loading');
      activeRequest = null;
    } })();
    return activeRequest;
  }

  toggle?.addEventListener('weather:open', () => {
    if (Date.now() - loadedAt >= 5 * 60 * 1000) loadWeather();
  });
  retry.addEventListener('click', loadWeather);
})();
