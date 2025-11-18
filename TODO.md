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
