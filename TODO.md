# TODO: Modify Meetings Page to Use Event-Specific API and Add Event Selector

## Steps to Complete
- [x] Add state for events list and selectedEventId in src/app/Meetings/page.js
- [x] Fetch events from /api/events on component mount
- [x] Add event selector dropdown in the header, replacing the "Schedule a Meeting" button
- [x] Update fetchMeetings function to use /api/events/${selectedEventId}/meetings when an event is selected
- [x] Ensure member details are still fetched for attendee names
- [x] Test the page: select an event, verify meetings load with member names (started dev server at http://localhost:3001)
- [x] Update this TODO.md to reflect completion
