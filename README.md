# CrowdmoniT – public version

Anyone can open a place's link or QR code, no account needed. Only people with the staff link can change counts.

## Run on your computer
    node server.js
Open http://localhost:3000 (needs Node 18 or newer; no installs).

## Put it online (Render.com, simple option)
1. Upload this folder to a GitHub repository.
2. On Render, choose New > Web Service and connect the repository.
3. Runtime: Node. Start command: `node server.js`.
4. Add a Disk (paid plan) mounted at `/data`, and set the environment variable `DATA_DIR=/data`.
   Without a disk, the free plan erases data when it restarts.
5. Open the address Render gives you (it already has HTTPS).

## How it works
- Create a place on the "For venues" tab. You get a visitor link, a QR code and a private staff link.
- Share the staff link only with gate staff or volunteers. Visitors can only read and send reports.
- Reports are limited to 6 per minute per device. Creating places is limited to 10 per hour per device.

## Before a very large launch
- Move the data from the JSON file to a managed database (Postgres).
- Add a staff login if you need per-person accounts.
- Add languages, and SMS alerts for people without smartphones.
