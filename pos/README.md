# Cash Register POS

A simple web point-of-sale for a cash register, built with Node.js, Express and MongoDB.

## What it does

- **Open the register** each day with the starting cash (e.g. ₱2,000).
- **Record each sale**: the cashier types the product name, price and quantity (several products per sale are allowed), and how much cash the customer handed over.
  The app shows the **change to give** right away (e.g. ₱1,000 − ₱890 = **₱110**), with quick buttons for exact amount / ₱100 / ₱500 / ₱1,000 bills.
- **Photo proof is required** for every sale. On a phone or tablet the button opens the camera; on a computer it opens a file picker. Photos are shrunk in the browser and stored in MongoDB.
- **Live drawer total**: starting cash + sales = cash that should be in the drawer.
- **Close the register** at the end of the day by entering the cash you actually counted; the app shows whether you are balanced, over or short.
- **History** tab: every day with its summary and the list of transactions, with photos.

Money is stored as whole centavos, so there are no rounding errors.

## Setup

1. Install [Node.js](https://nodejs.org) 18 or newer.
2. Get a MongoDB database. The easiest is a free **MongoDB Atlas** cluster:
   - Sign up at https://www.mongodb.com/cloud/atlas and create a free (M0) cluster.
   - Under *Database Access*, create a database user and password.
   - Under *Network Access*, allow your IP address (or `0.0.0.0/0` while testing).
   - Click *Connect → Drivers* and copy the connection string.
3. Configure and run:

   ```bash
   cd pos
   cp .env.example .env      # then paste your connection string into MONGODB_URI
   npm install
   npm start
   ```

4. Open http://localhost:3000.

To use it on a phone in the same Wi-Fi, open `http://<your-computer-ip>:3000`.
Note: phone browsers only allow camera access on `https://` or `localhost`; the
file picker (which can still take a photo) works on plain `http://`.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/today` | Today's date and register summary (`day` is `null` if not opened) |
| POST | `/api/today/open` | `{ startingCash }` — open today's register |
| POST | `/api/today/close` | `{ countedCash, notes }` — close today's register |
| POST | `/api/transactions` | multipart: `items` (JSON `[{name, price, quantity}]`), `cashReceived`, `photo` |
| GET | `/api/transactions?date=YYYY-MM-DD` | Day summary + its transactions |
| GET | `/api/days` | Last 90 days with summaries |
| GET | `/api/photos/:id` | A sale's product photo |

## Data (MongoDB collections)

- `days` — one per business day: starting cash, counted cash at close, open/close time.
- `transactions` — one per sale: items, total, cash received, change, photo reference, sale number for the day.
- `photos` — the product photo images.
