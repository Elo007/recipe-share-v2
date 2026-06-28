export default function StarRating({ rating, reviewCount }) {
  if (!rating) {
    return <span style={{ color: 'var(--ink-soft)', fontSize: '0.85rem', fontWeight: 600 }}>No reviews yet</span>;
  }

  const fullStars = Math.round(rating);
  const stars = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);

  return (
    <span className="stars" title={`${rating} out of 5`}>
      {stars}{' '}
      <span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>
        {rating} ({reviewCount})
      </span>
    </span>
  );
}
