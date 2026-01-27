# Backend Setup (Flask + MySQL)

This guide describes the backend in:

- [product/Database & Dashbaord/releases/v1.5.2/My website](../product/Database%20%26%20Dashbaord/releases/v1.5.2/My%20website)

---

## Overview

The backend stack uses Docker Compose:

- **MySQL 8** database
- **Flask API** (`api/app.py`)
- **Nginx** serving the static dashboard

---

## Quick Start (Docker)

```bash
cd "product/Database & Dashbaord/releases/v1.5.2/My website"
docker-compose up -d
```

Services:
- API → http://localhost:5000
- Dashboard → http://localhost:8080
- MySQL → port 3306

Health check:

```bash
curl http://localhost:5000/health
```

---

## Configuration

Docker Compose sets these variables for the API:

- `DB_HOST=mysql`
- `DB_USER=rfid_user`
- `DB_PASSWORD=rfid_pass`
- `DB_NAME=rfid_attendance`

The database schema is loaded from `init.sql` on container start.

---

## Local Development (No Docker)

1) Start MySQL and load schema:

```bash
mysql -u root -p < init.sql
```

2) Run the API:

```bash
cd api
pip install -r requirements.txt
python app.py
```

---

## API Reference

See [API.md](API.md) for all endpoints.

---

## Database

See [DATABASE.md](DATABASE.md) for schema details.

---

**Last Updated**: January 27, 2026