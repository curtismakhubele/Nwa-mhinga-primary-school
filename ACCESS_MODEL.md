# Production Role & Access Model

## Roles
### Admin
Can create/deactivate users, assign role, assign grade/class, generate temporary passwords, reset passwords, manage all school data and backup configuration.

### Principal
School-wide academic/administrative visibility, reports, users overview and school settings as granted by the Admin.

### Vice Principal
Visibility limited to the grade range assigned by Admin, e.g. Grade 4–7.

### Teacher
Access limited to the exact Grade + Class assigned by Admin. Can manage learners, attendance, assessments and educational uploads within that scope.

### Parent
Access limited to the learner(s) linked to the account.

### Learner
Access limited to the learner's own profile, approved assessments, reports and learning resources.

## Recommended server-side tables
- schools
- users
- roles
- permissions
- user_role_assignments
- grade_levels
- classes
- teacher_class_assignments
- learners
- parent_learner_links
- subjects
- assessments
- attendance
- documents
- backup_jobs
- audit_logs
- password_reset_tokens
- sessions

## Password workflow
1. Admin creates user.
2. System generates a temporary password.
3. Password is displayed once to the Admin.
4. User signs in.
5. System forces password change on first login.
6. Password is stored only as a strong salted hash.
7. Admin reset generates a new temporary password.
8. Password reset tokens expire after a short period.

## Authorization
Never rely on hidden menu items for security. Every API request must verify:
- authenticated user
- active account
- role
- school
- assigned grade/class
- linked learner where applicable
