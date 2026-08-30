function validateSchedule(schedule, stationId) {
	const station = schedule?.radiko?.stations?.station
	if (station?.['-id'] !== stationId || station?.progs?.prog === undefined) {
		throw new Error(`Invalid schedule for ${stationId}`)
	}
	return schedule
}

module.exports = validateSchedule
