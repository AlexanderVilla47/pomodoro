import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export type FriendPresence = "working" | "break" | "online" | "offline";

export interface FriendUser {
  friendshipId: number;
  userId: string;
  name: string;
  image: string | null;
  todaySeconds: number;
  weekSeconds: number;
  presence: FriendPresence;
}

export interface PendingRequest {
  friendshipId: number;
  userId: string;
  name: string;
  image: string | null;
  direction: "incoming" | "outgoing";
}

export async function findUserByEmail(
  sql: Sql,
  email: string
): Promise<{ id: string; name: string; image: string | null } | null> {
  const rows = await sql<Array<{ id: string; name: string; image: string | null }>>`
    SELECT id, name, image FROM "user" WHERE email = ${email} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function sendFriendRequest(
  sql: Sql,
  requesterId: string,
  addresseeId: string
): Promise<{ id: number } | null> {
  const rows = await sql<Array<{ id: number }>>`
    INSERT INTO friendships (requester_id, addressee_id, status)
    VALUES (${requesterId}, ${addresseeId}, 'pending')
    ON CONFLICT (requester_id, addressee_id) DO NOTHING
    RETURNING id
  `;
  return rows[0] ?? null;
}

export async function respondToFriendRequest(
  sql: Sql,
  id: number,
  addresseeId: string,
  action: "accept" | "decline"
): Promise<boolean> {
  if (action === "accept") {
    const rows = await sql`
      UPDATE friendships
      SET status = 'accepted'
      WHERE id = ${id} AND addressee_id = ${addresseeId} AND status = 'pending'
    `;
    return rows.count > 0;
  } else {
    const rows = await sql`
      DELETE FROM friendships
      WHERE id = ${id} AND addressee_id = ${addresseeId} AND status = 'pending'
    `;
    return rows.count > 0;
  }
}

export async function removeFriend(
  sql: Sql,
  id: number,
  userId: string
): Promise<boolean> {
  const rows = await sql`
    DELETE FROM friendships
    WHERE id = ${id}
      AND status = 'accepted'
      AND (requester_id = ${userId} OR addressee_id = ${userId})
  `;
  return rows.count > 0;
}

export async function getFriendsWithStats(
  sql: Sql,
  userId: string,
  tzOffsetMinutes: number
): Promise<FriendUser[]> {
  const rows = await sql<
    Array<{
      friendship_id: number;
      friend_id: string;
      name: string;
      image: string | null;
      today_seconds: number;
      week_seconds: number;
      presence: FriendPresence;
    }>
  >`
    SELECT
      f.id AS friendship_id,
      CASE WHEN f.requester_id = ${userId} THEN f.addressee_id ELSE f.requester_id END AS friend_id,
      u.name,
      u.image,
      COALESCE(SUM(
        CASE
          WHEN s.type = 'work'
            AND (s.started_at + make_interval(mins => ${tzOffsetMinutes}))::date
                = (NOW() + make_interval(mins => ${tzOffsetMinutes}))::date
          THEN s.actual_duration
          ELSE 0
        END
      ), 0)::int AS today_seconds,
      COALESCE(SUM(
        CASE
          WHEN s.type = 'work'
            AND (s.started_at + make_interval(mins => ${tzOffsetMinutes}))::date
                >= (
                  date_trunc('week', (NOW() + make_interval(mins => ${tzOffsetMinutes}))::date + interval '1 day')
                  - interval '1 day'
                )::date
          THEN s.actual_duration
          ELSE 0
        END
      ), 0)::int AS week_seconds,
      CASE
        WHEN p.updated_at IS NULL OR p.updated_at < NOW() - INTERVAL '120 seconds' THEN 'offline'
        WHEN p.phase = 'work' THEN 'working'
        WHEN p.phase = 'break' THEN 'break'
        ELSE 'online'
      END AS presence
    FROM friendships f
    JOIN "user" u ON u.id = CASE WHEN f.requester_id = ${userId} THEN f.addressee_id ELSE f.requester_id END
    LEFT JOIN sessions s ON s.user_id = u.id
    LEFT JOIN presence p ON p.user_id = u.id
    WHERE (f.requester_id = ${userId} OR f.addressee_id = ${userId})
      AND f.status = 'accepted'
    GROUP BY f.id, u.id, u.name, u.image, p.phase, p.updated_at
    ORDER BY week_seconds DESC, u.name ASC
  `;

  return rows.map((r) => ({
    friendshipId: Number(r.friendship_id),
    userId: r.friend_id,
    name: r.name,
    image: r.image,
    todaySeconds: Number(r.today_seconds),
    weekSeconds: Number(r.week_seconds),
    presence: r.presence,
  }));
}

export async function getPendingRequests(
  sql: Sql,
  userId: string
): Promise<PendingRequest[]> {
  const rows = await sql<
    Array<{
      friendship_id: number;
      user_id: string;
      name: string;
      image: string | null;
      direction: "incoming" | "outgoing";
    }>
  >`
    SELECT
      f.id AS friendship_id,
      u.id AS user_id,
      u.name,
      u.image,
      CASE WHEN f.addressee_id = ${userId} THEN 'incoming' ELSE 'outgoing' END AS direction
    FROM friendships f
    JOIN "user" u ON u.id = CASE WHEN f.addressee_id = ${userId} THEN f.requester_id ELSE f.addressee_id END
    WHERE (f.requester_id = ${userId} OR f.addressee_id = ${userId})
      AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `;

  return rows.map((r) => ({
    friendshipId: Number(r.friendship_id),
    userId: r.user_id,
    name: r.name,
    image: r.image,
    direction: r.direction,
  }));
}

export async function areFriends(
  sql: Sql,
  userA: string,
  userB: string
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = ${userA} AND addressee_id = ${userB})
        OR (requester_id = ${userB} AND addressee_id = ${userA})
      )
    LIMIT 1
  `;
  return rows.length > 0;
}
