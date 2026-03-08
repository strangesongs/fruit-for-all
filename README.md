# fruit for all

**fruit for all** is an open source, community-built map of street fruit you can actually pick — trees, bushes, and vines on public land where anyone can forage. Find it, pick it, share it.

Live at **[fruitforall.app](https://fruitforall.app)** &nbsp;·&nbsp; questions? **[admin@fruitforall.app](mailto:admin@fruitforall.app)**

---

## what it does

- Browse a live map of user-submitted fruit trees
- Sign up and add fruit near your current location
- Filter by fruit type
- Anyone (no account required) can browse the map

## stack

| Layer | Tech |
|---|---|
| Frontend | React (class components), React-Leaflet, esbuild |
| Backend | Node.js, Express 4 |
| Database | AWS DynamoDB |
| Auth | JWT 7-day, bcrypt |
| Email | Resend |
| Hosting | Railway |

## local setup

### prerequisites

- Node.js 18+
- AWS account with DynamoDB access
- (Optional) Resend API key for email features

### 1. clone and install

```sh
git clone https://github.com/strangesongs/fruit-for-all.git
cd fruit-for-all
npm install
```

### 2. environment

```sh
cp .env.example .env
```

Edit `.env`:

```
NODE_ENV=development
JWT_SECRET=        # generate: openssl rand -base64 32
AWS_REGION=us-west-2
DYNAMODB_TABLE=LoquatUsers
PINS_TABLE=LoquatPins
RESEND_API_KEY=    # optional — emails skipped if absent
APP_URL=http://localhost:3000
ADMIN_EMAIL=       # optional
```

### 3. AWS credentials

```sh
aws configure
```

Or set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env`.  
The IAM user needs DynamoDB read/write access on both tables.

### 4. DynamoDB tables

Create two tables in the AWS console:

| Table | Partition key |
|---|---|
| `LoquatUsers` | `userName` (String) |
| `LoquatPins` | `pinId` (String) |

### 5. run

```sh
npm run dev        # client (port 3000) + server (port 8080)
npm run build      # production build to dist/
```

## project structure

```
server.js
server/
  controllers/controllers.js
  schemas/schemas.js
client/
  index.js            # esbuild entry
  map.jsx
  sidebar.jsx
  splash.jsx
  utils/
    auth.js
    fruitList.js
    fruitSeasons.js
    clustering.js
    cache.js
  stylesheets/
```

## contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## license

GPL-3.0 — see [LICENSE](LICENSE). Forks must remain open source.
