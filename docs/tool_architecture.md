UniWeaver is a tool with shared login, data model, and database but three distinctive functionalities:

1. Curriculum administration
2. Generation of a semester schedule based on several restrictions and constraints
3. Create a competency mapping and competency scheduling

It uses a common backend (see folder `backend`) and OIDC login part (see folder `user_entry`). The login part handles the logn with the OIDC provider. If the login has been successful it presents the user links to the three tools `administration`, `scheduling`, and `competencies`. If any of the tools is opened without having logged in first, the user is sent back to the login screen.
