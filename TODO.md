# TODO: Add New Fields to Member Import

## Steps to Complete
- [x] Update RowSchema in `src/app/api/events/[id]/members/import/route.js` to include new optional fields: businessName, region, city, trafficLight, userProfile as strings.
- [x] Update HEADER_MAP in the same file to map common column header variations for the new fields (e.g., "Business Name" -> businessName, "Region" -> region, etc.).
- [x] In the profile object creation within the POST handler, extract and include the new fields from rawObj.
- [x] Verify that createMember and updateMember functions save the new fields to RTDB (no code changes needed, as they spread the profile object).
- [x] Test the import functionality with a sample Excel file containing the new columns.
- [x] Verify that imported members have the new fields in RTDB and are returned by `/api/me`.
