import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import StarRating from '../components/StarRating';
import StarInput from '../components/StarInput';
import Avatar from '../components/Avatar';
import RecipeCard from '../components/RecipeCard';

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function RecipeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [recipe, setRecipe] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState('');

  async function load() {
    setLoading(true);
    const data = await api.getRecipe(id);
    setRecipe(data);
    api.getRelated(id).then(setRelated);
    if (user) {
      const fav = await api.checkFavorite(id);
      setFavorited(fav.favorited);
      const myReview = data.reviews.find((r) => r.user_id === user.id);
      if (myReview) {
        setReviewRating(myReview.rating);
        setReviewComment(myReview.comment);
      }
    }
    setLoading(false);
  }

  // Handle returning from Stripe Checkout: confirm the session, then strip
  // the query params so a page refresh doesn't re-trigger anything.
  useEffect(() => {
    const purchaseStatus = searchParams.get('purchase');
    const sessionId = searchParams.get('session_id');

    if (purchaseStatus === 'success' && sessionId) {
      api.confirmPurchase(sessionId)
        .then(() => {
          setPurchaseMessage('Purchase complete! The full recipe is unlocked below.');
          load();
        })
        .catch((err) => setPurchaseMessage(`Could not confirm purchase: ${err.message}`))
        .finally(() => setSearchParams({}, { replace: true }));
    } else if (purchaseStatus === 'cancelled') {
      setPurchaseMessage('Checkout was cancelled, no charge was made.');
      setSearchParams({}, { replace: true });
    } else {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  async function toggleFavorite() {
    if (favorited) {
      await api.removeFavorite(id);
    } else {
      await api.addFavorite(id);
    }
    setFavorited(!favorited);
  }

  async function handleDelete() {
    if (!window.confirm('Delete this recipe? This cannot be undone.')) return;
    await api.deleteRecipe(id);
    navigate('/');
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    setReviewError('');
    if (!reviewRating) {
      setReviewError('Pick a star rating first.');
      return;
    }
    setSubmittingReview(true);
    try {
      await api.addReview(id, { rating: reviewRating, comment: reviewComment });
      await load();
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleCommentSubmit(e) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPostingComment(true);
    try {
      await api.addComment(id, { body: commentBody });
      setCommentBody('');
      await load();
    } finally {
      setPostingComment(false);
    }
  }

  async function handleBuyNow() {
    setCheckoutLoading(true);
    try {
      const { url } = await api.startCheckout(id);
      window.location.href = url;
    } catch (err) {
      setPurchaseMessage(err.message);
      setCheckoutLoading(false);
    }
  }

  if (loading) return <p className="loading-text">Loading recipe...</p>;
  if (!recipe) return <p className="loading-text">Recipe not found.</p>;

  const isOwner = user && user.id === recipe.user_id;
  const myExistingReview = user && recipe.reviews.find((r) => r.user_id === user.id);
  const topLevelComments = recipe.comments.filter((c) => !c.parent_id);
  const repliesFor = (commentId) => recipe.comments.filter((c) => c.parent_id === commentId);

  return (
    <div className="page">
      {purchaseMessage && (
        <div className={purchaseMessage.includes('unlocked') ? 'success-banner' : 'error-banner'}>
          {purchaseMessage}
        </div>
      )}

      <div className={`recipe-detail cat-${recipe.category}`}>
        <img
          className="recipe-detail-hero"
          src={recipe.image_url || 'https://images.unsplash.com/photo-1495195134817-aeb325a55b65?w=1200'}
          alt={recipe.title}
        />
        <div className="recipe-detail-body">
          <div className="recipe-detail-top">
            <div>
              <span className="recipe-stamp">{recipe.category}{recipe.cuisine ? ` · ${recipe.cuisine}` : ''}</span>
              <h1 style={{ marginTop: 12 }}>{recipe.title}</h1>
              <p>{recipe.description}</p>
              <p style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                <Avatar username={recipe.author} color={recipe.authorColor} size={24} />
                by <Link to={`/profile/${recipe.user_id}`} style={{ fontWeight: 700, color: 'var(--ember)', marginLeft: 4 }}>{recipe.author}</Link>
              </p>
            </div>
            <div className="recipe-actions">
              {user && !isOwner && (
                <button className="btn btn-ghost" onClick={toggleFavorite}>
                  {favorited ? '★ Favorited' : '☆ Add to favorites'}
                </button>
              )}
              {isOwner && (
                <>
                  <button className="btn btn-ghost" onClick={() => navigate(`/recipes/${id}/edit`)}>Edit</button>
                  <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
                </>
              )}
            </div>
          </div>

          <div className="recipe-detail-meta-row">
            <div className="meta-pill">
              <span className="meta-label">Cook time</span>
              <span className="meta-value">{recipe.cook_time_minutes < 60 ? `${recipe.cook_time_minutes} min` : `${Math.round(recipe.cook_time_minutes / 60)} hr`}</span>
            </div>
            <div className="meta-pill">
              <span className="meta-label">Servings</span>
              <span className="meta-value">{recipe.servings}</span>
            </div>
            <div className="meta-pill">
              <span className="meta-label">Difficulty</span>
              <span className="meta-value">{recipe.difficulty}</span>
            </div>
            <div className="meta-pill">
              <span className="meta-label">Rating</span>
              <span className="meta-value" style={{ fontSize: '0.95rem' }}>
                <StarRating rating={recipe.avgRating} reviewCount={recipe.reviewCount} />
              </span>
            </div>
          </div>

          {recipe.calories && (
            <div className="nutrition-strip">
              <div className="nutrition-item"><div className="n-value">{recipe.calories}</div><div className="n-label">Calories</div></div>
              <div className="nutrition-item"><div className="n-value">{recipe.protein_g}g</div><div className="n-label">Protein</div></div>
              <div className="nutrition-item"><div className="n-value">{recipe.carbs_g}g</div><div className="n-label">Carbs</div></div>
              <div className="nutrition-item"><div className="n-value">{recipe.fat_g}g</div><div className="n-label">Fat</div></div>
            </div>
          )}

          {recipe.unlocked ? (
            <div className="detail-columns" style={{ marginTop: 32 }}>
              <div>
                <h2>Ingredients</h2>
                <ul className="ingredient-list">
                  {recipe.ingredients.map((ing) => (
                    <li key={ing.id}><span>{ing.name}</span><span className="ingredient-amount">{ing.amount}</span></li>
                  ))}
                </ul>
              </div>
              <div>
                <h2>Steps</h2>
                <ol className="steps-list">
                  {recipe.steps.map((step) => <li key={step.id}>{step.instruction}</li>)}
                </ol>
              </div>
            </div>
          ) : (
            <div className="paywall">
              <h3>This is one of {recipe.author}'s signature recipes</h3>
              <p>Unlock the full ingredient list and step-by-step instructions.</p>
              <div className="paywall-price">{formatPrice(recipe.price_cents)}</div>
              {user ? (
                <button className="btn btn-primary" onClick={handleBuyNow} disabled={checkoutLoading}>
                  {checkoutLoading ? 'Redirecting to checkout...' : 'Unlock this recipe'}
                </button>
              ) : (
                <Link to="/login" className="btn btn-primary">Log in to unlock</Link>
              )}
              <p style={{ fontSize: '0.8rem', marginTop: 14 }}>
                Test mode: use card number 4242 4242 4242 4242, any future expiry, any CVC. No real charge is made.
              </p>
            </div>
          )}

          <div style={{ marginTop: 44 }}>
            <h2>Ratings ({recipe.reviews.length})</h2>

            {user && !isOwner && (
              <form onSubmit={handleReviewSubmit} style={{ margin: '20px 0', padding: 22, background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                {reviewError && <div className="error-banner">{reviewError}</div>}
                <div className="form-group">
                  <label>{myExistingReview ? 'Update your rating' : 'Leave a rating'}</label>
                  <StarInput value={reviewRating} onChange={setReviewRating} />
                </div>
                <div className="form-group">
                  <label htmlFor="comment">Comment (optional)</label>
                  <textarea id="comment" rows={2} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
                </div>
                <button className="btn btn-primary btn-sm" type="submit" disabled={submittingReview}>
                  {myExistingReview ? 'Update review' : 'Submit review'}
                </button>
              </form>
            )}

            {recipe.reviews.length === 0 ? (
              <p>No reviews yet, be the first to try it and leave one.</p>
            ) : (
              <div style={{ marginTop: 16 }}>
                {recipe.reviews.map((r) => (
                  <div className="review" key={r.id}>
                    <div className="review-head">
                      <span className="review-author" style={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar username={r.username} color={r.authorColor} size={24} />{r.username}
                      </span>
                      <span className="stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    {r.comment && <p style={{ margin: 0 }}>{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 44 }}>
            <h2>Discussion ({recipe.comments.length})</h2>

            {user && (
              <form onSubmit={handleCommentSubmit} style={{ margin: '20px 0' }}>
                <div className="form-group">
                  <textarea
                    rows={2}
                    placeholder="Ask a question or share a tip..."
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                  />
                </div>
                <button className="btn btn-gold btn-sm" type="submit" disabled={postingComment}>
                  {postingComment ? 'Posting...' : 'Post comment'}
                </button>
              </form>
            )}

            {topLevelComments.length === 0 ? (
              <p>No comments yet.</p>
            ) : (
              <div>
                {topLevelComments.map((c) => (
                  <div className="comment" key={c.id}>
                    <div className="comment-head">
                      <span className="comment-author" style={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar username={c.username} color={c.authorColor} size={24} />{c.username}
                      </span>
                    </div>
                    <p style={{ margin: 0 }}>{c.body}</p>
                    {repliesFor(c.id).map((reply) => (
                      <div className="comment-reply" key={reply.id}>
                        <div className="comment-head">
                          <span className="comment-author" style={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar username={reply.username} color={reply.authorColor} size={22} />{reply.username}
                          </span>
                        </div>
                        <p style={{ margin: 0 }}>{reply.body}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="related-section">
          <h2>More {recipe.category.toLowerCase()} recipes</h2>
          <div className="recipe-grid">
            {related.map((r) => <RecipeCard key={r.id} recipe={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}
