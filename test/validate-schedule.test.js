const test = require('node:test')
const assert = require('node:assert/strict')
const validateSchedule = require('../lib/validate-schedule')

test('accepts only a matching station with programs', () => {
	const schedule = { radiko: { stations: { station: {
		'-id': 'TBS',
		progs: { prog: [] },
	} } } }

	assert.equal(validateSchedule(schedule, 'TBS'), schedule)
	for (const invalid of [
		{},
		{ radiko: { stations: { station: { '-id': 'QRR', progs: { prog: [] } } } } },
		{ radiko: { stations: { station: { '-id': 'TBS', progs: {} } } } },
	]) {
		assert.throws(() => validateSchedule(invalid, 'TBS'), /Invalid schedule for TBS/)
	}
})
