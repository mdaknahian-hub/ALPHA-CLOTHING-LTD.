export default function ProfilePage({ user, onUpdate }: any) {
  return <div className="glass-card p-6"><h2 className="font-black">{user?.name}</h2><p>{user?.email}</p></div>;
}
