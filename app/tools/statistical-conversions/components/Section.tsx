"use client";

// Thin re-export of the shared Accordion component (used across multiple
// tools) so existing imports of "./components/Section" in this tool keep
// working unchanged.
import Accordion from "@/app/components/Accordion";

export default function Section(props: React.ComponentProps<typeof Accordion>) {
  return <Accordion {...props} />;
}
