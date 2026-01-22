import { Link } from 'react-router-dom';

export function AuthPrompt() {
  return (
    <section className="card">
      <p className="eyebrow">Sign-in required</p>
      <h2>Please log in to continue</h2>
      <p className="muted">We automatically validate your Discord session on load. If your token expired, sign back in.</p>
      <Link className="primary" to="/">Return home</Link>
    </section>
  );
}
