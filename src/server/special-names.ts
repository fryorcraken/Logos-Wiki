export const SPECIAL_TITLES: Record<string, string> = {
  AllPages: "All pages",
  Categories: "Categories",
  Contributions: "User contributions",
  CreateAccount: "Create account",
  ListFiles: "File list",
  ListUsers: "User list",
  Log: "Logs",
  PrefixIndex: "All pages with prefix",
  Random: "Random page",
  RecentChanges: "Recent changes",
  RecentChangesLinked: "Related changes",
  Search: "Search",
  SpecialPages: "Special pages",
  TrustedEditors: "Trusted editors",
  Upload: "Upload file",
  UserLogin: "Log in",
  UserLogout: "Log out",
  WhatLinksHere: "What links here",
};

export const SPECIAL_PAGES = new Set(Object.keys(SPECIAL_TITLES));

const ALIASES: Record<string, string> = { allpages: "AllPages", randompage: "Random", login: "UserLogin", logout: "UserLogout", contribs: "Contributions", listusers: "ListUsers" };

export function canonicalSpecial(name: string) {
  const lower = name.toLowerCase();
  return [...SPECIAL_PAGES].find((n) => n.toLowerCase() === lower) ?? ALIASES[lower] ?? null;
}
