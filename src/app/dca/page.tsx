import type { Metadata } from "next";
import { DcaView } from "@/components/dca/DcaView";

export const metadata: Metadata = { title: "DCA" };

export default function DcaPage() {
  return <DcaView />;
}
