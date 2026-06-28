import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import RecipeCard from '../components/RecipeCard';

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const isOwnProfile = currentUser && Number(id) === currentUser.id;

  async function load() {
    setLoading(true);
    const data = await api.getUser(id);
    setProfile(data);
    setBioDraft(data.bio || '');
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveBio() {
    setSaving(true);
    await api.updateProfile({ bio: bioDraft });
    setEditingBio(false);
    await load();
    setSaving(false);
  }

  if (loading) return <p className="loading-text">Loading profile...</p>;
  if (!profile) return <p className="loading-text">User not found.</p>;

  const paidCount = profile.recipes.filter((r) => r.is_paid).length;

  return (
    <div className="page">
      <div className="profile-header">
        <div className="profile-avatar" style={{ background: profile.avatarColor || 'var(--ember)' }}>
          {profile.username[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h1>{profile.username}</h1>
          {!editingBio && <p>{profile.bio || (isOwnProfile ? 'Add a short bio to tell people about yourself.' : '')}</p>}
          {paidCount > 0 && (
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--berry)' }}>
              {paidCount} chef-exclusive recipe{paidCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
        {isOwnProfile && !editingBio && (
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/dashboard" className="btn btn-gold btn-sm">Earnings dashboard</Link>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingBio(true)}>Edit bio</button>
          </div>
        )}
      </div>

      {editingBio && (
        <div className="form-group" style={{ maxWidth: 480, marginBottom: 24 }}>
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" rows={3} value={bioDraft} onChange={(e) => setBioDraft(e.target.value)} />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={saveBio} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditingBio(false); setBioDraft(profile.bio || ''); }}>Cancel</button>
          </div>
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>
        {isOwnProfile ? 'Your recipes' : `${profile.username}'s recipes`} ({profile.recipes.length})
      </h2>

      {profile.recipes.length === 0 ? (
        <div className="empty-state"><h3>No recipes posted yet.</h3></div>
      ) : (
        <div className="recipe-grid">
          {profile.recipes.map((r) => <RecipeCard key={r.id} recipe={{ ...r, unlocked: true }} />)}
        </div>
      )}
    </div>
  );
}
