let fse = require('fs-extra')
let rp = require('request-promise')
let ObjTree = require('objtree')
let objtree = new ObjTree()

Promise.all(Array.from(Array(47).keys()).map((_e, i) => {
	return rp(`https://radiko.jp/v3/station/list/JP${i + 1}.xml`);
})).then(res => res.map((r, i) => fse.writeJson(`station/JP${i + 1}.json`, objtree.parseXML(r), {spaces: 2})))
