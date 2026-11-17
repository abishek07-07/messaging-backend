/**
 * Minimal public shape of a user embedded in friendship and block views.
 *
 * Only fields safe to expose to clients are included; internal ids, emails,
 * and password hashes never appear here.
 */
export interface FriendUserEntity {
  /** Public UUID exposed by the API. */
  public_id: string;

  username: string;
  display_name: string | null;
  avatar_url: string | null;

  /** Base64 X25519 public key used for end-to-end encryption. */
  public_key: string | null;
}
