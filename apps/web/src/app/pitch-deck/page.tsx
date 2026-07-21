import type { Metadata } from "next";
import { PitchDeck } from "@/components/pitch-deck";

export const metadata: Metadata = {
  title: "SynapseFi — Pitch Deck",
  description: "Uncollateralized USDC credit for AI agents, priced by what they earn — on Arc.",
};

export default function PitchDeckPage() {
  return <PitchDeck />;
}
