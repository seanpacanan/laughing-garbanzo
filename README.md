# Camera Equipment Room Inventory Management System

A modern web-based inventory system for school camera equipment rooms.

## Features

- Role-based login (Admin / Staff)
- Camera unit management (add, edit, archive)
- Unique barcode per camera
- Borrow and return workflows with automatic timestamps
- Status tracking: Available, Borrowed, Overdue, Under Maintenance
- Overdue alerts and dashboard summaries
- Borrowing history per borrower ID
- Downloadable reports in Excel and PDF
- Prevention of double borrowing of the same camera

## Run locally

Open `index.html` directly in a browser, or serve via a static server:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Demo accounts

- `admin` / `admin123`
- `staff` / `staff123`
