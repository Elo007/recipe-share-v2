const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong.');
  }
  return data;
}

export const api = {
  // auth
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // recipes
  getRecipes: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/recipes${query ? `?${query}` : ''}`);
  },
  getRecipe: (id) => request(`/recipes/${id}`),
  getRelated: (id) => request(`/recipes/${id}/related`),
  getCategories: () => request('/recipes/categories'),
  getCuisines: () => request('/recipes/cuisines'),
  getRandomRecipe: () => request('/recipes/random'),
  createRecipe: (body) => request('/recipes', { method: 'POST', body: JSON.stringify(body) }),
  updateRecipe: (id, body) => request(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRecipe: (id) => request(`/recipes/${id}`, { method: 'DELETE' }),
  addComment: (recipeId, body) => request(`/recipes/${recipeId}/comments`, { method: 'POST', body: JSON.stringify(body) }),

  // favorites
  getFavorites: () => request('/favorites'),
  addFavorite: (recipeId) => request(`/favorites/${recipeId}`, { method: 'POST' }),
  removeFavorite: (recipeId) => request(`/favorites/${recipeId}`, { method: 'DELETE' }),
  checkFavorite: (recipeId) => request(`/favorites/check/${recipeId}`),

  // reviews
  addReview: (recipeId, body) => request(`/reviews/${recipeId}`, { method: 'POST', body: JSON.stringify(body) }),
  deleteReview: (recipeId) => request(`/reviews/${recipeId}`, { method: 'DELETE' }),

  // users
  getUser: (id) => request(`/users/${id}`),
  updateProfile: (body) => request('/users/me', { method: 'PUT', body: JSON.stringify(body) }),

  // payments
  startCheckout: (recipeId) => request(`/payments/checkout/${recipeId}`, { method: 'POST' }),
  confirmPurchase: (sessionId) => request(`/payments/confirm/${sessionId}`),
  getMyPurchases: () => request('/payments/my-purchases'),
  getMySales: () => request('/payments/my-sales'),

  // collections
  getCollections: () => request('/collections'),
  createCollection: (name) => request('/collections', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteCollection: (id) => request(`/collections/${id}`, { method: 'DELETE' }),
  getCollectionRecipes: (id) => request(`/collections/${id}/recipes`),
  addToCollection: (collectionId, recipeId) => request(`/collections/${collectionId}/recipes/${recipeId}`, { method: 'POST' }),
  removeFromCollection: (collectionId, recipeId) => request(`/collections/${collectionId}/recipes/${recipeId}`, { method: 'DELETE' }),
};
