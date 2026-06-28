// Small colored circle with a user's initial, used next to usernames in
// reviews, comments, and profile headers.
export default function Avatar({ username, color, size = 28 }) {
  if (!username) return null;
  return (
    <span
      className="avatar-chip"
      style={{ background: color || 'var(--ember)', width: size, height: size, fontSize: size * 0.4 }}
    >
      {username[0].toUpperCase()}
    </span>
  );
}
