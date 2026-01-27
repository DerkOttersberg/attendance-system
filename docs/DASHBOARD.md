# Dashboard Guide

The dashboard is served by Nginx from the backend release at:

- [product/Database & Dashbaord/releases/v1.5.2/My website/web](../product/Database%20%26%20Dashbaord/releases/v1.5.2/My%20website/web)

---

## Features

- Live stats (total users, clocked in/out today)
- Today’s attendance
- Full attendance with filters
- Manual attendance entry with signature capture
- User management (add/edit/delete)
- Department & product management
- PDF export (single or bulk)

![Dashboard Data Flow](diagrams/08-dashboard-data-flow/RFID%20Attendance%20API%20Pipeline-2026-01-27-194826.png)

---

## Key Files

- `dashboard.html`
- `js/config.js` (API base URL)
- `js/api.js` (API calls)
- `js/ui.js` (rendering)
- `js/filters.js` (filters + manual attendance)
- `js/export.js` (PDF export)

---

## Run Locally

From the backend release:

```bash
cd "product/Database & Dashbaord/releases/v1.5.2/My website"
docker-compose up -d
```

Then open: http://localhost:8080

---

**Last Updated**: January 27, 2026
