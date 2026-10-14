// Phase 18: the text-group engine (文字组). A text group is a *construction*: a small tree of columns and rows whose
// leaves are text slots and marks. Sizes are multiples of a base unit A (the smallest text in the group), gaps are in A,
// display type is set tight. A construction is realised once at A = 1 and scaled exactly to the room it is given
// (every length is linear in A), so the same construction serves a corner label and a full-width masthead.

/** where a text leaf takes its words from (copy.ts fills them from the poster's texts) */
export type Slot =
  | 'title' // the headline, in its own script
  | 'title.cn' | 'title.en' // the headline's Han / Latin side when the copy is bilingual (or a Latin echo of a Han title)
  | 'sub' // the explanation / subtitle
  | 'num' // the key number: a date, a time, a price, an issue number
  | 'num.unit' // the unit or suffix of the number (¥, %, 折, st, 日)
  | 'date' // a date line (2026.12.05 / 12月5日)
  | 'item' // one info group (time + act, label + note); `idx` picks which
  | 'item.note'
  | 'meta' // venue, price, organiser…; `idx` picks which
  | 'para' // a small paragraph used as a line element (its content barely matters)
  | 'label' // a short word or two (≤ 4 Han / ≤ 14 Latin)
  | 'year' // a four-digit year from the copy
  | 'lit'; // literal text given by the construction (a symbol, "No.", "×")

export type Face = 'display' | 'text' | 'caption' | 'mono';
export type Weight = 'black' | 'bold' | 'medium' | 'regular' | 'light';

export interface TextLeaf {
  t: 'text';
  slot: Slot;
  /** size in units of A */
  k: number;
  idx?: number;
  lit?: string;
  face?: Face;
  w?: Weight;
  case?: 'upper' | 'lower' | 'title';
  /** tracking in 1/1000 em (display default −30, small text default −10) */
  track?: number;
  /** line advance as a multiple of the size (display default 0.95, small text 1.15) */
  lead?: number;
  /** break into this many lines (semantic breaks for Han, balanced words for Latin) */
  lines?: number;
  /** wrap at this measure (units of A): small paragraphs */
  wrap?: number;
  /** 'width' = scale the size so the line spans the parent column (an EN line set to the CN title's width);
   *  'track' = keep the size and letterspace the line to the column width (a short Han line in a justified brick) */
  fit?: 'width' | 'track';
  /** for literal leaves: the slot the words came from (so the auxiliary bands do not repeat them) */
  of?: Slot;
  /** an outline instead of a fill */
  outline?: boolean;
  /** shift against the row's alignment, in units of A (a #N raised half a line) */
  dy?: number;
  /** 'v' = a vertical Han column; 'rot' = Latin rotated 90° (reads bottom to top) */
  dir?: 'v' | 'rot';
  accent?: boolean;
  italic?: boolean;
  /** optional: dropped when its slot is empty */
  opt?: boolean;
  /** cap the characters taken from the slot (labels, small paragraphs) */
  max?: number;
}

export type MarkKind =
  | 'dot' | 'ring' | 'rule' | 'vrule' | 'slash' | 'star' | 'hash' | 'times' | 'arrow' | 'plus' | 'barcode' | 'nosign' | 'square' | 'tri';

export interface MarkLeaf {
  t: 'mark';
  m: MarkKind;
  /** size in units of A (the mark's height; a rule's thickness is derived) */
  k: number;
  /** length for rules (units of A); 'fill' = the parent column's width */
  len?: number | 'fill';
  accent?: boolean;
  opt?: boolean;
}

export type FrameKind = 'box' | 'pill' | 'fill' | 'bracket' | 'corner' | 'paren' | 'under' | 'over' | 'side' | 'circle' | 'disc' | 'hl';

export interface Frame {
  f: FrameKind;
  /** padding in units of A */
  pad?: number;
  accent?: boolean;
}

export interface BoxNode {
  t: 'box';
  /** col = stacked, row = side by side */
  dir: 'col' | 'row';
  /** col: horizontal alignment of the children; row: vertical alignment ('base' = shared baseline of the first lines) */
  al?: 'start' | 'center' | 'end' | 'base';
  /** distance between children in units of A */
  gap?: number;
  kids: GNode[];
  frame?: Frame;
  opt?: boolean;
  /** shift this child against its siblings' alignment edge, in units of A (an indent, a hanging number) */
  dx?: number;
  dy?: number;
  /** label lock: scale this column so it stands exactly as tall as the cap height of the row's tallest element */
  lock?: boolean;
  /** a row that spans its column's width: cells spread to both edges, or a `rule` with len 'fill' takes the rest
   *  (justify by gap / rule-filled rows, 两端 / 规线补齐) */
  fill?: boolean;
}

export type GNode = TextLeaf | MarkLeaf | BoxNode;

/** what a generator sees: the copy and the type stream */
export interface GenIn { copy: import('./copy').Copy; r: import('../rng').Rng; shape: 'tall' | 'square' | 'wide' | 'band' }

export interface Construction {
  id: string;
  /** build the tree for this copy (content-aware constructions: line breaks, fillers, label locks); null = unsuitable */
  gen?: (g: GenIn) => BoxNode | null;
  /** a short human label (zh / en) shown in scene info and the CLI */
  zh: string;
  en: string;
  /** slots that must have content for the construction to be used */
  needs: Slot[];
  root?: BoxNode;
  /** an intrinsic shape class, so the page picks constructions that suit the room: tall, square, wide, band (very wide) */
  shape: 'tall' | 'square' | 'wide' | 'band';
  /** layout families it suits */
  tags?: string[];
  /** relative weight in the draw */
  wt?: number;
}
