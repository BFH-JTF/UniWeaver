# Tool Architecture

UniWeaver is a tool with shared login, data model, and database but three distinctive
functionalities:

1. Curriculum administration
2. Preparation of semester scheduling (mapping editors, rooms, availability) and, in the
   future, generation of a semester schedule based on several restrictions and constraints
3. Create a competency mapping and competency scheduling

It uses a common backend (folder `backend`) and four single-page applications:
`user_entry` (login + portal), `administration`, `scheduling`, and `competencies`. The login
part handles the login with the OIDC provider. If the login has been successful it presents
the user links to the three tools. If any of the tools is opened without having logged in
first, the user is sent back to the login screen.

## Roles

Roles are flags on the local user account, evaluated by the backend:

| Flag | Meaning |
|---|---|
| `is_admin` | Global administrator: creates curricula, manages users and all entities |
| `is_user_admin` | Delegated user administration (cannot manage global admins or admin flags) |
| `is_scheduler` | Edits rooms, locations, availabilities and module/lecturer mappings |
| `is_not_lecturer` | Opt-out: every active user account is a lecturer by default |

## Curriculum entities and access control

Curriculum data (departments, programs, degrees, modules, classes, semesters, curricula and
curriculum versions) is served by one generic entity API on the backend. Every entity carries
a per-object access-control list with the roles read/write/admin; the creator of an entity
becomes its first admin. Entities are only visible to other users if they have been granted
access. Restrictions (see [restrictions.md](restrictions.md)) attach to these entities and are
inherited down the curriculum hierarchy.

## The tools

### user_entry

Login via OIDC (dynamic client registration against the configured provider), the tool portal,
and account-level actions: bootstrap elevation for the first administrator and the lecturer
opt-out toggle.

### administration

Curriculum administration: curricula with versions, departments, programs, degrees, modules,
classes and semesters — each as CRUD tables with form dialogs, per-entity access management
and typed restriction editors. Includes CSV import with schema auto-mapping (example files:
[departments.csv](departments.csv), [programs.csv](programs.csv), [degrees.csv](degrees.csv),
[modules.csv](modules.csv)) and the user management view (role flags, lecturer opt-out).

### scheduling

Preparing the semester schedule: lecturer↔module mapping (assignment list plus matrix view
with drag-range painting), rooms and locations (incl. a Leaflet map picker), room availability
windows, and lecturer unavailability (weekly recurring or individual dates). The actual
schedule generation from the documented restriction catalog is not implemented yet.

### competencies

Placeholder — competency mapping is planned but not implemented. The data model (competency
matrices, competencies, proofs of competency) is already part of the database schema.