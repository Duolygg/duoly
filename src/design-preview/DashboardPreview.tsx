import Dashboard from '../design-reference/components/Dashboard.jsx';

export default function DashboardPreview() {
  const user = {
    name: 'Sample Player',
    email: 'player@example.invalid',
    image: '/assets/avatars/avatar-1.png',
    provider: 'preview',
    role: 'customer',
  };
  return <Dashboard user={user} />;
}
