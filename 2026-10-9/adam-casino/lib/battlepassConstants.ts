/* Pass constants shared with the client (the Alces Pass page) without pulling the node:fs-backed
   battle pass store into the browser bundle. Keep in sync with lib/battlepass.ts. */

export const BATTLEPASS_LEVELS = 40;
/** XP needed per level (flat ladder — level N starts at (N - 1) * XP_PER_LEVEL). */
export const XP_PER_LEVEL = 250;
/** XP awarded per moose buck staked on a settled game bet. */
export const XP_PER_BUCK = 1;
/** Premium track unlock price, debited through the banking service. */
export const PREMIUM_PRICE = 750;
/** The top level, whose premium reward is the Lord Nelson set. */
export const PREMIUM_LEVEL = BATTLEPASS_LEVELS;
