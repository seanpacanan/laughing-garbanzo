# Camera Equipment Room Inventory Management System

A modern web-based inventory and borrowing tracker for school camera equipment rooms.

## Features

- Role-based login (`Admin` and `Staff`)
- Dashboard with live counters for available, borrowed, and overdue cameras
- Add, edit, and archive camera units (admin only)
- Unique barcode/ID per camera
- Borrow and return transaction forms with automatic timestamps
- Borrowing details include:
  - Full borrower name
  - Student/employee ID
  - Department/section
  - Camera unit
  - Date/time borrowed
  - Expected return date/time
  - Actual return date/time
  - Approved by
- Camera statuses: `Available`, `Borrowed`, `Overdue`, and `Under Maintenance`
- Overdue alert banner on dashboard
- Borrowing history lookup per borrower ID
- Downloadable reports:
  - Excel-compatible CSV export
  - Printable PDF report (browser print dialog)
- Double-borrow prevention for the same camera

## Demo Credentials

- `admin / admin123`
- `staff / staff123`

## Run Locally

Open `index.html` in a browser, or serve the directory with a static server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.
