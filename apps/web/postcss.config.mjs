/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@stylexswc/postcss-plugin": {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: ["**/*.test.*", "**/*.test.tsx"],
      rsOptions: {
        dev: process.env.NODE_ENV !== "production",
        aliases: {
          "@/*": ["./src/*"],
        },
        unstable_moduleResolution: { type: "commonJS" },
      },
    },
  },
};

export default config;
