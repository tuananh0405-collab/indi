// Usage: node scripts/set-soldout.js EARLY_BIRD   (to sell out)
// Usage: node scripts/set-soldout.js EARLY_BIRD 0 (to reset)
const Database = require('better-sqlite3');
const db = new Database('./data/indi.db');

const name = process.argv[2] || 'EARLY_BIRD';
const soldOverride = process.argv[3];

if (soldOverride !== undefined) {
  db.prepare('UPDATE ticket_types SET sold = ? WHERE name = ?').run(Number(soldOverride), name);
} else {
  db.prepare('UPDATE ticket_types SET sold = capacity WHERE name = ?').run(name);
}

const row = db.prepare('SELECT name, label, sold, capacity FROM ticket_types WHERE name = ?').get(name);
console.log(row);
db.close();
