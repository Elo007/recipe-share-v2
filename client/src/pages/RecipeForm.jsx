import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const CATEGORY_OPTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Salad', 'Side', 'Snack', 'Drink', 'Other'];
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];

export default function RecipeForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Dinner');
  const [cuisine, setCuisine] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState(4);
  const [difficulty, setDifficulty] = useState('Easy');
  const [imageUrl, setImageUrl] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [ingredients, setIngredients] = useState([{ name: '', amount: '' }]);
  const [steps, setSteps] = useState(['']);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) return;
    api.getRecipe(id).then((r) => {
      setTitle(r.title);
      setDescription(r.description);
      setCategory(r.category);
      setCuisine(r.cuisine || '');
      setCookTime(r.cook_time_minutes);
      setServings(r.servings);
      setDifficulty(r.difficulty || 'Easy');
      setImageUrl(r.image_url);
      setIsPaid(!!r.is_paid);
      setPrice(r.is_paid ? (r.price_cents / 100).toFixed(2) : '');
      setCalories(r.calories || '');
      setProtein(r.protein_g || '');
      setCarbs(r.carbs_g || '');
      setFat(r.fat_g || '');
      setIngredients(r.ingredients.map((i) => ({ name: i.name, amount: i.amount })));
      setSteps(r.steps.map((s) => s.instruction));
      setLoading(false);
    });
  }, [id, isEditing]);

  function updateIngredient(index, field, value) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)));
  }
  function addIngredientRow() { setIngredients((prev) => [...prev, { name: '', amount: '' }]); }
  function removeIngredientRow(index) { setIngredients((prev) => prev.filter((_, i) => i !== index)); }

  function updateStep(index, value) { setSteps((prev) => prev.map((s, i) => (i === index ? value : s))); }
  function addStepRow() { setSteps((prev) => [...prev, '']); }
  function removeStepRow(index) { setSteps((prev) => prev.filter((_, i) => i !== index)); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const cleanIngredients = ingredients.filter((i) => i.name.trim());
    const cleanSteps = steps.filter((s) => s.trim());

    if (!title.trim() || !category || !cookTime || cleanIngredients.length === 0 || cleanSteps.length === 0) {
      setError('Title, category, cook time, at least one ingredient and one step are required.');
      return;
    }
    if (isPaid && (!price || Number(price) < 0.5)) {
      setError('Paid recipes need a price of at least $0.50.');
      return;
    }

    setSubmitting(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      category,
      cuisine: cuisine.trim(),
      cookTimeMinutes: Number(cookTime),
      servings: Number(servings) || 4,
      difficulty,
      imageUrl: imageUrl.trim(),
      isPaid,
      priceCents: isPaid ? Math.round(Number(price) * 100) : 0,
      calories: calories ? Number(calories) : null,
      proteinG: protein ? Number(protein) : null,
      carbsG: carbs ? Number(carbs) : null,
      fatG: fat ? Number(fat) : null,
      ingredients: cleanIngredients,
      steps: cleanSteps,
    };

    try {
      if (isEditing) {
        await api.updateRecipe(id, payload);
        navigate(`/recipes/${id}`);
      } else {
        const created = await api.createRecipe(payload);
        navigate(`/recipes/${created.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="loading-text">Loading...</p>;

  return (
    <div className="page page-narrow">
      <span className="eyebrow">{isEditing ? 'Edit recipe' : 'Share a recipe'}</span>
      <h1>{isEditing ? 'Update your recipe' : 'Post a new recipe'}</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
        {error && <div className="error-banner">{error}</div>}

        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="form-group">
          <label htmlFor="description">Short description</label>
          <textarea id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="cuisine">Cuisine</label>
            <input id="cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="e.g. Italian" />
          </div>
          <div className="form-group">
            <label htmlFor="difficulty">Difficulty</label>
            <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="cookTime">Cook time (minutes)</label>
            <input id="cookTime" type="number" min="1" value={cookTime} onChange={(e) => setCookTime(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="servings">Servings</label>
            <input id="servings" type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="imageUrl">Image URL (optional)</label>
          <input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>

        <h2 style={{ marginTop: 32, marginBottom: 12 }}>Nutrition (optional)</h2>
        <div className="form-row">
          <div className="form-group"><label htmlFor="calories">Calories</label><input id="calories" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} /></div>
          <div className="form-group"><label htmlFor="protein">Protein (g)</label><input id="protein" type="number" value={protein} onChange={(e) => setProtein(e.target.value)} /></div>
          <div className="form-group"><label htmlFor="carbs">Carbs (g)</label><input id="carbs" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} /></div>
          <div className="form-group"><label htmlFor="fat">Fat (g)</label><input id="fat" type="number" value={fat} onChange={(e) => setFat(e.target.value)} /></div>
        </div>

        <h2 style={{ marginTop: 32, marginBottom: 12 }}>Pricing</h2>
        <div className="checkbox-row">
          <input id="isPaid" type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
          <label htmlFor="isPaid">Make this a paid recipe</label>
        </div>
        {isPaid && (
          <div className="form-group" style={{ maxWidth: 200 }}>
            <label htmlFor="price">Price (USD)</label>
            <input id="price" type="number" min="0.50" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="4.99" />
          </div>
        )}

        <h2 style={{ marginTop: 32, marginBottom: 12 }}>Ingredients</h2>
        {ingredients.map((ing, i) => (
          <div className="dynamic-row" key={i}>
            <div className="form-group">
              <input placeholder="Ingredient, e.g. Garlic cloves" value={ing.name} onChange={(e) => updateIngredient(i, 'name', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '0 0 120px' }}>
              <input placeholder="Amount" value={ing.amount} onChange={(e) => updateIngredient(i, 'amount', e.target.value)} />
            </div>
            {ingredients.length > 1 && (
              <button type="button" className="remove-row-btn" onClick={() => removeIngredientRow(i)} aria-label="Remove ingredient">×</button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addIngredientRow}>+ Add ingredient</button>

        <h2 style={{ marginTop: 32, marginBottom: 12 }}>Steps</h2>
        {steps.map((step, i) => (
          <div className="dynamic-row" key={i}>
            <div className="form-group">
              <textarea rows={2} placeholder={`Step ${i + 1}`} value={step} onChange={(e) => updateStep(i, e.target.value)} />
            </div>
            {steps.length > 1 && (
              <button type="button" className="remove-row-btn" onClick={() => removeStepRow(i)} aria-label="Remove step">×</button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addStepRow}>+ Add step</button>

        <div style={{ marginTop: 32 }}>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Post recipe'}
          </button>
        </div>
      </form>
    </div>
  );
}
