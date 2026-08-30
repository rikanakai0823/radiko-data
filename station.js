const fs = require('node:fs/promises')
const ObjTree = require('objtree')

const objtree = new ObjTree()

async function fetchText(url) {
	const response = await fetch(url)
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
	return response.text()
}

async function main() {
	const responses = await Promise.all(Array.from({ length: 47 }, (_e, i) => {
		return fetchText(`https://radiko.jp/v3/station/list/JP${i + 1}.xml`)
	}))
	await Promise.all(responses.map((xml, i) => {
		return fs.writeFile(`station/JP${i + 1}.json`, JSON.stringify(objtree.parseXML(xml), null, 2))
	}))
}

main().catch(error => {
	console.error(error)
	process.exitCode = 1
})
