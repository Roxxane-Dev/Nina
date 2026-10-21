// Extracts the SQL script of section 4 of docs/PROD-MIGRATION-RUNBOOK.md into ./runbook-script.sql
// so it can be rehearsed on a LOCAL database. It only reads the runbook and writes one file.
//   node scripts/extract-runbook-sql.js
const fs = require('fs')

const fence = '`'.repeat(3)
const text = fs.readFileSync('docs/PROD-MIGRATION-RUNBOOK.md', 'utf8').replace(/\r\n/g, '\n')
const start = text.indexOf(fence + 'sql\nbegin;')
if (start < 0) throw new Error('script block not found in the runbook')
const bodyStart = start + (fence + 'sql\n').length
const end = text.indexOf('\n' + fence, bodyStart)
if (end < 0) throw new Error('end of the script block not found')
fs.writeFileSync('runbook-script.sql', text.slice(bodyStart, end) + '\n')
console.log('wrote runbook-script.sql (' + text.slice(bodyStart, end).split('\n').length + ' lines). Do not commit it.')
