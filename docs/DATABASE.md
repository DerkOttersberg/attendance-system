# Database Schema (MySQL)

Schema defined in [product/Database & Dashbaord/releases/v1.5.2/My website/init.sql](../product/Database%20%26%20Dashbaord/releases/v1.5.2/My%20website/init.sql).

---

## Tables

### `users`
- `id` (PK)
- `rfid_uid` (unique)
- `name`, `email`, `department`, `product`
- `active` (boolean)
- `created_at`

### `attendance`
- `id` (PK)
- `user_id` (FK → users.id)
- `clock_in`, `clock_out`
- `work_duration` (minutes)
- `date`
- `status` (`clocked_in` | `clocked_out`)
- `signature_data` (SVG)

### `scan_log`
- `id` (PK)
- `rfid_uid`
- `scan_time`
- `action`
- `success`
- `message`

### `departments` (created at runtime)
- `id` (PK)
- `name`

### `products` (created at runtime)
- `id` (PK)
- `name`

---

## View

### `current_status`
Returns user + today’s attendance status with minutes worked.

---

## Indexes

- `users.rfid_uid`
- `attendance (user_id, date)`
- `attendance.date`
- `attendance.status`
- `scan_log (rfid_uid, scan_time)`

---

**Last Updated**: January 27, 2026
