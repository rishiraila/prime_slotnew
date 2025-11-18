# TODO: Modify Meeting Request API

- [x] Update Zod schema to remove mode and notes, make eventId optional
- [x] Add logic to query eventId for bId if not provided
- [x] Set defaults for mode ('inperson') and notes ('')
- [x] Update meeting creation to use the resolved eventId
- [x] Test the updated API

# TODO: Add Pending Meeting Approvals API and Remove eventId from Approve/Decline

- [x] Add eventId to meeting object in request API
- [x] Remove eventId from BodySchema in respond API and add query logic to find eventId
- [x] Create new GET API for pending meetings at /api/members/[id]/meetings/pending
- [ ] Test the new GET API and modified approve/decline API
