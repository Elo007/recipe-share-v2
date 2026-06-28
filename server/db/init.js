// Sets up the SQLite database for RecipeShare v2 and seeds a much bigger
// catalog of recipes, including a mix of free and paid ones.
// Sets up the SQLite database for RecipeShare v2 and seeds a much bigger
// catalog of recipes, including a mix of free and paid ones.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'recipeshare.db');

// Setting RESET_DB=true wipes the existing database before seeding, useful
// the first time you add real API keys (Pexels, Stripe) and want the seed
// data regenerated with them. Leave this unset on normal deploys, it
// otherwise wipes real signups, posted recipes, and purchases every time.
if (process.env.RESET_DB === 'true' && fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('RESET_DB is set, deleted existing database.');
}

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    bio TEXT DEFAULT '',
    avatar_color TEXT DEFAULT '#E8590C',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL,
    cuisine TEXT DEFAULT '',
    cook_time_minutes INTEGER NOT NULL,
    servings INTEGER DEFAULT 4,
    difficulty TEXT DEFAULT 'Easy',
    image_url TEXT DEFAULT '',
    is_paid INTEGER DEFAULT 0,
    price_cents INTEGER DEFAULT 0,
    calories INTEGER,
    protein_g INTEGER,
    carbs_g INTEGER,
    fat_g INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    amount TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recipe_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    UNIQUE(user_id, recipe_id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recipe_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    UNIQUE(user_id, recipe_id)
  );

  -- Threaded discussion comments, separate from star reviews. parent_id
  -- being NULL means a top-level comment, otherwise it's a reply.
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_id INTEGER,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
  );

  -- One row per successful purchase. Stripe session id stored for
  -- reference/idempotency so a webhook firing twice doesn't double count.
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recipe_id INTEGER NOT NULL,
    stripe_session_id TEXT UNIQUE NOT NULL,
    amount_cents INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    UNIQUE(user_id, recipe_id)
  );

  -- A user-created collection of recipes, e.g. "Weeknight dinners".
  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS collection_recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    recipe_id INTEGER NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    UNIQUE(collection_id, recipe_id)
  );
