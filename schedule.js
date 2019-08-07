if (process.argv.length < 3) {
	console.log('Usage: node schedule.js [mode] [params]');
	process.exit(-1)
}

const Promise = require('bluebird')
const fse = require('fs-extra')
const rp = require('request-promise')
const ObjTree = require('objtree')
const moment = require('moment')
process.env.TZ = 'Asia/Tokyo'
let objtree = new ObjTree()

let abs_mode = (process.argv[2] !== 'd')

let stime = moment()
if (!abs_mode) {
	stime = stime.add(parseInt(process.argv[3]), 'd')
}
stime = stime.toDate()
let i_m = `0${stime.getMonth() + 1}`.slice(-2)
let i_d = `0${stime.getDate()}`.slice(-2)
let i_y = stime.getFullYear()

let d_y = abs_mode ? process.argv[3] : i_y
let d_m = abs_mode ? process.argv[4] : i_m
let d_d = abs_mode ? process.argv[5] : i_d
let d_ymd = `${d_y}${d_m}${d_d}`

console.log(d_ymd)

Promise.map(Array.from(Array(47).keys()), i => fse.readJson(`./station/JP${i + 1}.json`))
.then(areas => areas.map(e => e.stations.station.map(s => s.id)))
.then(areas => areas.reduce((a, b) => new Set([...a, ...b]), []))
.then(sidSet => [...sidSet])
.then(sids => {
	return Promise.map(
		sids,
		sid => rp(`http://radiko.jp/v3/program/station/date/${d_ymd}/${sid}.xml`).then((schedule) => {
			return { sid: sid, schedule: objtree.parseXML(schedule) }
		}),
		{ concurrency: 10 }
	)
}).then(stations => stations.map((obj) => {
	return fse.outputJson(`./schedule/${d_y}/${d_m}/${d_d}/${obj.sid}.json`, obj.schedule)
}))
