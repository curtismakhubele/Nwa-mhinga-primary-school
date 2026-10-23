# N'WA MHINGA P — Advanced School Data Management System

This version advances the supplied visual reference into a working responsive prototype.

## Major features
- N'WA MHINGA P inspired navy/red school dashboard look and feel
- Separate role platforms:
  - System Admin
  - Principal
  - Vice Principal
  - Teacher (Grade R–7)
  - Parent
  - Learner
- Role-based navigation and access scope
- Teacher restricted to assigned Grade + Class
- Vice Principal restricted to assigned grade range
- Parent/Learner restricted to linked learner
- Admin user management
- Admin assigns role, grade, class and status
- Admin generates temporary passwords
- Users can change their own passwords
- Learner records
- Assessments
- Upload educational data
- Cloud backup dashboard
- Reports
- Responsive mobile layout

## Demo credentials
Admin:
admin@nwamhingap.co.za
Admin@123

Principal:
principal@nwamhingap.co.za
Principal@123

Vice Principal:
vp@nwamhingap.co.za
Vice@123

Teacher:
teacher3@nwamhingap.co.za
Teacher@123

Parent:
parent@nwamhingap.co.za
Parent@123

Learner:
learner@nwamhingap.co.za
Learner@123

## Run in Visual Studio Code
1. Extract the ZIP.
2. Open the project folder in VS Code.
3. Install/use Live Server.
4. Open index.html with Live Server.

## Important production note
This is a front-end prototype. Credentials and data are stored in browser localStorage so the role and access flows can be demonstrated without a server. Do not use real learner information in this version.

For deployment, replace localStorage authentication with a secure server/database:
- PostgreSQL
- Node.js/Express or equivalent API
- Argon2/bcrypt password hashing
- Secure session/token management
- MFA/2FA for privileged accounts
- Cloud object storage for documents
- Encrypted automated backups
- Audit logging
- Server-side authorization on every request
- POPIA-aligned privacy and retention controls

The production system should never send passwords back to the browser in plaintext and should not rely on client-side permissions alone.


## Official logo
The interface now uses the exact N'WA MHINGA P crest/logo extracted from the supplied reference image. It is stored at `assets/nwa-mhinga-p-logo.png` and is used on the login screen and sidebar.
