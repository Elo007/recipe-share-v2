import { useState, useEffect } from 'react';
import { api } from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMySales().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="loading-text">Loading your dashboard...</p>;

  // Group sales by recipe title so the chart shows revenue per recipe,
  // which is more useful to a creator than a flat list of transactions.
  const byRecipe = {};
  data.sales.forEach((s) => {
    byRecipe[s.recipeTitle] = (byRecipe[s.recipeTitle] || 0) + s.amount_cents / 100;
  });
  const chartData = Object.entries(byRecipe).map(([name, total]) => ({
    name: name.length > 18 ? name.slice(0, 18) + '...' : name,
    total: Math.round(total * 100) / 100,
  }));

  return (
    <div className="page">
      <span className="eyebrow">Creator dashboard</span>
      <h1>Your earnings</h1>
      <p>Test mode: these are simulated Stripe payments, no real money has changed hands.</p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{formatPrice(data.totalCents)}</div>
          <div className="stat-label">Total earned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.salesCount}</div>
          <div className="stat-label">Recipes sold</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.salesCount ? formatPrice(data.totalCents / data.salesCount) : '$0.00'}</div>
          <div className="stat-label">Average sale</div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '3px solid var(--ink)', borderRadius: 'var(--radius)', padding: 24, marginTop: 12, height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: 'Inter' }} />
              <YAxis tick={{ fontSize: 12, fontFamily: 'Inter' }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
              <Bar dataKey="total" fill="#E8590C" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <h2 style={{ marginTop: 40 }}>Sales history</h2>
      {data.sales.length === 0 ? (
        <div className="empty-state">
          <h3>No sales yet.</h3>
          <p>Mark one of your recipes as paid, and sales will show up here as people unlock it.</p>
        </div>
      ) : (
        <table className="sales-table">
          <thead>
            <tr>
              <th>Recipe</th>
              <th>Buyer</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.sales.map((s) => (
              <tr key={s.id}>
                <td>{s.recipeTitle}</td>
                <td>{s.buyerUsername}</td>
                <td>{formatPrice(s.amount_cents)}</td>
                <td>{new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
