# TODO: Fix Calendar Slot Availability

## Approved Plan
- Modify the POST function in `src/app/api/members/availability/route.js` to return calendar events instead of busy intervals.
- For each meeting involving aid or bid, create an event object with start/end, title (e.g., "Meeting with [other member's name]"), and other FullCalendar props.
- Fetch member names from `/members/{id}` to include in titles.
- Return { events: [event1, event2, ...] } instead of { busy: [...] }.
- Update any frontend code that uses this API to handle events instead of busy intervals.

## Steps to Complete
- [x] Modify `src/app/api/members/availability/route.js` to return events array.
- [x] Add logic to fetch member names for event titles.
- [x] Format meetings as FullCalendar event objects.
- [ ] Test the API with POST request including aid and bid.
- [ ] Verify events are returned for their meetings.
- [ ] Integrate with calendar JS to fetch and display these events.
