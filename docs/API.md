# API Reference (Flask)

This file documents the API implemented in [product/Database & Dashbaord/releases/v1.5.2/My website/api/app.py](../product/Database%20%26%20Dashbaord/releases/v1.5.2/My%20website/api/app.py).

---

## Base URL

- Local: http://localhost:5000

---

## Health

**GET** `/health`

Returns service status.

---

## RFID Scan

**POST** `/api/scan`

Body:
```json
{
  "rfid_uid": "8144EE19"
}
```

Behavior:
- If user does not exist → returns 404.
- If user is not clocked in today → returns `action: "clock_in"`.
- If user is clocked in → clocks out immediately, updates work duration, and returns `action: "clock_out"`.

---

## Clock In With Signature

**POST** `/api/clock_in_with_signature`

Body:
```json
{
  "rfid_uid": "8144EE19",
  "signature": "<svg ...>...</svg>"
}
```

Stores a new attendance record with `status = clocked_in` and `signature_data`.

---

## Users

- **GET** `/api/users` → list users
- **POST** `/api/users` → create user
- **DELETE** `/api/users` → delete users by id list
- **PUT** `/api/users/{id}` → update user fields
- **PUT** `/api/users/{id}/uid` → update RFID UID
- **PUT** `/api/users/{id}/department` → update department
- **PUT** `/api/users/{id}/product` → update product

---

## Attendance

- **GET** `/api/attendance/today`
- **GET** `/api/attendance/all`
- **GET** `/api/attendance/filter?user_id=&department=&product=&start_date=&end_date=`
- **POST** `/api/attendance/manual`
- **POST** `/api/attendance/delete`

---

## Departments / Products

- **GET** `/api/departments`
- **POST** `/api/departments`
- **DELETE** `/api/departments/{id}`

- **GET** `/api/products`
- **POST** `/api/products`
- **DELETE** `/api/products/{id}`

---

## Points Integration (Target Website)

- **GET** `/api/user-points/{user_name}`
- **POST** `/api/update-points`

These endpoints proxy to the external points website and are used when clocking out.

---

**Last Updated**: January 27, 2026
