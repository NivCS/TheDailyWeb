const { getTelAvivWeather } = require('../services/weather');

async function current(req, res, next) {
  try {
    const weather = await getTelAvivWeather();
    res.set('Cache-Control', 'no-store');
    res.json(weather);
  } catch (error) {
    next(error);
  }
}

module.exports = { current };
