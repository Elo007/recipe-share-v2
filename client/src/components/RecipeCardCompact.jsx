import { Link } from 'react-router-dom';

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Denser, photo-forward card style inspired by content-blog layouts like
// RecipeTin Eats: taller portrait photo, badges floated directly on top of
// the image, minimal text below. Used on the home page grid; the original
// wider RecipeCard is still used on Favorites/Profile where a description
// line is more useful.
export default function RecipeCardCompact({ recipe }) {
  const isLocked = recipe.is_paid && !recipe.unlocked;

  return (
    <Link to={`/recipes/${recipe.id}`} className={`rte-card cat-${recipe.category}`}>
      <div className="rte-card-img-wrap">
        <img
          src={recipe.image_url || 'https://images.unsplash.com/photo-1495195134817-aeb325a55b65?w=600'}
          alt={recipe.title}
          loading="lazy"
        />
        <span className="rte-card-cat-overlay">{recipe.category}</span>
        {recipe.is_paid ? (
          <span className="rte-card-price-overlay">{formatPrice(recipe.price_cents)}</span>
        ) : (
          <span className="rte-card-free-overlay">FREE</span>
        )}
        {isLocked && <div className="rte-card-lock">🔒</div>}
      </div>
      <div className="rte-card-title">{recipe.title}</div>
      <div className="rte-card-meta">
        {recipe.avgRating ? (
          <span className="rte-card-rating">{'★'.repeat(Math.round(recipe.avgRating))}{'☆'.repeat(5 - Math.round(recipe.avgRating))}</span>
        ) : null}
        <span>
          {recipe.avgRating ? `${recipe.avgRating} (${recipe.reviewCount}) · ` : ''}
          {recipe.cook_time_minutes < 60 ? `${recipe.cook_time_minutes} min` : `${Math.round(recipe.cook_time_minutes / 60)} hr`}
        </span>
      </div>
    </Link>
  );
}
