const db = require('../db');

function stripDiacritics(str) {
  return str
    .split('')
    .filter((ch) => {
      const code = ch.codePointAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join('');
}

function normalizeCounterparty(s) {
  return stripDiacritics((s || '').toUpperCase().normalize('NFKD'))
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function matchesRule(rule, tx) {
  const haystacks = [];
  if (rule.match_field === 'counterparty' || rule.match_field === 'both') {
    haystacks.push(tx.counterparty || '');
  }
  if (rule.match_field === 'purpose' || rule.match_field === 'both') {
    haystacks.push(tx.purpose || '');
  }

  return haystacks.some((value) => {
    if (rule.match_type === 'regex') {
      try {
        return new RegExp(rule.pattern, 'i').test(value);
      } catch {
        return false;
      }
    }
    if (rule.match_type === 'exact') {
      return value.toLowerCase() === rule.pattern.toLowerCase();
    }
    return value.toLowerCase().includes(rule.pattern.toLowerCase());
  });
}

function categorize(tx) {
  const rules = db
    .prepare('SELECT * FROM rules WHERE enabled = 1 ORDER BY priority ASC, id ASC')
    .all();

  for (const rule of rules) {
    if (matchesRule(rule, tx)) {
      return { category_id: rule.category_id, category_src: 'rule' };
    }
  }

  const normKey = normalizeCounterparty(tx.counterparty);
  if (normKey) {
    const learned = db
      .prepare('SELECT category_id FROM learned_map WHERE norm_key = ?')
      .get(normKey);
    if (learned) {
      return { category_id: learned.category_id, category_src: 'learned' };
    }
  }

  return { category_id: null, category_src: null };
}

function learn(counterparty, categoryId) {
  const normKey = normalizeCounterparty(counterparty);
  if (!normKey) return;
  db.prepare(
    `INSERT INTO learned_map (norm_key, category_id, hits)
     VALUES (?, ?, 1)
     ON CONFLICT(norm_key) DO UPDATE SET category_id = excluded.category_id, hits = hits + 1`
  ).run(normKey, categoryId);
}

module.exports = { categorize, learn, normalizeCounterparty };
