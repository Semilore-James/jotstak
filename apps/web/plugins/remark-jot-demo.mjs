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
// and get the source beside the real rendered output. Append `-stacked` to the
// language to stack them instead.

import { render } from "@jotstak/renderer";

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function remarkJotDemo() {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      if (node.type !== "code" || !parent || index === null) return;
      if (node.lang !== "jot-demo" && node.lang !== "jot-demo-stacked") return;

      const stacked = node.lang === "jot-demo-stacked";
      const code = node.value;
      const { html } = render(code, { mode: "notebook" });

      parent.children[index] = {
        type: "html",
        value:
          `<div class="jot-demo${stacked ? " stacked" : ""}">` +
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
