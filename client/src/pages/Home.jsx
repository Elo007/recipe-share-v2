import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import RecipeCardCompact from '../components/RecipeCardCompact';
import HeroCarousel from '../components/HeroCarousel';

export default function Home() {
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cuisines, setCuisines] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [ingredient, setIngredient] = useState('');
  const [pricing, setPricing] = useState('');
  const [loading, setLoading] = useState(true);

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (category) params.category = category;
    if (cuisine) params.cuisine = cuisine;
    if (ingredient) params.ingredient = ingredient;
    if (pricing) params.pricing = pricing;
    try {
      const data = await api.getRecipes(params);
      setRecipes(data);
    } finally {
      setLoading(false);
    }
  }, [search, category, cuisine, ingredient, pricing]);

  useEffect(() => {
    api.getCategories().then(setCategories);
    api.getCuisines().then(setCuisines);
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadRecipes, 300);
    return () => clearTimeout(timer);
  }, [loadRecipes]);

  // Featured carousel: a handful of paid recipes if any exist (they're the
  // ones worth showing off), falling back to whatever's most recent.
  const featured = useMemo(() => {
    const paid = recipes.filter((r) => r.is_paid);
    const pool = paid.length >= 3 ? paid : recipes;
    return pool.slice(0, 4);
  }, [recipes]);

  // Only split into "Latest" / "Chef-exclusive" sections when no filter is
  // active, since filtered results read better as one flat grid.
  const isUnfiltered = !search && !category && !cuisine && !ingredient && !pricing;
  const latest = isUnfiltered ? recipes.filter((r) => !r.is_paid).slice(0, 8) : recipes;
  const exclusive = isUnfiltered ? recipes.filter((r) => r.is_paid).slice(0, 8) : [];

  return (
    <div className="page">
      {!loading && featured.length > 0 && isUnfiltered && <HeroCarousel recipes={featured} />}

      <div className="pill-tabs" style={{ marginTop: 24 }}>
        <button className={`pill-tab ${pricing === '' ? 'active' : ''}`} onClick={() => setPricing('')}>All recipes</button>
        <button className={`pill-tab ${pricing === 'free' ? 'active' : ''}`} onClick={() => setPricing('free')}>Free</button>
        <button className={`pill-tab ${pricing === 'paid' ? 'active' : ''}`} onClick={() => setPricing('paid')}>Chef-exclusive</button>
      </div>

      <div className="filters-bar">
        <input type="text" placeholder="Search recipes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <input
          type="text"
          placeholder="Have an ingredient? e.g. garlic"
          value={ingredient}
          onChange={(e) => setIngredient(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '11px 16px', border: '2px solid var(--ink)', borderRadius: 999, fontSize: '0.95rem' }}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
          <option value="">All cuisines</option>
          {cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="loading-text">Loading recipes...</p>
      ) : recipes.length === 0 ? (
        <div className="empty-state">
          <h3>Nothing matches that search.</h3>
          <p>Try a different ingredient, category, or clear your filters.</p>
        </div>
      ) : isUnfiltered ? (
        <>
          {latest.length > 0 && (
            <>
              <div className="rte-section-head"><h2>Latest recipes</h2></div>
              <div className="rte-grid">
                {latest.map((r) => <RecipeCardCompact key={r.id} recipe={r} />)}
              </div>
            </>
          )}
          {exclusive.length > 0 && (
            <>
              <div className="rte-section-head"><h2>Chef-exclusive recipes</h2></div>
              <div className="rte-grid">
                {exclusive.map((r) => <RecipeCardCompact key={r.id} recipe={r} />)}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="rte-grid" style={{ marginTop: 24 }}>
          {recipes.map((r) => <RecipeCardCompact key={r.id} recipe={r} />)}
        </div>
      )}
    </div>
  );
}
