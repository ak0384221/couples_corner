// All visible text lives here, so Bangla can be added later as lib/text/bn.ts.
// Add strings per phase; do not hard-code text in components.
export const en = {
  app: {
    name: "Our little corner",
    tagline: "Just two keys exist. Yours and mine.",
  },
  nav: { memories: "Memories", dates: "Dates", profile: "Profile" },
  login: {
    title: "Our little corner",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "Your secret word",
    submit: "Open our memories",
    footnote: "Private and invite-only. No sign-ups.",
  },
  home: { setupDone: "Project setup is ready." },
  dev: { loginComingSoon: "Sign-in arrives in Phase 2." },
  health: {
    title: "Health check",
    configured: "Environment variables are set",
    reachable: "Supabase is reachable",
    signupsOff: "Public sign-ups are off",
    secretKey: "Server secret key is set",
    yes: "Yes",
    no: "No",
    unknown: "Could not tell",
  },
} as const;
