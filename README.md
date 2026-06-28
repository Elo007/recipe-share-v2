# RecipeShare v2

A bigger, bolder version of RecipeShare: a recipe platform where creators
can sell premium recipes alongside free ones, using real Stripe Checkout
in test mode (no real money ever moves).

This is a separate project from the original RecipeShare, built from
scratch with a new visual direction and a much larger feature set.

## What's new vs the original

- **27 seeded recipes** across 9 categories and multiple cuisines (was 6)
- **Paid recipes**: creators set a price, buyers go through a real Stripe
  Checkout flow using test-mode fake cards, the recipe unlocks immediately
  after payment
- **Creator earnings dashboard**: a bar chart of revenue per recipe, total
  earned, sales count, and a full sales history table
- **Threaded comments**: separate from star ratings, supports replies
- **Nutrition info**: calories, protein, carbs, fat per recipe
- **Related recipes**: shown at the bottom of each recipe page
- **Richer filtering**: category, cuisine, ingredient, and a free/paid toggle
- **Bold redesign**: vivid warm color palette, category color-coding (each
  food category gets its own accent color throughout the app), bigger
  photography-led layout
- Collections (save recipes into named lists) exist on the backend, ready
  for a frontend page if you want to add one later

## Stack

- **Frontend**: React (Vite), React Router, Recharts (for the earnings chart)
- **Backend**: Node.js, Express, `node:sqlite` (built-in, no native deps)
- **Payments**: Stripe Checkout, test mode
- **Auth**: sessions with `express-session`, bcrypt password hashing

## Running it locally

Needs Node.js 22+.

**1. Backend**
```
cd server
npm install
node db/init.js
node index.js
```
Runs on `http://localhost:4000`.

**2. Frontend** (separate terminal)
```
cd client
npm install
npm run dev
```
Runs on `http://localhost:5173`.

## Setting up Stripe (test mode)

The app works without this, you just can't actually complete a purchase
("Unlock this recipe" will show a friendly error). To enable real test
checkout:

1. Create a free account at **stripe.com** (no business verification
   needed for test mode)
2. Go to **dashboard.stripe.com/test/apikeys**
3. Copy the **Secret key** (starts with `sk_test_`)
4. In `server/`, create a file called `.env` with:
   ```
   STRIPE_SECRET_KEY=sk_test_your_actual_key_here
   ```
5. Restart the backend (`node index.js`)

Now "Unlock this recipe" actually opens Stripe's real checkout page. Use
their official test card to pay without spending real money:

- **Card number**: `4242 4242 4242 4242`
- **Expiry**: any future date
- **CVC**: any 3 digits
- **ZIP**: any 5 digits

Stripe also has test cards that simulate a declined payment, an
insufficient-funds error, and so on, if you want to demo error handling too,
search "Stripe test cards" in their docs for the full list.

## Demo accounts

Password for all of them: `password123`

- `chefmaria` - posts mostly free everyday recipes
- `jakethebaker` - baking, mix of free and paid
- `sophiecooks` - pastry chef, several paid signature recipes
- `davidgrills` - BBQ pitmaster, paid long-format recipes

Or sign up fresh, that works too.

## Deploying it

### Recommended split: Vercel (frontend) + Render (backend)

This is genuinely a good combo for this stack. Vercel is built for
static/serverless frontends and deploys instantly with zero config; Render
keeps your Express backend running as a normal always-on Node process,
which Vercel's free tier doesn't really support for a stateful Express app
with sessions.

**Backend on Render:**
1. Push this repo to GitHub
2. Render → New → Web Service → root directory `server`
3. Build command: `npm install && node db/init.js`
4. Start command: `npm start`
5. Add environment variables: `STRIPE_SECRET_KEY`, `NODE_ENV=production`,
   `FRONTEND_URL` (you'll fill this in after step 2 below), and optionally
   `SESSION_SECRET`
6. Deploy, copy the resulting URL

**Frontend on Vercel:**
1. Go to **vercel.com**, sign up with GitHub
2. New Project → select this repo
3. Set the **root directory** to `client`
4. Vercel auto-detects Vite, build command and output directory should
   default correctly (`npm run build` and `dist`)
5. Add an environment variable: `VITE_API_URL` =
   `https://your-backend-name.onrender.com/api`
6. Deploy, copy the resulting URL

**Then go back to Render** and set `FRONTEND_URL` on the backend to your
new Vercel URL, then redeploy the backend so it picks up the change.

One nice side effect of this split: Vercel's static hosting doesn't spin
down the way Render's free web services do, so your frontend always loads
instantly. Only the backend has the "first request after idle takes 20-30
seconds to wake up" issue, same as before.

### If you'd rather keep everything on Render

That also works exactly like the original project, deploy both as
separate services on Render (Web Service for `server`, Static Site for
`client`). Slower cold starts on both sides, but one less platform to
manage.

## Project structure

```
server/
  db/
    init.js              # creates tables + seeds 27 demo recipes
    connection.js          # shared SQLite connection
  middleware/auth.js          # requireAuth guard
  routes/
    auth.js                    # signup, login, logout, /me
    recipes.js                   # browse, search, filter, CRUD, paywall gating, comments, related
    payments.js                    # Stripe checkout, purchase confirmation, sales/earnings
    favorites.js                     # add/remove/check/list favorites
    reviews.js                         # star ratings + review comments
    collections.js                       # named recipe collections (backend only, no UI yet)
    users.js                               # public profile + bio editing
  index.js                                  # wires it all together

client/
  src/
    api.js                 # every fetch call to the backend
    AuthContext.jsx           # global logged-in user state
    components/                  # Header, RecipeCard, Avatar, StarRating, StarInput, ProtectedRoute
    pages/                          # Home, Login, Signup, RecipeDetail, RecipeForm, Favorites, Profile, Dashboard
    index.css                         # design system: bold warm palette, category color-coding
```

## Notes for the writeup

- **Why Stripe test mode instead of a fake paywall**: it demonstrates the
  real architecture of a payment feature (checkout session creation,
  redirect flow, payment confirmation, idempotent purchase recording)
  without needing a registered business or handling real card data
  directly, raw card numbers never touch this server, Stripe's hosted
  checkout page handles that part entirely, which is also how you'd want
  it to work even in a real production app.
- **Why the unlock check happens server-side**: the API checks `is_paid`,
  ownership, and purchase records before ever sending back ingredients or
  steps, a locked recipe's detail response genuinely contains empty arrays,
  not just hidden-by-CSS content. Inspecting network traffic wouldn't leak
  the recipe.
- **Why category color-coding**: it's a structural device that encodes real
  information (what kind of dish this is) rather than decoration, useful
  when browsing a larger catalog than v1's.
