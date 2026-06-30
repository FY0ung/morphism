// Static, presentational data for the Home feature lives here (not in views).
export type NavItem = {
  label: string;
  href: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
];
