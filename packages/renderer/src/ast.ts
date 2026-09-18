// AST node types for .jot.
//
// The AST represents MEANING, not syntax. `# Overview` and `@heading Overview`
// are the same document, so they produce the same node. The renderer therefore
// has one code path per concept, never one per spelling.

export interface Position {
  /** 0-based line in the source. */
  line: number;
  /** 0-based column of the first non-whitespace character. */
  column: number;
}

/** A `key: value` line in a block body, with any deeper lines as children. */
export interface Field {
  key: string;
  value: string;
  children: TreeNode[];
  position: Position;
}

/** A line in an indentation-derived hierarchy. */
export interface TreeNode {
  text: string;
  children: TreeNode[];
  position: Position;
}

/** A block body, shaped by the primitive's `bodyShape` in the schema. */
export type BlockBody =
  | { shape: "none" }
  | { shape: "plain"; lines: string[] }
  | { shape: "keyed"; fields: Field[] }
  | { shape: "indented"; roots: TreeNode[] }
  | { shape: "mixed"; fields: Field[]; roots: TreeNode[] };

export interface DocumentNode {
  type: "document";
  children: Node[];
  position: Position;
}

/** Any `@primitive` that has no dedicated node type below. */
export interface BlockNode {
  type: "block";
  /** Canonical primitive name (aliases already resolved). */
  name: string;
  /** The name as actually written, when it differed — e.g. `warn` for `@warn`. */
  writtenAs?: string;
  params: Record<string, string>;
  /** Bare text after the shortcode and params. */
  title: string;
  body: BlockBody;
  position: Position;
}

export interface HeadingNode {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
  params: Record<string, string>;
  position: Position;
}

export interface ListNode {
  type: "list";
  ordered: boolean;
  items: TreeNode[];
  position: Position;
}

export interface DividerNode {
  type: "divider";
  style: string;
  position: Position;
}

export interface QuoteNode {
  type: "quote";
  lines: string[];
  params: Record<string, string>;
  position: Position;
}

export interface MarginNoteNode {
  type: "margin_note";
  lines: string[];
  params: Record<string, string>;
  position: Position;
}

/** A run of plain prose. Handed to markdown-it for inline formatting. */
export interface MarkdownNode {
  type: "markdown";
  text: string;
  position: Position;
}

export type Node =
  | DocumentNode
  | BlockNode
  | HeadingNode
  | ListNode
  | DividerNode
  | QuoteNode
  | MarginNoteNode
  | MarkdownNode;
