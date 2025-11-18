# TODO: Implement API for Member Schedule Meetings

## Approved Plan
- Create a new route file: `src/app/api/meetings/route.js`
- Implement GET function using `requireUser` for auth (member mode only).
- Extract memberId from JWT token (`user.uid`).
- Query `/memberMeetings/${memberId}` to get all eventIds and meetingIds for the member.
- For each meeting, fetch full data from `/meetings/${eventId}/${meetingId}`.
- Return the list of all meetings for the member across all events.
- Ensure CORS and error handling.

## Steps to Complete
- [x] Create `src/app/api/meetings/route.js` with basic structure (imports, runtime, etc.).
- [x] Add `requireUser` function (copied from existing routes like `src/app/api/members/meetings/pending/route.js`).
- [x] Implement GET function: authenticate user, extract memberId, query memberMeetings, fetch full meetings, return JSON response.
- [x] Add CORS headers and OPTIONS handler.
- [x] Start the development server to test the endpoint.
- [ ] Test the endpoint with a member JWT token to verify it returns meetings across events.
- [ ] Verify no admin access or other modes are allowed.
- [ ] Check for any integration issues with existing code.
