const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { convertYear } = require('../lib/convert-year')

function writeSchedule(root, day, programs) {
	const file = path.join(root, 'schedule', '2019', '01', day, 'TEST.json')
	fs.mkdirSync(path.dirname(file), { recursive: true })
	fs.writeFileSync(file, JSON.stringify({
		radiko: { stations: { station: { progs: { prog: programs } } } },
	}))
}

test('converts station days to referenced monthly JSONL', t => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'radiko-data-'))
	t.after(() => fs.rmSync(root, { recursive: true, force: true }))

	const programs = [
		{ '-id': '1', '-ft': '20190101050000', title: 'Earlier', info: 'shared', desc: 'first' },
		{ '-id': '2', '-ft': '20190101060000', title: 'Later', info: 'shared', desc: 'second' },
		{ '-id': '3', '-ft': '20190102050000', title: 'No description', info: 'shared' },
	]
	writeSchedule(root, '01', [programs[1], programs[0]])
	writeSchedule(root, '02', [programs[2]])

	const result = convertYear({
		scheduleRoot: path.join(root, 'schedule'),
		archiveRoot: path.join(root, 'archive'),
		contentRoot: path.join(root, 'content'),
		year: '2019',
	})

	assert.deepEqual(result, {
		inputFiles: 2,
		outputFiles: 1,
		programs: 3,
		infoReferences: 1,
		descReferences: 2,
	})

	const lines = fs.readFileSync(path.join(root, 'archive/2019/01/TEST.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
	assert.deepEqual(lines.map(row => row['-id']), ['1', '2', '3'])
	assert.equal(lines[0].info_ref, lines[1].info_ref)
	assert.equal(lines[1].info_ref, lines[2].info_ref)
	assert.equal('info' in lines[0], false)
	assert.equal('desc' in lines[0], false)
	assert.equal('desc_ref' in lines[2], false)

	const restored = lines.map(row => {
		const program = {}
		for (const [key, value] of Object.entries(row)) {
			if (!key.endsWith('_ref')) {
				program[key] = value
				continue
			}
			const field = key.slice(0, -4)
			const dictionary = JSON.parse(fs.readFileSync(path.join(root, `content/2019/${field}/${value.slice(0, 2)}.json`)))
			program[field] = dictionary[value]
		}
		return program
	})
	assert.deepEqual(restored, programs)
})
