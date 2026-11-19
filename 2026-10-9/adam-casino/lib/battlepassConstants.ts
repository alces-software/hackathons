/* Pass constants shared with the client (the Alces Pass page) without pulling the node:fs-backed
   battle pass store into the browser bundle. Keep in sync with lib/battlepass.ts. */

export const BATTLEPASS_LEVELS = 40;
/** Base XP needed to clear level 1; later levels cost more (tiered ladder). */
export const XpPerLevel = (level: number): number => 250 + Math.floor(Math.pow(Math.max(1, level) - 1, 1.6) / 10) * 25;
/** XP awarded per moose buck staked on a settled game bet. */
export const XP_PER_BUCK = 1;
/** Premium track unlock price, debited through the banking service. */
export const PREMIUM_PRICE = 750;
/** The top level, whose premium reward is the Lord Nelson set. */
export const PREMIUM_LEVEL = BATTLEPASS_LEVELS;