`);

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

if (userCount === 0) {
  console.log('Seeding demo data...');

  const insertUser = db.prepare(
    'INSERT INTO users (username, email, password_hash, bio, avatar_color) VALUES (?, ?, ?, ?, ?)'
  );
  const hash = bcrypt.hashSync('password123', 10);

  const users = [
    insertUser.run('chefmaria', 'maria@example.com', hash, 'Home cook, obsessed with one-pot meals.', '#E8590C'),
    insertUser.run('jakethebaker', 'jake@example.com', hash, 'Baking is my therapy.', '#2F9E44'),
    insertUser.run('sophiecooks', 'sophie@example.com', hash, 'Pastry chef sharing my restaurant secrets.', '#C2255C'),
    insertUser.run('davidgrills', 'david@example.com', hash, 'BBQ pitmaster, 15 years in.', '#1971C2'),
  ];
  const [maria, jake, sophie, david] = users.map((r) => r.lastInsertRowid);

  const insertRecipe = db.prepare(`
    INSERT INTO recipes (
      user_id, title, description, category, cuisine, cook_time_minutes, servings,
      difficulty, image_url, is_paid, price_cents, calories, protein_g, carbs_g, fat_g
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertIngredient = db.prepare(
    'INSERT INTO ingredients (recipe_id, name, amount, sort_order) VALUES (?, ?, ?, ?)'
  );
  const insertStep = db.prepare('INSERT INTO steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)');

  // Unsplash hotlinking by photo ID is not reliable long-term, individual
  // photos can be removed by their owner, which breaks the link forever.
  // Picsum's seed-based URLs are designed for exactly this use case: the
  // same seed always returns the same image, indefinitely, no API key,
  // no expiry. Each recipe's title is used as its seed so the placeholder
  // is at least consistent and unique per recipe.
  function placeholderImage(seed) {
    const cleanSeed = seed.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `https://picsum.photos/seed/${cleanSeed}/800/800`;
  }

  const recipesData = [
    {
      userId: maria, title: 'One-Pot Creamy Garlic Pasta',
      description: 'Weeknight dinner that takes 20 minutes and one pot to clean.',
      category: 'Dinner', cuisine: 'Italian', cookTime: 20, servings: 4, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 540, protein: 16, carbs: 62, fat: 24,
      ingredients: [['Spaghetti', '400g'], ['Garlic cloves, minced', '4'], ['Heavy cream', '200ml'], ['Parmesan, grated', '50g'], ['Vegetable stock', '600ml'], ['Olive oil', '2 tbsp'], ['Salt', 'to taste'], ['Black pepper', 'to taste']],
      steps: ['Heat olive oil in a large pot over medium heat and saute garlic until fragrant.', 'Add the stock and bring to a boil, then add the dry pasta directly into the pot.', 'Cook, stirring occasionally, until pasta is tender and most liquid is absorbed.', 'Stir in cream and parmesan, season with salt and pepper, and serve hot.'],
    },
    {
      userId: maria, title: 'Chicken and Rice Skillet',
      description: 'Comfort food classic, all in one skillet.',
      category: 'Dinner', cuisine: 'American', cookTime: 35, servings: 4, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 480, protein: 32, carbs: 48, fat: 14,
      ingredients: [['Chicken thighs', '4'], ['Rice', '1.5 cups'], ['Chicken broth', '3 cups'], ['Onion, diced', '1'], ['Garlic cloves', '3'], ['Paprika', '1 tsp'], ['Olive oil', '2 tbsp']],
      steps: ['Season chicken with paprika, salt and pepper, then sear in olive oil until golden. Remove and set aside.', 'In the same skillet, saute onion and garlic until soft.', 'Add rice and broth, stir, then place chicken back on top.', 'Cover and simmer on low for 20 minutes until rice is cooked and chicken is done.'],
    },
    {
      userId: maria, title: 'Fresh Garden Salad with Lemon Vinaigrette',
      description: 'Light, crisp, and ready in 10 minutes.',
      category: 'Salad', cuisine: 'Mediterranean', cookTime: 10, servings: 2, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 220, protein: 4, carbs: 12, fat: 18,
      ingredients: [['Mixed greens', '150g'], ['Cherry tomatoes', '1 cup'], ['Cucumber', '1'], ['Red onion, thinly sliced', '1/4'], ['Olive oil', '3 tbsp'], ['Lemon juice', '2 tbsp'], ['Salt', 'to taste']],
      steps: ['Wash and chop the greens, tomatoes, cucumber and onion, then combine in a large bowl.', 'Whisk olive oil, lemon juice and salt together in a small bowl.', 'Pour the dressing over the salad just before serving and toss well.'],
    },
    {
      userId: maria, title: 'Slow-Braised Short Ribs',
      description: 'Fall-off-the-bone tender, my most requested recipe ever, finally written down properly.',
      category: 'Dinner', cuisine: 'American', cookTime: 240, servings: 4, difficulty: 'Hard',
      isPaid: true, price: 399, calories: 620, protein: 44, carbs: 18, fat: 38,
      ingredients: [['Beef short ribs', '1.5kg'], ['Red wine', '500ml'], ['Beef stock', '500ml'], ['Carrots', '3'], ['Celery stalks', '2'], ['Onion', '1'], ['Garlic cloves', '6'], ['Tomato paste', '2 tbsp'], ['Fresh thyme', '4 sprigs'], ['Bay leaves', '2']],
      steps: ['Sear the short ribs on all sides in a hot Dutch oven until deeply browned, then remove.', 'Saute the carrots, celery, onion and garlic until softened, then stir in tomato paste.', 'Deglaze with red wine, scraping up the browned bits, then add stock, thyme, and bay leaves.', 'Return the ribs to the pot, cover, and braise at 150C for 3.5 to 4 hours until the meat pulls apart easily.', 'Strain and reduce the braising liquid into a glossy sauce, then serve over the ribs.'],
    },
    {
      userId: jake, title: 'Classic Chocolate Chip Cookies',
      description: 'Crispy edges, chewy centers, the only recipe you need.',
      category: 'Dessert', cuisine: 'American', cookTime: 25, servings: 24, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 180, protein: 2, carbs: 24, fat: 9,
      ingredients: [['Butter, softened', '225g'], ['Brown sugar', '200g'], ['White sugar', '100g'], ['Eggs', '2'], ['Vanilla extract', '1 tsp'], ['Flour', '375g'], ['Baking soda', '1 tsp'], ['Chocolate chips', '300g'], ['Salt', '1/2 tsp']],
      steps: ['Preheat oven to 190C and line baking trays with parchment paper.', 'Cream butter and both sugars together until light and fluffy.', 'Beat in eggs and vanilla, then mix in flour, baking soda and salt until just combined.', 'Fold in chocolate chips, scoop onto trays, and bake for 10-12 minutes until edges are golden.'],
    },
    {
      userId: jake, title: 'Fluffy Buttermilk Pancakes',
      description: 'Weekend breakfast that actually feels like a treat.',
      category: 'Breakfast', cuisine: 'American', cookTime: 20, servings: 4, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 310, protein: 8, carbs: 42, fat: 11,
      ingredients: [['Flour', '250g'], ['Baking powder', '2 tsp'], ['Sugar', '2 tbsp'], ['Buttermilk', '400ml'], ['Eggs', '2'], ['Butter, melted', '40g'], ['Salt', 'pinch']],
      steps: ['Whisk together flour, baking powder, sugar and salt in a bowl.', 'In a separate bowl, whisk buttermilk, eggs and melted butter.', 'Combine wet and dry ingredients, stirring just until no large lumps remain.', 'Cook spoonfuls of batter on a hot, lightly greased pan until bubbles form, then flip and cook through.'],
    },
    {
      userId: jake, title: 'Browned Butter Banana Bread',
      description: 'The browned butter is non-negotiable, it changes everything.',
      category: 'Breakfast', cuisine: 'American', cookTime: 65, servings: 8, difficulty: 'Medium',
      isPaid: false, price: 0, calories: 290, protein: 4, carbs: 38, fat: 13,
      ingredients: [['Ripe bananas', '4'], ['Butter', '115g'], ['Brown sugar', '150g'], ['Eggs', '2'], ['Flour', '250g'], ['Baking soda', '1 tsp'], ['Vanilla extract', '1 tsp'], ['Salt', 'pinch']],
      steps: ['Brown the butter in a saucepan until it smells nutty and turns golden, then cool slightly.', 'Mash the bananas and mix with the browned butter, sugar, eggs, and vanilla.', 'Fold in the flour, baking soda, and salt until just combined.', 'Pour into a greased loaf pan and bake at 175C for 50-55 minutes until a skewer comes out clean.'],
    },
    {
      userId: jake, title: 'Croissants From Scratch',
      description: 'My full lamination technique, the one bakeries don\'t teach. Takes a weekend but worth every fold.',
      category: 'Breakfast', cuisine: 'French', cookTime: 720, servings: 8, difficulty: 'Hard',
      isPaid: true, price: 599, calories: 280, protein: 6, carbs: 28, fat: 16,
      ingredients: [['Bread flour', '500g'], ['Butter (for dough)', '40g'], ['Butter (for lamination)', '300g'], ['Milk', '150ml'], ['Water', '150ml'], ['Sugar', '55g'], ['Salt', '10g'], ['Yeast', '11g'], ['Egg (for wash)', '1']],
      steps: ['Make the dough and let it rest in the fridge overnight to develop flavor and relax the gluten.', 'Beat the lamination butter into a flat slab, then encase it in the dough.', 'Perform three series of folds and rolls, chilling 30 minutes between each, to build the layers.', 'Roll out the final dough, cut into triangles, and roll each into a crescent shape.', 'Proof for 2-3 hours until puffy, brush with egg wash, and bake at 200C for 18-20 minutes until deep golden.'],
    },
    {
      userId: sophie, title: 'Spicy Thai Basil Beef',
      description: 'Bold, fast stir-fry with serious flavor.',
      category: 'Dinner', cuisine: 'Thai', cookTime: 15, servings: 3, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 410, protein: 28, carbs: 14, fat: 26,
      ingredients: [['Beef strips', '400g'], ['Thai basil leaves', '1 cup'], ['Garlic, minced', '4 cloves'], ['Thai chilies, sliced', '3'], ['Soy sauce', '2 tbsp'], ['Fish sauce', '1 tbsp'], ['Sugar', '1 tsp'], ['Vegetable oil', '2 tbsp']],
      steps: ['Heat oil in a wok over high heat, then add garlic and chilies and stir-fry for 30 seconds.', 'Add beef and stir-fry until just browned, about 2-3 minutes.', 'Stir in soy sauce, fish sauce and sugar, cooking for another minute.', 'Remove from heat and fold in basil leaves until wilted, then serve immediately over rice.'],
    },
    {
      userId: sophie, title: 'Restaurant-Style Tiramisu',
      description: 'The exact recipe I used to serve at a Michelin-starred kitchen. Every ratio dialed in.',
      category: 'Dessert', cuisine: 'Italian', cookTime: 30, servings: 8, difficulty: 'Medium',
      isPaid: true, price: 449, calories: 380, protein: 6, carbs: 32, fat: 24,
      ingredients: [['Egg yolks', '6'], ['Sugar', '150g'], ['Mascarpone', '500g'], ['Heavy cream', '250ml'], ['Ladyfingers', '24'], ['Espresso, cooled', '300ml'], ['Coffee liqueur', '3 tbsp'], ['Cocoa powder', 'for dusting']],
      steps: ['Whisk egg yolks and sugar over a bain-marie until pale and doubled in volume, then cool.', 'Fold in the mascarpone until smooth, then separately whip the cream to soft peaks and fold that in too.', 'Mix the espresso and liqueur, then quickly dip each ladyfinger and layer in a dish.', 'Spread half the mascarpone mixture over the ladyfingers, repeat with a second layer.', 'Chill for at least 6 hours, ideally overnight, then dust generously with cocoa before serving.'],
    },
    {
      userId: sophie, title: 'French Macarons',
      description: 'Finally cracked the technique after years of failed batches, full troubleshooting notes included.',
      category: 'Dessert', cuisine: 'French', cookTime: 90, servings: 20, difficulty: 'Hard',
      isPaid: true, price: 549, calories: 90, protein: 1, carbs: 14, fat: 4,
      ingredients: [['Almond flour', '150g'], ['Powdered sugar', '150g'], ['Egg whites, aged', '110g'], ['Granulated sugar', '150g'], ['Food coloring', 'as needed'], ['Buttercream filling', '200g']],
      steps: ['Sift the almond flour and powdered sugar together twice to remove any lumps.', 'Make a French meringue by whipping egg whites and sugar to stiff, glossy peaks.', 'Fold the dry ingredients into the meringue using the macaronage technique until the batter flows like lava.', 'Pipe rounds onto parchment, rap the tray on the counter to release bubbles, and rest 30-45 minutes until a skin forms.', 'Bake at 150C for 14-16 minutes, cool completely, then sandwich with buttercream.'],
    },
    {
      userId: sophie, title: 'Lemon Ricotta Pancakes',
      description: 'Brighter and fluffier than regular pancakes, restaurant brunch energy at home.',
      category: 'Breakfast', cuisine: 'Italian', cookTime: 20, servings: 4, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 290, protein: 10, carbs: 30, fat: 14,
      ingredients: [['Ricotta', '250g'], ['Flour', '200g'], ['Eggs', '3'], ['Lemon zest', '1 tbsp'], ['Lemon juice', '2 tbsp'], ['Sugar', '2 tbsp'], ['Baking powder', '1 tsp']],
      steps: ['Whisk the ricotta, eggs, lemon zest and juice together until smooth.', 'Fold in the flour, sugar and baking powder until just combined, batter will be thick.', 'Cook spoonfuls on a greased pan over medium heat until golden on both sides.', 'Serve warm with extra lemon zest and a dusting of powdered sugar.'],
    },
    {
      userId: david, title: 'Texas-Style Smoked Brisket',
      description: 'My exact 14-hour smoke schedule, rub ratios, and wrap timing from competition days.',
      category: 'Dinner', cuisine: 'American', cookTime: 840, servings: 10, difficulty: 'Hard',
      isPaid: true, price: 699, calories: 520, protein: 46, carbs: 4, fat: 36,
      ingredients: [['Beef brisket', '5kg'], ['Kosher salt', '60g'], ['Black pepper, coarse', '60g'], ['Oak wood chunks', 'as needed'], ['Butcher paper', 'for wrapping']],
      steps: ['Trim the fat cap to an even quarter inch and apply the salt and pepper rub generously on all sides.', 'Smoke at 110C using oak, maintaining steady airflow, until the bark sets, about 6-7 hours.', 'Wrap tightly in butcher paper once the internal temperature hits 75C, the stall point.', 'Continue smoking until internal temperature reaches 95C, then rest wrapped in a cooler for at least 1 hour.', 'Slice against the grain, point and flat separately, just before serving.'],
    },
    {
      userId: david, title: 'Classic BBQ Pulled Pork',
      description: 'Low and slow, falls apart with two forks.',
      category: 'Dinner', cuisine: 'American', cookTime: 480, servings: 8, difficulty: 'Medium',
      isPaid: false, price: 0, calories: 410, protein: 34, carbs: 12, fat: 24,
      ingredients: [['Pork shoulder', '2.5kg'], ['Brown sugar', '60g'], ['Smoked paprika', '2 tbsp'], ['Garlic powder', '1 tbsp'], ['Cayenne', '1 tsp'], ['Apple cider vinegar', '120ml'], ['BBQ sauce', 'to serve']],
      steps: ['Rub the pork shoulder all over with the sugar and spice mix and let sit at least an hour.', 'Smoke or slow-roast at 110-120C for 7-8 hours until internal temperature reaches 95C.', 'Rest for 30 minutes, then shred with two forks, discarding excess fat.', 'Toss with apple cider vinegar and serve with BBQ sauce.'],
    },
    {
      userId: david, title: 'Grilled Street Corn (Elote)',
      description: 'Charred, creamy, tangy, the perfect summer side.',
      category: 'Side', cuisine: 'Mexican', cookTime: 20, servings: 4, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 230, protein: 6, carbs: 22, fat: 14,
      ingredients: [['Corn on the cob', '4'], ['Mayonnaise', '60ml'], ['Cotija cheese, crumbled', '60g'], ['Chili powder', '1 tsp'], ['Lime', '1'], ['Cilantro, chopped', '2 tbsp']],
      steps: ['Grill the corn over medium-high heat, turning often, until charred in spots, about 10-12 minutes.', 'Brush each cob with mayonnaise while still warm.', 'Roll in crumbled cotija cheese and dust with chili powder.', 'Finish with a squeeze of lime and a scattering of cilantro.'],
    },
    {
      userId: david, title: 'Smoky Baked Beans', description: 'The side dish that steals the show at every cookout.',
      category: 'Side', cuisine: 'American', cookTime: 180, servings: 6, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 260, protein: 11, carbs: 38, fat: 6,
      ingredients: [['Navy beans, dried', '450g'], ['Bacon, diced', '150g'], ['Onion, diced', '1'], ['Brown sugar', '60g'], ['Molasses', '2 tbsp'], ['Mustard', '1 tbsp'], ['BBQ sauce', '120ml']],
      steps: ['Soak the beans overnight, then drain and simmer in fresh water until just tender, about 1 hour.', 'Render the bacon in a Dutch oven, then saute the onion in the rendered fat.', 'Combine the beans, bacon, onion, sugar, molasses, mustard and BBQ sauce.', 'Bake covered at 150C for 2 hours, stirring occasionally, until thick and glossy.'],
    },
    {
      userId: maria, title: 'Vegetable Pad Thai', description: 'Weeknight Thai takeout, but better and at home.',
      category: 'Dinner', cuisine: 'Thai', cookTime: 25, servings: 3, difficulty: 'Medium',
      isPaid: false, price: 0, calories: 390, protein: 14, carbs: 58, fat: 12,
      ingredients: [['Rice noodles', '200g'], ['Tofu, firm', '200g'], ['Eggs', '2'], ['Bean sprouts', '1 cup'], ['Tamarind paste', '2 tbsp'], ['Fish sauce', '2 tbsp'], ['Brown sugar', '2 tbsp'], ['Peanuts, crushed', '40g'], ['Lime', '1']],
      steps: ['Soak the rice noodles in warm water until pliable, then drain.', 'Pan-fry the tofu until golden, push to the side, then scramble the eggs in the same pan.', 'Add the noodles, tamarind paste, fish sauce and sugar, tossing to combine and coat evenly.', 'Fold in the bean sprouts, then plate and top with crushed peanuts and a lime wedge.'],
    },
    {
      userId: jake, title: 'No-Knead Artisan Bread', description: 'Bakery-quality crust with almost zero effort, the dough does the work overnight.',
      category: 'Breakfast', cuisine: 'American', cookTime: 60, servings: 8, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 180, protein: 5, carbs: 36, fat: 1,
      ingredients: [['Bread flour', '450g'], ['Salt', '10g'], ['Instant yeast', '2g'], ['Water, room temp', '375ml']],
      steps: ['Mix the flour, salt, yeast and water together until just combined, no kneading needed.', 'Cover and let rest at room temperature for 12-18 hours until bubbly and doubled.', 'Turn out onto a floured surface, shape into a round, and rest 30 more minutes.', 'Bake in a preheated Dutch oven at 230C, covered, for 30 minutes, then uncovered for 10-15 minutes until deeply golden.'],
    },
    {
      userId: sophie, title: 'Pan-Seared Scallops with Brown Butter', description: 'Restaurant technique for a perfect golden crust every single time.',
      category: 'Dinner', cuisine: 'French', cookTime: 15, servings: 2, difficulty: 'Medium',
      isPaid: true, price: 349, calories: 320, protein: 24, carbs: 4, fat: 22,
      ingredients: [['Sea scallops, large', '8'], ['Butter', '60g'], ['Garlic cloves', '2'], ['Fresh thyme', '2 sprigs'], ['Lemon', '1/2'], ['Salt', 'to taste']],
      steps: ['Pat the scallops completely dry and season with salt just before cooking.', 'Sear in a hot pan with a neutral oil for 90 seconds per side without moving them, until deeply golden.', 'Remove the scallops, then add butter, garlic and thyme to the same pan and cook until the butter browns and smells nutty.', 'Spoon the brown butter over the scallops and finish with a squeeze of lemon.'],
    },
    {
      userId: david, title: 'Spatchcock Grilled Chicken', description: 'Even cooking, crispy skin, half the grill time of a whole bird.',
      category: 'Dinner', cuisine: 'American', cookTime: 50, servings: 4, difficulty: 'Medium',
      isPaid: false, price: 0, calories: 440, protein: 38, carbs: 2, fat: 30,
      ingredients: [['Whole chicken', '1.8kg'], ['Olive oil', '3 tbsp'], ['Garlic powder', '1 tbsp'], ['Smoked paprika', '1 tbsp'], ['Salt', '2 tsp'], ['Black pepper', '1 tsp']],
      steps: ['Spatchcock the chicken by removing the backbone and pressing it flat.', 'Rub all over with olive oil and the spice mix, getting under the skin where possible.', 'Grill skin-side up over indirect medium heat for about 40 minutes.', 'Finish skin-side down over direct heat for 5-10 minutes to crisp, until internal temp hits 75C.'],
    },
    {
      userId: maria, title: 'Mushroom Risotto', description: 'Creamy without any cream, just technique and patience.',
      category: 'Dinner', cuisine: 'Italian', cookTime: 40, servings: 4, difficulty: 'Medium',
      isPaid: false, price: 0, calories: 380, protein: 9, carbs: 52, fat: 14,
      ingredients: [['Arborio rice', '300g'], ['Mixed mushrooms', '300g'], ['Vegetable stock', '1.2l'], ['White wine', '120ml'], ['Onion, diced', '1'], ['Parmesan, grated', '60g'], ['Butter', '40g']],
      steps: ['Saute the mushrooms in butter until golden, then set aside.', 'Saute the onion until soft, add the rice and toast for a minute, then deglaze with wine.', 'Add the warm stock one ladle at a time, stirring frequently, until each addition is absorbed before adding more.', 'Once the rice is creamy and just tender, fold in the mushrooms and parmesan, then serve immediately.'],
    },
    {
      userId: jake, title: 'New York Cheesecake', description: 'Dense, rich, and cracks-free with my water bath trick.',
      category: 'Dessert', cuisine: 'American', cookTime: 90, servings: 10, difficulty: 'Medium',
      isPaid: true, price: 379, calories: 420, protein: 7, carbs: 32, fat: 30,
      ingredients: [['Cream cheese', '900g'], ['Sugar', '200g'], ['Eggs', '4'], ['Sour cream', '180g'], ['Vanilla extract', '1 tsp'], ['Graham cracker crumbs', '200g'], ['Butter, melted', '90g']],
      steps: ['Mix the graham crumbs with melted butter and press into a springform pan, then chill.', 'Beat the cream cheese and sugar until smooth, scraping the bowl often to avoid lumps.', 'Add eggs one at a time on low speed, then mix in sour cream and vanilla.', 'Pour over the crust and bake in a water bath at 150C for about 70 minutes until the center is just set.', 'Cool slowly in the oven with the door cracked, then chill at least 6 hours before slicing.'],
    },
    {
      userId: sophie, title: 'Classic Margherita Pizza', description: 'Neapolitan-style dough recipe and the timing that gets a proper leopard-spotted crust.',
      category: 'Dinner', cuisine: 'Italian', cookTime: 1440, servings: 4, difficulty: 'Hard',
      isPaid: true, price: 299, calories: 290, protein: 11, carbs: 38, fat: 10,
      ingredients: [['00 flour', '500g'], ['Water', '325ml'], ['Salt', '12g'], ['Yeast', '2g'], ['San Marzano tomatoes', '400g'], ['Fresh mozzarella', '250g'], ['Fresh basil', '1 bunch'], ['Olive oil', 'to finish']],
      steps: ['Mix the dough and let it cold ferment in the fridge for 24-48 hours for the best flavor and texture.', 'Bring to room temperature for 2 hours before shaping.', 'Stretch the dough by hand into a thin round, leaving a slightly thicker edge.', 'Top with crushed tomatoes, torn mozzarella, and a drizzle of olive oil.', 'Bake at the highest temperature your oven allows, ideally on a preheated stone, until the crust blisters and chars slightly, 6-9 minutes.', 'Finish with fresh basil right out of the oven.'],
    },
    {
      userId: maria, title: 'Loaded Sweet Potato Black Bean Bowl', description: 'Filling vegan bowl with bold spice.',
      category: 'Lunch', cuisine: 'Mexican', cookTime: 35, servings: 2, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 410, protein: 13, carbs: 64, fat: 12,
      ingredients: [['Sweet potatoes', '2'], ['Black beans', '1 can'], ['Cumin', '1 tsp'], ['Smoked paprika', '1 tsp'], ['Avocado', '1'], ['Lime', '1'], ['Cilantro', '2 tbsp']],
      steps: ['Cube the sweet potatoes and roast at 200C with cumin and paprika for 25-30 minutes until tender.', 'Warm the black beans with a splash of their liquid and a pinch of salt.', 'Assemble bowls with the roasted sweet potato, beans, sliced avocado, and a squeeze of lime.', 'Finish with chopped cilantro.'],
    },
    {
      userId: jake, title: 'Cinnamon Rolls with Cream Cheese Icing', description: 'Soft, pillowy, and worth the rise time.',
      category: 'Breakfast', cuisine: 'American', cookTime: 150, servings: 12, difficulty: 'Medium',
      isPaid: false, price: 0, calories: 340, protein: 6, carbs: 48, fat: 14,
      ingredients: [['Flour', '500g'], ['Milk, warm', '240ml'], ['Yeast', '7g'], ['Sugar', '70g'], ['Butter, softened', '80g'], ['Brown sugar (filling)', '120g'], ['Cinnamon', '2 tbsp'], ['Cream cheese (icing)', '120g'], ['Powdered sugar (icing)', '150g']],
      steps: ['Mix the dough, knead until smooth, and let rise for about an hour until doubled.', 'Roll out into a large rectangle, spread with softened butter, brown sugar and cinnamon.', 'Roll tightly into a log and slice into 12 rolls, then arrange in a baking dish.', 'Let rise again for 30-40 minutes, then bake at 180C for 22-25 minutes until golden.', 'Beat the cream cheese and powdered sugar together and spread over the warm rolls.'],
    },
    {
      userId: david, title: 'Carne Asada Tacos', description: 'Marinade ratio I have used for a decade, never fails.',
      category: 'Dinner', cuisine: 'Mexican', cookTime: 30, servings: 4, difficulty: 'Easy',
      isPaid: false, price: 0, calories: 360, protein: 30, carbs: 18, fat: 18,
      ingredients: [['Flank steak', '600g'], ['Orange juice', '60ml'], ['Lime juice', '60ml'], ['Garlic cloves', '4'], ['Cumin', '1 tsp'], ['Corn tortillas', '8'], ['Cilantro, onion, lime for serving', '']],
      steps: ['Marinate the steak in citrus juice, garlic and cumin for at least 1 hour, ideally overnight.', 'Grill over high heat for 4-5 minutes per side for medium-rare, then rest 5 minutes.', 'Slice thinly against the grain.', 'Serve in warmed tortillas with cilantro, diced onion and a squeeze of lime.'],
    },
    {
      userId: sophie, title: 'Creme Brulee', description: 'Just six ingredients, but the technique is everything, my exact torch timing included.',
      category: 'Dessert', cuisine: 'French', cookTime: 60, servings: 4, difficulty: 'Medium',
      isPaid: true, price: 329, calories: 350, protein: 5, carbs: 28, fat: 26,
      ingredients: [['Heavy cream', '500ml'], ['Egg yolks', '5'], ['Sugar', '100g'], ['Vanilla bean', '1'], ['Sugar (for topping)', '4 tbsp']],
      steps: ['Heat the cream with the scraped vanilla bean until just steaming, then let infuse for 10 minutes.', 'Whisk the egg yolks and sugar, then slowly temper in the warm cream.', 'Strain into ramekins and bake in a water bath at 150C for about 35-40 minutes until just set with a slight wobble.', 'Chill at least 4 hours, then sprinkle sugar on top and caramelize with a torch right before serving.'],
    },
  ];

  for (const r of recipesData) {
    const recipe = insertRecipe.run(
      r.userId, r.title, r.description, r.category, r.cuisine, r.cookTime, r.servings,
      r.difficulty, placeholderImage(r.title), r.isPaid ? 1 : 0, r.price, r.calories, r.protein, r.carbs, r.fat
    );
    const recipeId = recipe.lastInsertRowid;
    r.ingredients.forEach(([name, amount], idx) => {
      insertIngredient.run(recipeId, name, amount, idx);
    });
    r.steps.forEach((instruction, idx) => {
      insertStep.run(recipeId, idx + 1, instruction);
    });
  }

  const insertReview = db.prepare(
    'INSERT INTO reviews (user_id, recipe_id, rating, comment) VALUES (?, ?, ?, ?)'
  );
  insertReview.run(jake, 1, 5, 'Made this three times already, so easy.');
  insertReview.run(maria, 5, 5, 'Best chocolate chip cookies I have made.');
  insertReview.run(david, 1, 4, 'Great with grilled chicken on top too.');
  insertReview.run(sophie, 2, 5, 'My kids ask for this every week now.');
  insertReview.run(maria, 12, 5, 'Croissants actually turned out bakery quality, worth the time.');

  const insertComment = db.prepare(
    'INSERT INTO comments (recipe_id, user_id, parent_id, body) VALUES (?, ?, ?, ?)'
  );
  const c1 = insertComment.run(1, jake, null, 'Can I use half and half instead of heavy cream?');
  insertComment.run(1, maria, c1.lastInsertRowid, 'Yes, it will just be slightly less rich, still works great!');
  insertComment.run(6, david, null, 'These are now a permanent weekend tradition in my house.');

  console.log(`Seeded ${recipesData.length} recipes from ${users.length} users.`);
} else {
  console.log('Database already has data, skipping seed.');
}

db.close();
console.log('Database ready at', dbPath);
