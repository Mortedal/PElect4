# Cash Register POS

A simple web point-of-sale for a store with a cash register, built with Node.js, Express and MongoDB.

## Pages

- **`/`**: landing page with the store name and a **Log in** button.
- **`/login`**: pick your name and enter your PIN. On the very first run it asks you to create the **owner** account.
- **`/app`**: the register (and, for the owner, history, reports and settings).

## Who can do what

| | Cashier | Owner |
| --- | :-: | :-: |
| Open / close the register | ✓ | ✓ |
| Record sales (cash or online) | ✓ | ✓ |
| Cash in / cash out of the drawer | ✓ | ✓ |
| See starting cash, cash in drawer, number of transactions today | ✓ | ✓ |
| See today's sales list, totals, online payments | | ✓ |
| Cancel a sale entered by mistake | | ✓ |
| Refund a sale | | ✓ |
| Edit today's starting cash, reopen a closed register | | ✓ |
| History, reports, Excel export | | ✓ |
| Add people, change PINs, turn accounts off | | ✓ |

The server enforces these rules, so hiding a button is never the only protection.

## Recording a sale

1. **Type of sale**: *Clothing* or *Other sales* (e.g. tenants paying rent).
2. Items: name, price and quantity (several items per sale are allowed).
3. **Product photo**: required for Clothing, optional for Other sales.
4. **Payment**:
   - **Cash**: enter the cash received; the app shows the **change to give** (e.g. ₱1,000 − ₱890 = ₱110).
   - **Online payment** (GCash, Maya, bank transfer…): a **photo/screenshot of the payment is required**; a reference number is optional. Online payments do not count toward the cash in the drawer.

## The cash drawer

Cash that should be in the drawer =
starting cash + cash sales − cash refunds + cash in − cash out.

When closing, the cashier enters the cash they counted. The owner sees whether the drawer was balanced, over or short.

## Cancel vs refund (owner)

- **Cancel**: for a sale entered by mistake. Only today's sales, while the register is open. The sale stays in the records, crossed out, with the reason, and is not counted in the totals.
- **Refund**: money paid back to a customer for an earlier sale (any day), in cash or online, with a reason and a **required photo**. It is recorded on today's register, and partial refunds are allowed.

## Reports and Excel (owner)

- **Reports tab**: totals and a chart of Clothing vs Other sales by day, week or month, plus cash, online, refunds, cash in/out.
- **Excel**: download any **day** or **month**. The file has these sheets: *Daily summary*, *Sales*, *Refunds* and *Cash in-out*.

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
   cp .env.example .env      # paste your connection string into MONGODB_URI, set STORE_NAME
   npm install
   npm start
   ```

4. Open http://localhost:3000, click **Log in**, create the owner account, then add the cashier under **Settings**.

To use it on a phone on the same Wi-Fi, open `http://<your-computer-ip>:3000`.
Phone browsers only open the camera directly on `https://` or `localhost`. On plain `http://` the file picker still lets you take a photo.

If you forget the owner PIN and there is no other owner, open MongoDB Atlas, delete all documents in the `users` collection, and add the cashier again afterwards. When no users exist, the app asks you to create a new owner account. Sales data is not affected.

## Data (MongoDB collections)

- `users`: owner and cashier accounts (PINs are stored hashed).
- `sessions`: active logins (expire automatically).
- `days`: one per business day, with starting cash, counted cash, and who opened and closed it.
- `transactions`: sales, with type, payment method, items, totals, photos, cashier and cancel info.
- `refunds`: money paid back, with photo and reason.
- `cashmovements`: cash in and cash out.
- `photos`: product, payment-proof and refund photos.
