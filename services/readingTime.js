const WORDS_PER_MINUTE = 220;

function estimateReadingTimeMinutes(content) {
  const text = Array.isArray(content) ? content.join(' ') : String(content || '');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

module.exports = { estimateReadingTimeMinutes };
