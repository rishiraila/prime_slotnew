# TODO: Fix Meeting Request and Calendar API Issues

## Step 1: Fix Meeting Request Endpoint Validation ✅
- Update `src/app/api/members/[id]/meetings/request/route.js`
- Add validation to ensure `aId` and `bId` are defined and valid before checking event membership
- Add a check: if (!data.aId || !bId) return error

## Step 2: Update Calendar Endpoint to Include Free Intervals ✅
- Update `src/app/api/members/[id]/calendar/route.js`
- Compute free intervals by finding gaps in busy periods within the from-to range
- Add logic to merge busy intervals and calculate free slots
- Update the response to include `free` array alongside `busy`

## Step 3: Test the Changes ✅
- Run the development server ✅ (running on http://localhost:3001)
- Test the POST /api/members/{memberRecipient}/meetings/request endpoint ✅ (validation added)
- Test the GET /api/members/{memberRecipient}/calendar endpoint ✅ (now returns free intervals)
- Verify that errors are resolved and free intervals are returned ✅
