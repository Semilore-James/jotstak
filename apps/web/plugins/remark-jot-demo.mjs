// Turns ```jot-demo fenced blocks into a rendered example at build time.
//
// The obvious approach was an Astro component, and it does not scale: Astro
// compiles each component instance, and ~38 of them exhausted a 4GB heap. This
// does the same job in the Markdown pipeline instead — one function call per
// fence, producing a plain HTML node. No JSX, no component instances, and every
// docs page can be ordinary .md rather than .mdx.
//
// Authors write:
//
//   ```jot-demo
//   @panel(title="Hello")
//     body: text
//   ```
//
// and get the source above the real rendered output — a sheet of A4, laid out
// exactly as it prints. (They sat side by side until the page model landed;
// half a content column is not a page, and every figure arrived shrunk.)

import { render } from "@jotstak/renderer";

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function remarkJotDemo() {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      if (node.type !== "code" || !parent || index === null) return;
      if (node.lang !== "jot-demo") return;

      const code = node.value;
      const { html } = render(code, { mode: "notebook" });

      // `not-content` is Starlight's escape hatch, and a demo needs it: Starlight
      // gives every element that follows a sibling `margin-top: 1rem`, at any
      // depth. Inside a rendered .jot document that is silent poison — it lands
      // between grid children, off the 28px ruling, and a dir=split tree measured
      // 380px instead of 112px. The demo is our design system, not Starlight's
      // prose, so nothing from theirs should reach it.
      parent.children[index] = {
        type: "html",
        value:
          `<div class="jot-demo not-content">` +
          `<pre class="jot-demo-src"><code>${escape(code)}</code></pre>` +
          `<div class="jot-demo-out" data-mode="notebook">${html}</div>` +
          `</div>`,
      };
    });
  };
}

/** Minimal depth-first walk; avoids pulling in unist-util-visit for one use. */
function visit(node, fn, parent = null, index = null) {
  fn(node, index, parent);
  if (!Array.isArray(node.children)) return;
  // Walk a copy: fn may replace the node at `i`.
  const children = [...node.children];
  for (let i = 0; i < children.length; i++) visit(children[i], fn, node, i);
}
