// サーバーサイドセッションの有効期限設定（プロダクトポリシー）
// Firebase のセッション/リフレッシュトークン寿命とは独立した製品決定。

// アイドルタイムアウト: 最終使用から5日間。
// 各リクエストで last_used_at を更新し idle_expires_at を延長するが、
// 絶対タイムアウトを超えることはない（LEAST でクリップ）。
const IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 5; // 5日

// 絶対タイムアウト: セッション作成から14日間。
// これを超えてセッションを延長することはできない。
// Firebase リフレッシュトークンの寿命とは無関係（リフレッシュトークンは不定期限の場合がある）。
const ABSOLUTE_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 14; // 14日

// last_used_at の更新スロットル: 5分以内の重複更新を回避
const LAST_USED_UPDATE_INTERVAL_MS = 1000 * 60 * 5; // 5分

export { IDLE_TIMEOUT_MS, ABSOLUTE_TIMEOUT_MS, LAST_USED_UPDATE_INTERVAL_MS };
