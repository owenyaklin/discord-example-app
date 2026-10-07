export async function cleanupExpiredGames(env) {
  return env.DB.prepare('DELETE FROM active_games WHERE expires_at <= ?')
    .bind(Date.now())
    .run();
}