import type { Metadata } from "next";
import { ThoughtsView } from "@/components/thoughts/ThoughtsView";

export const metadata: Metadata = { title: "Thoughts" };

export default function ThoughtsPage() {
  return <ThoughtsView />;
}
