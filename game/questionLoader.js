const fs = require('fs');
const path = require('path');

function loadQuestions(level) {
  level = level || 'n5';
  const filePath = path.join(__dirname, '..', 'data', 'kanji', `${level}.js`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data kanji untuk level ${level} tidak ditemukan.`);
  }
  
  const parsed = require(filePath);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${level}.js harus berisi array minimal 1 soal`);
  }

  parsed.forEach((q, i) => {
    if (!q.kanji || !q.answer || !Array.isArray(q.wrong) || q.wrong.length < 2) {
      throw new Error(
        `Soal #${i + 1} tidak valid: butuh { kanji, answer, wrong (min 2) }`
      );
    }
  });

  return parsed;
}

module.exports = { loadQuestions };
