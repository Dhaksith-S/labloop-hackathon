import type { Db } from "./db";
import type { NotificationRow } from "./db-types";
import { nowIso } from "./time";

export function listNotifications(db: Db, userId: string, limit = 50): NotificationRow[] {
  return db
    .prepare(
      `SELECT * FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(userId, limit) as NotificationRow[];
}

export function getUnreadNotificationCount(db: Db, userId: string): number {
  return (
    db
      .prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL")
      .get(userId) as { count: number }
  ).count;
}

export function markNotificationRead(db: Db, userId: string, notificationId: string): void {
  db.prepare(
    "UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL",
  ).run(nowIso(), notificationId, userId);
}

export function markAllNotificationsRead(db: Db, userId: string): number {
  return db
    .prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL")
    .run(nowIso(), userId).changes;
}
