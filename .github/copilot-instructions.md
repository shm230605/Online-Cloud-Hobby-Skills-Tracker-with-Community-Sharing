# Workspace Guidance

- Keep the demo synthetic and runnable without cloud credentials.
- The browser dashboard currently uses localStorage; do not describe it as synchronized with the API unless that integration is implemented.
- Keep user-owned API reads and writes scoped to the authenticated owner.
- Treat uploads as private by default; validate size and content, and avoid exposing filesystem paths.
- Keep secrets, local databases, uploaded media, and virtual environments out of Git.
- Run `npm run lint`, `npm run build`, and `.venv/Scripts/python.exe -m pytest -q` before claiming the project is verified.
