export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORISED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICTING_RESOURCE"
  | "INTERNAL_SERVER_ERROR";

export type Page<T> = {
  data: T[];
  currentPage: number;
  totalPages: number;
  limit: number;
  itemCount: number;
  itemTotal: number;
};

export type Bounty = {
  id: number;
  patron: string;
  /** The bank spells it this way too. */
  claiment: string | null;
  price: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
};

export type PublicUser = {
  id: number;
  username: string;
  balance: number;
  debt: number;
  winnings: number;
  losses: number;
};

export type BountyDraft = {
  username: string;
  password: string;
  title: string;
  description: string;
  price: number;
};

export type Credentials = {
  username: string;
  password: string;
};

/** Complete a bounty: credentials plus who the reward goes to. */
export type SettleBody = Credentials & { claiment: string };