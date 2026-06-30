// Single source of truth for app routes. Reference these instead of raw strings.
const route = {
  main: {
    index: "/",
  },
  morphism: {
    index: "/morphism",
  },
} as const;

export { route };
