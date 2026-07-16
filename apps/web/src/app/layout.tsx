import type { Metadata } from "next";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SynapseFi — Agent Credit Protocol",
  description:
    "Working capital for the agentic economy. Uncollateralized USDC credit lines for onchain AI agents, priced by scored revenue on Arc.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialState = cookieToInitialState(
    wagmiConfig,
    (await headers()).get("cookie"),
  );

  return (
    <html lang="en">
      <body>
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  );
}
