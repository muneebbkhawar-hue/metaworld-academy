// Centralized PRISMA 2020 diagram color tokens.
//
// PRISMA does not publish one single mandatory hex-code specification for
// the flow diagram — the PRISMA statement group's own downloadable
// templates (prisma-statement.org) and the vast majority of published
// PRISMA 2020 figures use a gold/amber "Identification" header, a light
// blue vertical stage-label column, white flow boxes, and black borders/
// arrows. These values were derived by visual approximation from the
// reference diagram supplied for this tool (a standard PRISMA 2020 figure)
// and match that common convention. They are deliberately NOT the site's
// purple/indigo theme — the generated figure must look like a manuscript
// figure, not a MetaWorld dashboard card.
//
// Keep every diagram color here — nothing in svgBuilder.ts or the preview
// component should hard-code a hex value.
export const PRISMA_COLORS = {
  /** Gold/amber fill for the "Identification of studies..." header bar. */
  identificationHeader: "#FBBF24",
  /** Light blue fill for the vertical stage labels (Identification/Screening/Included). */
  sectionLabel: "#BFDBFE",
  /** White/near-white fill for the main flow and side (excluded/removed) boxes. */
  flowBox: "#FFFFFF",
  /** Border color used for every box in the diagram. */
  border: "#111111",
  /** Arrow stroke/fill color. */
  arrow: "#111111",
  /** Body text color inside boxes. */
  text: "#111111",
  /** Diagram canvas background (outside any box). */
  background: "#FFFFFF",
} as const;

export const PRISMA_FONT_FAMILY =
  "Arial, Helvetica, 'Segoe UI', sans-serif";
