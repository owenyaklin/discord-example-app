CREATE TABLE IF NOT EXISTS active_games (
  game_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  object_name TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);