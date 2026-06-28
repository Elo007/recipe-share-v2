import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Auto-rotating, photo-dominant hero. Pauses on hover so people can
// actually read the title before it changes underneath them.
export default function HeroCarousel({ recipes }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (paused || recipes.length === 0) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % recipes.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [paused, recipes.length]);

  if (recipes.length === 0) return null;

  const recipe = recipes[index];
  const priceLabel = recipe.is_paid ? `Chef-exclusive · ${recipe.category}` : `Free · ${recipe.category}`;

  return (
    <div
      className="rte-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <img
        src={recipe.image_url || 'https://picsum.photos/seed/recipeplaceholder/1400/900'}
        alt={recipe.title}
      />
      <div className="rte-hero-overlay">
        <span className="rte-hero-eyebrow">{priceLabel}</span>
        <div className="rte-hero-title">{recipe.title}</div>
        <button className="rte-hero-btn" onClick={() => navigate(`/recipes/${recipe.id}`)}>
          {recipe.is_paid ? 'Unlock the recipe' : 'Get the recipe'} →
        </button>
      </div>
      <div className="rte-hero-dots">
        {recipes.map((_, i) => (
          <button
            key={i}
            className={i === index ? 'active' : ''}
            onClick={() => setIndex(i)}
            aria-label={`Show featured recipe ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
