import { useState, useEffect } from 'react';
import { api } from '../api';
import RecipeCard from '../components/RecipeCard';

export default function Favorites() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFavorites().then((data) => {
      setRecipes(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="page">
      <span className="eyebrow">Your collection</span>
      <h1>Favorites</h1>

      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : recipes.length === 0 ? (
        <div className="empty-state">
          <h3>No favorites yet.</h3>
          <p>Browse recipes and tap the star to save the ones you want to make.</p>
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      )}
    </div>
  );
}
