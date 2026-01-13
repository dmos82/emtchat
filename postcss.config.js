module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    // Note: cssnano removed - Next.js handles CSS minification in production builds
    // Adding it here conflicts with Next.js's internal CSS handling
  },
};
