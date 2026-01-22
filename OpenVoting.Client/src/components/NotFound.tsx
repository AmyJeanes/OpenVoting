import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <section className="card">
      <h2>Page not found</h2>
      <p className="muted">The link you followed is not available. Head back to the home page.</p>
      <Link className="primary" to="/">Go home</Link>
    </section>
  );
}
