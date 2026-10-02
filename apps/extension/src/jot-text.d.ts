// A .jot file imported as its text: the bundler's "text" loader (scripts/build.mjs)
// and the test runner's plugin (vitest.config.mts) both hand back the source.
declare module "*.jot" {
  const text: string;
  export default text;
}
