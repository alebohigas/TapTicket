export type Branch = {
  id: string;
  name: string;
  address: string | null;
};

export type Terminal = {
  id: string;
  name: string;
  slug: string;
  branch: Branch;
};

export type TicketItem = {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type TicketEvent = {
  id: string;
  type: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  folio: string;
  status: string;
  totalCents: number;
  currency: string;
  activationExpiresAt: string | null;
  claimedAt: string | null;
  accessToken: string | null;
  createdAt: string;
  branch: Branch;
  terminal: Omit<Terminal, "branch">;
  items: TicketItem[];
  events: TicketEvent[];
};
