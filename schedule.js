if (process.argv.length < 3) {
	console.log('Usage: node schedule.js [mode] [params]')
	process.exit(-1)
}

const fs = require('node:fs/promises')
const path = require('node:path')
const ObjTree = require('objtree')

process.env.TZ = 'Asia/Tokyo'
const objtree = new ObjTree()

const absMode = process.argv[2] !== 'd'
const stime = new Date()
if (!absMode) stime.setDate(stime.getDate() + parseInt(process.argv[3]))

const iM = `0${stime.getMonth() + 1}`.slice(-2)
const iD = `0${stime.getDate()}`.slice(-2)
const iY = stime.getFullYear()

const dY = absMode ? process.argv[3] : iY
const dM = absMode ? process.argv[4] : iM
const dD = absMode ? process.argv[5] : iD
const dYmd = `${dY}${dM}${dD}`

console.log(dYmd)

const sidToPath = sid => `./schedule/${dY}/${dM}/${dD}/${sid}.json`

const prepareCompare = schedule => {
	const s = JSON.parse(JSON.stringify(schedule))
	if (s && s.radiko) {
		if (s.radiko.srvtime) delete s.radiko.srvtime
		if (
			s.radiko.stations &&
			s.radiko.stations.station &&
			s.radiko.stations.station.progs &&
			Array.isArray(s.radiko.stations.station.progs.prog)
		) {
			const prog = s.radiko.stations.station.progs.prog
			for (let i = 0; i < prog.length; i++) {
				if (typeof prog[i]['-id'] !== 'undefined') delete prog[i]['-id']
			}
		}
	}
	return JSON.stringify(s)
}

async function mapLimit(items, concurrency, mapper) {
	const results = new Array(items.length)
	let next = 0

	async function worker() {
		while (next < items.length) {
			const index = next++
			results[index] = await mapper(items[index], index)
		}
	}

	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
	return results
}

async function readJson(file) {
	return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function readOldSchedule(sid) {
	try {
		return { sid, oldSchedule: await readJson(sidToPath(sid)) }
	} catch (error) {
		if (error.code === 'ENOENT') return { sid, oldSchedule: false }
		throw error
	}
}

async function fetchText(url) {
	const response = await fetch(url)
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
	return response.text()
}

async function writeJson(file, value) {
	await fs.mkdir(path.dirname(file), { recursive: true })
	await fs.writeFile(file, JSON.stringify(value, null, 2))
}

async function main() {
	const areas = await Promise.all(Array.from({ length: 47 }, (_e, i) => readJson(`./station/JP${i + 1}.json`)))
	const sidSet = areas
		.map(area => area.stations.station.map(station => station.id))
		.reduce((a, b) => new Set([...a, ...b]), [])
	const stations = await mapLimit([...sidSet], 100, readOldSchedule)
	const schedules = await mapLimit(stations, 10, async ({ sid, oldSchedule }) => {
		try {
			const xml = await fetchText(`https://radiko.jp/v3/program/station/date/${dYmd}/${sid}.xml`)
			return { sid, oldSchedule, schedule: objtree.parseXML(xml) }
		} catch (error) {
			console.error(sid, 'unavailable')
		}
	})

	await Promise.all(schedules.filter(Boolean).map(({ sid, oldSchedule, schedule }) => {
		if (oldSchedule && prepareCompare(oldSchedule) === prepareCompare(schedule)) return undefined
		return writeJson(sidToPath(sid), schedule)
	}))
}

main().catch(error => {
	console.error(error)
	process.exitCode = 1
})
