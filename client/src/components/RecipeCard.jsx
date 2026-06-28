import { Link } from 'react-router-dom';
import StarRating from './StarRating';

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function RecipeCard({ recipe }) {
  const isLocked = recipe.is_paid && !recipe.unlocked;

  return (
    <Link to={`/recipes/${recipe.id}`} className={`recipe-card cat-${recipe.category}`}>
      <div className="recipe-card-img-wrap">
        <img
          className="recipe-card-img"
          src={recipe.image_url || 'https://images.unsplash.com/photo-1495195134817-aeb325a55b65?w=600'}
          alt={recipe.title}
          loading="lazy"
        />
        {recipe.is_paid ? (
          <span className="price-tag">{formatPrice(recipe.price_cents)}</span>
        ) : (
          <span className="free-tag">FREE</span>
        )}
        {isLocked && <div className="lock-overlay">🔒</div>}
      </div>
      <div className="recipe-card-body">
        <span className="recipe-card-tag">{recipe.category}</span>
        <h3 className="recipe-card-title">{recipe.title}</h3>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>{recipe.description}</p>
        <div className="recipe-card-meta">
          <span>{recipe.cook_time_minutes} min · by {recipe.author}</span>
        </div>
        <StarRating rating={recipe.avgRating} reviewCount={recipe.reviewCount} />
      </div>
    </Link>
  );
}
