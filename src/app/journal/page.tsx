import type { Metadata } from "next";
import { JournalView } from "@/components/journal/JournalView";

export const metadata: Metadata = { title: "Journal" };

export default function JournalPage() {
  return <JournalView />;
}
