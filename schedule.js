const Promise = require('bluebird')
const fse = require('fs-extra')
const rp = require('request-promise')
const ObjTree = require('objtree')
process.env.TZ = 'Asia/Tokyo'
let objtree = new ObjTree()

let stime = new Date()
let i_m = `0${stime.getMonth() + 1}`.slice(-2)
let i_d = `0${stime.getDate()}`.slice(-2)
let i_y = stime.getFullYear()

let d_y = process.argv[2] || i_y
let d_m = process.argv[3] || i_m
let d_d = process.argv[4] || i_d
let d_ymd = `${d_y}${d_m}${d_d}`

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
