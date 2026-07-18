export type Branch = {
  id: string;
  name: string;
  code: string;
  address: string | null;
};

export type Terminal = {
  id: string;
  name: string;
  slug: string;
  branch: Branch;
};

export type PublicTerminal = {
  name: string;
  slug: string;
  branch: {
    name: string;
    code: string;
    merchant: {
      name: string;
    };
  };
};

export type ClaimResponse = {
  claimToken: string;
  receiptPath: string;
};

export type TicketItem = {
  id?: string;
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
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER";
  activationExpiresAt: string | null;
  claimedAt: string | null;
  accessToken: string | null;
  createdAt: string;
  merchant: {
    name: string;
  };
  branch: Branch;
  terminal: Omit<Terminal, "branch">;
  items: TicketItem[];
  events: TicketEvent[];
};

export type PublicTicket = {
  folio: string;
  status: "CLAIMED";
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER";
  claimedAt: string;
  createdAt: string;
  merchant: {
    name: string;
  };
  branch: {
    name: string;
    address: string | null;
  };
  terminal: {
    name: string;
  };
  items: Array<Omit<TicketItem, "id">>;
};
