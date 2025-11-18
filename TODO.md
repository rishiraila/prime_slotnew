<<<<<<< HEAD
# TODO: Replace Old Firebase Project with New One (prime-slot-35cd9)

- [x] Update .env with new client-side Firebase config variables (NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, etc.)
- [x] Update src/lib/firebaseAdmin.js with new project ID, client email, private key, database URL, and storage bucket
- [x] Verify changes by running the app and checking Firebase connections

# TODO: Build User Profile Update API with Photo Upload

- [x] Install formidable for multipart form parsing
- [x] Install @google-cloud/storage for Firebase Storage
- [x] Add storage export to firebaseAdmin.js
- [x] Create /api/profile/upload endpoint for photo uploads
- [x] Create tmp directory for file processing
- [x] Update .gitignore to ignore tmp files
- [x] Fix formidable compatibility issues with Next.js
- [x] Switch to native FormData API for file handling
- [x] Test the API endpoint
=======
# TODO: Add New Fields to Member Import

## Steps to Complete
- [x] Update RowSchema in `src/app/api/events/[id]/members/import/route.js` to include new optional fields: businessName, region, city, trafficLight, userProfile as strings.
- [x] Update HEADER_MAP in the same file to map common column header variations for the new fields (e.g., "Business Name" -> businessName, "Region" -> region, etc.).
- [x] In the profile object creation within the POST handler, extract and include the new fields from rawObj.
- [x] Verify that createMember and updateMember functions save the new fields to RTDB (no code changes needed, as they spread the profile object).
- [x] Test the import functionality with a sample Excel file containing the new columns.
- [x] Verify that imported members have the new fields in RTDB and are returned by `/api/me`.
>>>>>>> 8eed626a5b72cdbb6a1846eaf98f2148baf343f1
