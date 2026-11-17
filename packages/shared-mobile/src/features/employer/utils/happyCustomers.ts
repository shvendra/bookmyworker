/** Same definition the server uses for the "no subscription yet" segment: never subscribed, never had an expiry. */
export const isNeverSubscribed = (
  u?: { isSubscribed?: boolean; lastsubscriptionDate?: string | null; subscriptionExpery?: string | null } | null,
): boolean => !!u && !u.isSubscribed && !u.lastsubscriptionDate && !u.subscriptionExpery;
