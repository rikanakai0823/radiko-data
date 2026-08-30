#!/usr/bin/env node

const path = require('node:path')
const { convertYear } = require('../lib/convert-year')

const year = process.argv[2]
if (!/^\d{4}$/.test(year ?? '')) {
	console.error('Usage: node scripts/convert-year.js YYYY')
	process.exit(1)
}

const root = path.resolve(__dirname, '..')
const result = convertYear({
	scheduleRoot: path.join(root, 'schedule'),
	archiveRoot: path.join(root, 'archive'),
	contentRoot: path.join(root, 'content'),
	year,
})

console.log(JSON.stringify(result, null, 2))
