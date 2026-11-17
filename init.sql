
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive usernames/emails


-- =====================================================================
-- 1. ENUM TYPES
-- =====================================================================
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked', 'declined');

CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'audio', 'video', 'system');

CREATE TYPE content_encoding AS ENUM ('plaintext', 'e2ee', 'server_enc');

CREATE TYPE conversation_type AS ENUM ('direct', 'group');

CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');

CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'declined', 'revoked');

CREATE TYPE group_action AS ENUM (
    'member_added',
    'member_removed',
    'member_left',
    'role_changed',
    'title_changed',
    'avatar_changed'
);


-- =====================================================================
-- 2. HELPER: updated_at trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================================================
-- 3. USERS
-- =====================================================================
CREATE TABLE users (
    id             BIGSERIAL   PRIMARY KEY,
    public_id      UUID        NOT NULL DEFAULT gen_random_uuid(),
    username       CITEXT      NOT NULL,
    email          CITEXT      NOT NULL,
    password_hash  TEXT        NOT NULL,
    display_name   TEXT,
    avatar_url     TEXT,
    -- Future E2EE: public key material (nullable for now)
    public_key     TEXT,
    key_version    INT         NOT NULL DEFAULT 0,
    is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
    last_seen_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT users_public_id_key  UNIQUE (public_id),
    CONSTRAINT users_username_key   UNIQUE (username),
    CONSTRAINT users_email_key      UNIQUE (email)
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email    ON users (email);

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =====================================================================
-- 4. USER BLOCKS
-- =====================================================================
CREATE TABLE user_blocks (
    blocker_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_id   UUID        NOT NULL DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT user_blocks_public_id_key UNIQUE (public_id),
    CONSTRAINT no_self_block             CHECK  (blocker_id <> blocked_id)
);


-- =====================================================================
-- 5. FRIENDSHIPS
--    Canonical pair (user_low_id, user_high_id) is auto-derived
--    from requester/addressee to prevent duplicates.
-- =====================================================================
CREATE TABLE friendships (
    id            BIGSERIAL        PRIMARY KEY,
    public_id     UUID             NOT NULL DEFAULT gen_random_uuid(),
    requester_id  BIGINT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id  BIGINT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_low_id   BIGINT           GENERATED ALWAYS AS (LEAST(requester_id, addressee_id))    STORED,
    user_high_id  BIGINT           GENERATED ALWAYS AS (GREATEST(requester_id, addressee_id)) STORED,
    status        friendship_status NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),

    CONSTRAINT friendships_public_id_key UNIQUE (public_id),
    CONSTRAINT friendships_unique_pair   UNIQUE (user_low_id, user_high_id),
    CONSTRAINT no_self_friend            CHECK  (requester_id <> addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships (requester_id);
CREATE INDEX idx_friendships_addressee ON friendships (addressee_id);
CREATE INDEX idx_friendships_low       ON friendships (user_low_id);
CREATE INDEX idx_friendships_high      ON friendships (user_high_id);

CREATE TRIGGER trg_friendships_updated
    BEFORE UPDATE ON friendships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =====================================================================
-- 6. CONVERSATIONS
-- =====================================================================
CREATE TABLE conversations (
    id          BIGSERIAL         PRIMARY KEY,
    public_id   UUID              NOT NULL DEFAULT gen_random_uuid(),
    type        conversation_type NOT NULL DEFAULT 'direct',
    title       TEXT,
    avatar_url  TEXT,
    created_by  BIGINT            REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ       NOT NULL DEFAULT now(),

    CONSTRAINT conversations_public_id_key UNIQUE (public_id)
);

CREATE INDEX idx_conversations_updated ON conversations (updated_at DESC);

CREATE TRIGGER trg_conversations_updated
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =====================================================================
-- 7. MESSAGES
--    Defined BEFORE conversation_members so that
--    conversation_members.last_read_message_id can FK to it.
-- =====================================================================
CREATE TABLE messages (
    id                 BIGSERIAL        PRIMARY KEY,
    public_id          UUID             NOT NULL DEFAULT gen_random_uuid(),
    conversation_id    BIGINT           NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id          BIGINT           REFERENCES users(id) ON DELETE SET NULL,
    client_message_id  UUID,
    type               message_type     NOT NULL DEFAULT 'text',
    content            TEXT,
    encoding           content_encoding NOT NULL DEFAULT 'plaintext',
    crypto_metadata    JSONB,
    reply_to_id        BIGINT           REFERENCES messages(id) ON DELETE SET NULL,
    deleted_at         TIMESTAMPTZ,
    edited_at          TIMESTAMPTZ,
    created_at         TIMESTAMPTZ      NOT NULL DEFAULT now(),

    CONSTRAINT messages_public_id_key           UNIQUE (public_id),
    CONSTRAINT messages_client_message_unique   UNIQUE (sender_id, client_message_id)
);

CREATE INDEX idx_messages_conv_created
    ON messages (conversation_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_messages_sender ON messages (sender_id);


-- =====================================================================
-- 8. CONVERSATION MEMBERS
-- =====================================================================
CREATE TABLE conversation_members (
    id                     BIGSERIAL   PRIMARY KEY,
    public_id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    conversation_id        BIGINT      NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id                BIGINT      NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    role                   member_role NOT NULL DEFAULT 'member',
    joined_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at                TIMESTAMPTZ,
    is_muted               BOOLEAN     NOT NULL DEFAULT FALSE,
    is_pinned              BOOLEAN     NOT NULL DEFAULT FALSE,
    last_read_message_id   BIGINT      REFERENCES messages(id) ON DELETE SET NULL,

    CONSTRAINT conversation_members_public_id_key UNIQUE (public_id),
    CONSTRAINT conversation_members_unique        UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_conv_members_user ON conversation_members (user_id);

-- Only one owner per conversation (partial unique)
CREATE UNIQUE INDEX one_owner_per_group
    ON conversation_members (conversation_id)
    WHERE role = 'owner';


-- =====================================================================
-- 9. MESSAGE ATTACHMENTS
-- =====================================================================
CREATE TABLE message_attachments (
    id               BIGSERIAL   PRIMARY KEY,
    public_id        UUID        NOT NULL DEFAULT gen_random_uuid(),
    message_id       BIGINT      NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    storage_key      TEXT        NOT NULL,
    file_name        TEXT,
    mime_type        TEXT,
    size_bytes       BIGINT,
    encryption_meta  JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT message_attachments_public_id_key UNIQUE (public_id)
);

CREATE INDEX idx_attachments_message ON message_attachments (message_id);


-- =====================================================================
-- 10. MESSAGE RECEIPTS
-- =====================================================================
CREATE TABLE message_receipts (
    message_id  BIGINT      NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     BIGINT      NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    public_id   UUID        NOT NULL DEFAULT gen_random_uuid(),
    read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (message_id, user_id),
    CONSTRAINT message_receipts_public_id_key UNIQUE (public_id)
);

CREATE INDEX idx_receipts_user ON message_receipts (user_id);


-- =====================================================================
-- 11. CONVERSATION INVITES
-- =====================================================================
CREATE TABLE conversation_invites (
    id               BIGSERIAL     PRIMARY KEY,
    public_id        UUID          NOT NULL DEFAULT gen_random_uuid(),
    conversation_id  BIGINT        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    inviter_id       BIGINT        NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    invitee_id       BIGINT        NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    status           invite_status NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    responded_at     TIMESTAMPTZ,

    CONSTRAINT conversation_invites_public_id_key UNIQUE (public_id),
    CONSTRAINT conversation_invites_unique        UNIQUE (conversation_id, invitee_id)
);

-- Only one pending invite per (conversation, invitee)
CREATE UNIQUE INDEX one_pending_invite
    ON conversation_invites (conversation_id, invitee_id)
    WHERE status = 'pending';


-- =====================================================================
-- 12. CONVERSATION EVENTS (group audit log)
-- =====================================================================
CREATE TABLE conversation_events (
    id               BIGSERIAL    PRIMARY KEY,
    public_id        UUID         NOT NULL DEFAULT gen_random_uuid(),
    conversation_id  BIGINT       NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    actor_id         BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    target_id        BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    action           group_action NOT NULL,
    metadata         JSONB,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT conversation_events_public_id_key UNIQUE (public_id)
);

CREATE INDEX idx_conv_events ON conversation_events (conversation_id, created_at DESC);


-- =====================================================================
-- 13. OPTIONAL: guard the group owner from leaving without transfer
-- =====================================================================
CREATE OR REPLACE FUNCTION prevent_owner_leaving()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role = 'owner' AND NEW.left_at IS NOT NULL THEN
        RAISE EXCEPTION 'Transfer ownership before leaving the group';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_owner_leave
    BEFORE UPDATE ON conversation_members
    FOR EACH ROW EXECUTE FUNCTION prevent_owner_leaving();
    -- =====================================================================
    -- DUMMY DATA
    -- Password for every user (bcrypt): "password"
    -- =====================================================================
    -- $2a$10$XhAuyqOpK9eGf1kDuJFsUepCYIC2RA7CBOccdar0XAHHMayFyYgKC
    -- =====================================================================
    
    BEGIN;
    
    -- ---------------------------------------------------------------------
    -- 1. USERS (5)
    -- ---------------------------------------------------------------------
    INSERT INTO users (username, email, password_hash, display_name) VALUES
        ('alice',   'alice@example.com',   '$2b$10$9bYtF/jUMGmnznaFQ/8xEOM6MT.D6yoql6IbdeTP8IUhuQPpUUzrC', 'Alice Johnson'),
        ('bob',     'bob@example.com',     '$2b$10$9bYtF/jUMGmnznaFQ/8xEOM6MT.D6yoql6IbdeTP8IUhuQPpUUzrC', 'Bob Smith'),
        ('carol',   'carol@example.com',   '$2b$10$9bYtF/jUMGmnznaFQ/8xEOM6MT.D6yoql6IbdeTP8IUhuQPpUUzrC', 'Carol Davis'),
        ('dave',    'dave@example.com',    '$2b$10$9bYtF/jUMGmnznaFQ/8xEOM6MT.D6yoql6IbdeTP8IUhuQPpUUzrC', 'Dave Wilson'),
        ('eve',     'eve@example.com',     '$2b$10$9bYtF/jUMGmnznaFQ/8xEOM6MT.D6yoql6IbdeTP8IUhuQPpUUzrC', 'Eve Martinez');
    
    
    -- ---------------------------------------------------------------------
    -- 2. FRIENDSHIPS
    --    (a) alice - bob     accepted
    --    (b) alice - carol   accepted
    --    (c) bob   - carol   accepted
    --    (d) bob   - dave    pending  (request from bob)
    --    (e) carol - eve     accepted
    --    (f) alice - dave    blocked  (dave blocked by alice)
    -- user_low_id / user_high_id are GENERATED ALWAYS — omit them.
    -- ---------------------------------------------------------------------
    INSERT INTO friendships (requester_id, addressee_id, status)
    SELECT r.id, a.id, s.status::friendship_status
    FROM (VALUES
        ('alice', 'bob',   'accepted'),
        ('alice', 'carol', 'accepted'),
        ('bob',   'carol', 'accepted'),
        ('bob',   'dave',  'pending'),
        ('carol', 'eve',   'accepted'),
        ('alice', 'dave',  'blocked')
    ) AS s(rq, ad, status)
    JOIN users r ON r.username = s.rq
    JOIN users a ON a.username = s.ad;
    
    
    -- ---------------------------------------------------------------------
    -- 3. BLOCKS (matching the 'blocked' friendship above)
    -- ---------------------------------------------------------------------
    INSERT INTO user_blocks (blocker_id, blocked_id)
    SELECT b.id, u.id
    FROM (VALUES ('alice', 'dave')) AS x(blocker, blocked)
    JOIN users b ON b.username = x.blocker
    JOIN users u ON u.username = x.blocked;
    
    
    -- ---------------------------------------------------------------------
    -- 4. CONVERSATIONS
    --    c1: direct alice <-> bob
    --    c2: direct alice <-> carol
    --    c3: direct bob   <-> carol
    --    c4: group  "Weekend Trip"  — alice (owner), bob, carol, dave
    -- ---------------------------------------------------------------------
    -- One INSERT per conversation so the friendly names c1..c4 always map to
    -- the intended rows (a single multi-row INSERT has no guaranteed order).
    CREATE TEMP TABLE _named_convs (
        name TEXT PRIMARY KEY,
        id BIGINT,
        public_id UUID,
        type conversation_type,
        title TEXT
    ) ON COMMIT DROP;
    
    WITH created AS (
        INSERT INTO conversations (type, title, created_by)
        SELECT 'direct', NULL, id FROM users WHERE username = 'alice'
        RETURNING id, public_id, type, title
    )
    INSERT INTO _named_convs SELECT 'c1', id, public_id, type, title FROM created;
    
    WITH created AS (
        INSERT INTO conversations (type, title, created_by)
        SELECT 'direct', NULL, id FROM users WHERE username = 'alice'
        RETURNING id, public_id, type, title
    )
    INSERT INTO _named_convs SELECT 'c2', id, public_id, type, title FROM created;
    
    WITH created AS (
        INSERT INTO conversations (type, title, created_by)
        SELECT 'direct', NULL, id FROM users WHERE username = 'bob'
        RETURNING id, public_id, type, title
    )
    INSERT INTO _named_convs SELECT 'c3', id, public_id, type, title FROM created;
    
    WITH created AS (
        INSERT INTO conversations (type, title, created_by)
        SELECT 'group', 'Weekend Trip 🏔️', id FROM users WHERE username = 'alice'
        RETURNING id, public_id, type, title
    )
    INSERT INTO _named_convs SELECT 'c4', id, public_id, type, title FROM created;
    
    
    -- ---------------------------------------------------------------------
    -- 5. CONVERSATION MEMBERS
    -- ---------------------------------------------------------------------
    -- c1 alice-bob
    INSERT INTO conversation_members (conversation_id, user_id, role)
    SELECT c.id, u.id, 'member'::member_role
    FROM _named_convs c, users u
    WHERE c.name = 'c1' AND u.username IN ('alice','bob');
    
    -- c2 alice-carol
    INSERT INTO conversation_members (conversation_id, user_id, role)
    SELECT c.id, u.id, 'member'::member_role
    FROM _named_convs c, users u
    WHERE c.name = 'c2' AND u.username IN ('alice','carol');
    
    -- c3 bob-carol
    INSERT INTO conversation_members (conversation_id, user_id, role)
    SELECT c.id, u.id, 'member'::member_role
    FROM _named_convs c, users u
    WHERE c.name = 'c3' AND u.username IN ('bob','carol');
    
    -- c4 weekend trip group: alice owner, bob+carol admins, dave member
    INSERT INTO conversation_members (conversation_id, user_id, role)
    SELECT c.id, u.id, v.role::member_role
    FROM _named_convs c
    JOIN (VALUES
        ('alice', 'owner'),
        ('bob',   'admin'),
        ('carol', 'admin'),
        ('dave',  'member')
    ) AS v(username, role) ON TRUE
    JOIN users u ON u.username = v.username
    WHERE c.name = 'c4';
    
    
    -- ---------------------------------------------------------------------
    -- 6. MESSAGES (10+ total across conversations)
    --    client_message_id uses a fixed namespace so re-runs won't duplicate.
    -- ---------------------------------------------------------------------
    -- c1: alice <-> bob (4 messages)
    INSERT INTO messages (conversation_id, sender_id, client_message_id, type, content, created_at)
    SELECT c.id, u.id, v.cmid::uuid, 'text'::message_type, v.content, v.created_at::timestamptz
    FROM _named_convs c
    JOIN (VALUES
        ('alice', '11111111-1111-1111-1111-000000000001', 'Hey Bob! How are you?',       '2025-01-10 09:00:00+00'),
        ('bob',   '11111111-1111-1111-1111-000000000002', 'Hi Alice! Doing well, you?',  '2025-01-10 09:01:00+00'),
        ('alice', '11111111-1111-1111-1111-000000000003', 'Pretty good, thanks for asking 😄', '2025-01-10 09:02:00+00'),
        ('bob',   '11111111-1111-1111-1111-000000000004', 'Want to grab coffee later?',  '2025-01-10 09:03:00+00')
    ) AS v(sender, cmid, content, created_at) ON TRUE
    JOIN users u ON u.username = v.sender
    WHERE c.name = 'c1';
    
    -- c2: alice <-> carol (3 messages)
    INSERT INTO messages (conversation_id, sender_id, client_message_id, type, content, created_at)
    SELECT c.id, u.id, v.cmid::uuid, 'text'::message_type, v.content, v.created_at::timestamptz
    FROM _named_convs c
    JOIN (VALUES
        ('carol', '22222222-2222-2222-2222-000000000001', 'Alice, are we still on for dinner?', '2025-01-10 18:00:00+00'),
        ('alice', '22222222-2222-2222-2222-000000000002', 'Yes! 8pm at the usual place 🍝',      '2025-01-10 18:01:00+00'),
        ('carol', '22222222-2222-2222-2222-000000000003', 'Perfect, see you there!',              '2025-01-10 18:02:00+00')
    ) AS v(sender, cmid, content, created_at) ON TRUE
    JOIN users u ON u.username = v.sender
    WHERE c.name = 'c2';
    
    -- c3: bob <-> carol (2 messages)
    INSERT INTO messages (conversation_id, sender_id, client_message_id, type, content, created_at)
    SELECT c.id, u.id, v.cmid::uuid, 'text'::message_type, v.content, v.created_at::timestamptz
    FROM _named_convs c
    JOIN (VALUES
        ('bob',   '33333333-3333-3333-3333-000000000001', 'Did you see the game last night?', '2025-01-10 22:00:00+00'),
        ('carol', '33333333-3333-3333-3333-000000000002', 'Yes!! Unbelievable finish 🏀',       '2025-01-10 22:01:00+00')
    ) AS v(sender, cmid, content, created_at) ON TRUE
    JOIN users u ON u.username = v.sender
    WHERE c.name = 'c3';
    
    -- c4: group chat (6 messages, including a system one)
    INSERT INTO messages (conversation_id, sender_id, client_message_id, type, content, created_at)
    SELECT c.id, u.id, v.cmid::uuid, v.mtype::message_type, v.content, v.created_at::timestamptz
    FROM _named_convs c
    JOIN (VALUES
        ('alice', '44444444-4444-4444-4444-000000000001', 'system', 'Alice created the group',        '2025-01-09 12:00:00+00'),
        ('alice', '44444444-4444-4444-4444-000000000002', 'text',   'Hey team, ready for the trip? 🎒',  '2025-01-09 12:01:00+00'),
        ('bob',   '44444444-4444-4444-4444-000000000003', 'text',   'Absolutely! I can drive 🚗',        '2025-01-09 12:02:00+00'),
        ('carol', '44444444-4444-4444-4444-000000000004', 'text',   'I''ll bring snacks 🍪',             '2025-01-09 12:03:00+00'),
        ('dave',  '44444444-4444-4444-4444-000000000005', 'text',   'Count me in! 🏕️',                 '2025-01-09 12:04:00+00'),
        ('alice', '44444444-4444-4444-4444-000000000006', 'text',   'Great! Let''s meet at 8am Saturday', '2025-01-09 12:05:00+00')
    ) AS v(sender, cmid, mtype, content, created_at) ON TRUE
    JOIN users u ON u.username = v.sender
    WHERE c.name = 'c4';
    
    
    -- ---------------------------------------------------------------------
    -- 7. CONVERSATION EVENTS (group audit trail)
    -- ---------------------------------------------------------------------
    INSERT INTO conversation_events (conversation_id, actor_id, target_id, action, metadata)
    SELECT c.id, a.id, t.id, e.action::group_action, e.meta
    FROM _named_convs c
    JOIN (VALUES
        ('alice', 'bob',   'member_added',  '{"role":"admin"}'::jsonb),
        ('alice', 'carol', 'member_added',  '{"role":"admin"}'::jsonb),
        ('alice', 'dave',  'member_added',  '{"role":"member"}'::jsonb)
    ) AS e(actor, target, action, meta) ON TRUE
    JOIN users a ON a.username = e.actor
    JOIN users t ON t.username = e.target
    WHERE c.name = 'c4';
    
    
    -- ---------------------------------------------------------------------
    -- 8. GROUP INVITE (one pending invite for dave into c4 — just for demo)
    --    dave is already a member; this simulates a "re-invite" row that
    --    would exist before dave accepted. Skipped here to avoid a conflict
    --    with one_pending_invite; shown as a comment so you can try it.
    -- ---------------------------------------------------------------------
    -- INSERT INTO conversation_invites (conversation_id, inviter_id, invitee_id, status)
    -- SELECT c.id, a.id, t.id, 'pending'
    -- FROM _named_convs c
    -- JOIN users a ON a.username = 'alice'
    -- JOIN users t ON t.username = 'eve'
    -- WHERE c.name = 'c4';
    
    
    -- ---------------------------------------------------------------------
    -- 9. MESSAGE RECEIPTS
    --    Mark most of the alice<->bob thread as read by bob, and most of
    --    the group chat as read by everyone except the last message.
    -- ---------------------------------------------------------------------
    -- bob reads alice's messages in c1
    INSERT INTO message_receipts (message_id, user_id)
    SELECT m.id, u.id
    FROM messages m
    JOIN _named_convs c ON c.id = m.conversation_id AND c.name = 'c1'
    JOIN users sender ON sender.id = m.sender_id AND sender.username = 'alice'
    JOIN users u ON u.username = 'bob'
    ON CONFLICT DO NOTHING;
    
    -- alice reads bob's messages in c1
    INSERT INTO message_receipts (message_id, user_id)
    SELECT m.id, u.id
    FROM messages m
    JOIN _named_convs c ON c.id = m.conversation_id AND c.name = 'c1'
    JOIN users sender ON sender.id = m.sender_id AND sender.username = 'bob'
    JOIN users u ON u.username = 'alice'
    ON CONFLICT DO NOTHING;
    
    
    -- ---------------------------------------------------------------------
    -- 10. BUMP last_read_message_id on conversation_members
    --     (so unread counts look sensible)
    -- ---------------------------------------------------------------------
    -- c1: bob and alice have read everything up to the latest message
    UPDATE conversation_members cm
       SET last_read_message_id = (
           SELECT max(m.id) FROM messages m WHERE m.conversation_id = cm.conversation_id
       )
      FROM _named_convs c
     WHERE cm.conversation_id = c.id
       AND c.name = 'c1';
    
    -- c4: everyone except alice has read up to the 5th message
    UPDATE conversation_members cm
       SET last_read_message_id = (
           SELECT m.id
           FROM messages m
           JOIN _named_convs c ON c.id = m.conversation_id AND c.name = 'c4'
           ORDER BY m.id DESC
           OFFSET 1 LIMIT 1
       )
      FROM _named_convs c
     WHERE cm.conversation_id = c.id
       AND c.name = 'c4'
       AND cm.user_id <> (SELECT id FROM users WHERE username = 'alice');
    
    
    COMMIT;