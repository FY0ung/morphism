// Single source of truth for app routes. Reference these instead of raw strings.
// Morphism IS the root route — rendered by src/app/(morphism)/page.tsx.
const route = {
  morphism: {
    index: "/",
  },
} as const;

export { route };
