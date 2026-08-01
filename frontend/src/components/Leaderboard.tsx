export function Leaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => fetchApi('/api/leaderboard/')
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="leaderboard">
      <h3> Leaderboard</h3>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>User</th>
            <th>XP</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((user) => (
            <tr key={user.username}>
              <td>
                {user.rank}
                {user.isTied && <span className="tie-indicator">*</span>}
              </td>
              <td>{user.username}</td>
              <td>{user.xp}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data?.some(u => u.isTied) && (
        <p className="tie-note">* Tied users are ordered alphabetically</p>
      )}
    </div>
  );
}