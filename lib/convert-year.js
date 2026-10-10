const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const REFERENCE_FIELDS = ['info', 'desc']

// Recording flags whose default value is "0". Rows omit the flag when the
// value is the default, so readers should treat a missing flag as "0".
const DEFAULT_ZERO_FLAGS = ['failed_record', 'ts_in_ng', 'ts_out_ng', 'tsplus_in_ng', 'tsplus_out_ng']

function referenceId(value) {
	return crypto
		.createHash('sha256')
		.update(JSON.stringify(value))
		.digest('hex')
		.slice(0, 32)
}

function convertProgram(program, dictionaries) {
	const converted = {}

	for (const [key, value] of Object.entries(program)) {
		if (DEFAULT_ZERO_FLAGS.includes(key) && String(value) === '0') {
			continue
		}
		if (!REFERENCE_FIELDS.includes(key)) {
			converted[key] = value
			continue
		}

		const id = referenceId(value)
		const existing = dictionaries[key].get(id)
		if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(value)) {
			throw new Error(`Reference collision for ${key}:${id}`)
		}
		dictionaries[key].set(id, value)
		converted[`${key}_ref`] = id
	}

	return converted
}

function programsFromSchedule(schedule, source) {
	let programs = schedule?.radiko?.stations?.station?.progs?.prog
	if (programs === undefined) {
		throw new Error(`Missing program list in ${source}`)
	}
	if (!Array.isArray(programs)) programs = [programs]
	return programs
}

function comparePrograms(a, b) {
	return String(a['-ft'] ?? '').localeCompare(String(b['-ft'] ?? '')) ||
		String(a['-id'] ?? '').localeCompare(String(b['-id'] ?? ''))
}

function writeJson(file, value) {
	fs.mkdirSync(path.dirname(file), { recursive: true })
	fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function publishDirectory(staged, destination) {
	if (fs.existsSync(destination)) {
		throw new Error(`Destination already exists: ${destination}`)
	}
	fs.mkdirSync(path.dirname(destination), { recursive: true })
	fs.renameSync(staged, destination)
}

function writeDictionaries(root, dictionaries) {
	for (const field of REFERENCE_FIELDS) {
		const shards = new Map()
		for (const [id, value] of dictionaries[field]) {
			const shard = id.slice(0, 2)
			if (!shards.has(shard)) shards.set(shard, [])
			shards.get(shard).push([id, value])
		}

		for (const [shard, entries] of shards) {
			entries.sort(([a], [b]) => a.localeCompare(b))
			writeJson(path.join(root, field, `${shard}.json`), Object.fromEntries(entries))
		}
	}
}

function convertYear({ scheduleRoot, archiveRoot, contentRoot, year }) {
	const sourceYear = path.join(scheduleRoot, year)
	if (!fs.existsSync(sourceYear)) throw new Error(`Source year does not exist: ${sourceYear}`)

	const archiveYear = path.join(archiveRoot, year)
	const contentYear = path.join(contentRoot, year)
	if (fs.existsSync(archiveYear)) throw new Error(`Destination already exists: ${archiveYear}`)
	if (fs.existsSync(contentYear)) throw new Error(`Destination already exists: ${contentYear}`)

	const token = `${year}-${process.pid}-${Date.now()}`
	const stagedArchive = path.join(archiveRoot, `.convert-${token}`)
	const stagedContent = path.join(contentRoot, `.convert-${token}`)
	const dictionaries = { info: new Map(), desc: new Map() }
	let inputFiles = 0
	let outputFiles = 0
	let programs = 0

	try {
		const months = fs.readdirSync(sourceYear).sort()
		for (const month of months) {
			const monthDir = path.join(sourceYear, month)
			if (!fs.statSync(monthDir).isDirectory()) continue

			const stationFiles = new Map()
			for (const day of fs.readdirSync(monthDir).sort()) {
				const dayDir = path.join(monthDir, day)
				if (!fs.statSync(dayDir).isDirectory()) continue
				for (const name of fs.readdirSync(dayDir).filter(name => name.endsWith('.json')).sort()) {
					const station = path.basename(name, '.json')
					if (!stationFiles.has(station)) stationFiles.set(station, [])
					stationFiles.get(station).push(path.join(dayDir, name))
				}
			}

			for (const station of [...stationFiles.keys()].sort()) {
				const rows = []
				for (const file of stationFiles.get(station)) {
					const schedule = JSON.parse(fs.readFileSync(file, 'utf8'))
					for (const program of programsFromSchedule(schedule, file)) {
						rows.push(convertProgram(program, dictionaries))
						programs++
					}
					inputFiles++
				}
				rows.sort(comparePrograms)
				const destination = path.join(stagedArchive, month, `${station}.jsonl`)
				fs.mkdirSync(path.dirname(destination), { recursive: true })
				fs.writeFileSync(destination, rows.map(row => JSON.stringify(row)).join('\n') + '\n')
				outputFiles++
			}
		}

		writeDictionaries(stagedContent, dictionaries)
		publishDirectory(stagedContent, contentYear)
		publishDirectory(stagedArchive, archiveYear)
	} catch (error) {
		fs.rmSync(stagedArchive, { recursive: true, force: true })
		fs.rmSync(stagedContent, { recursive: true, force: true })
		throw error
	}

	return {
		inputFiles,
		outputFiles,
		programs,
		infoReferences: dictionaries.info.size,
		descReferences: dictionaries.desc.size,
	}
}

module.exports = { comparePrograms, convertProgram, convertYear, referenceId, DEFAULT_ZERO_FLAGS }
