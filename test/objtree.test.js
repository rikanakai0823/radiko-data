const assert = require('node:assert/strict')
const test = require('node:test')

const ObjTree = require('objtree')

test('preserves the expected XML object shape', () => {
	const xml = `
		<root id="1" empty="">
			<single>one</single>
			<repeat>first</repeat>
			<repeat>second</repeat>
			<with-attribute kind="text">value</with-attribute>
			<cdata><![CDATA[raw <text>]]></cdata>
			<empty />
		</root>
	`

	assert.deepEqual(new ObjTree().parseXML(xml), {
		root: {
			'-id': '1',
			single: 'one',
			repeat: ['first', 'second'],
			'with-attribute': {
				'-kind': 'text',
				'#text': 'value',
			},
			cdata: 'raw <text>',
		},
	})
})
