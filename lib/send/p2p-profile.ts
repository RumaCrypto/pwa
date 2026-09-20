import { createProfile } from "@p2pdotme/sdk/profile";

import { baseClient } from "@/lib/viem";
import { USDC_ADDRESS_BASE } from "@/lib/usdc";

const DIAMOND_ADDRESS = process.env.NEXT_PUBLIC_DIAMOND_ADDRESS as `0x${string}` | undefined;

export const p2pProfile = createProfile({
  publicClient: baseClient,
  diamondAddress: DIAMOND_ADDRESS ?? "0x0000000000000000000000000000000000000000",
  usdcAddress: USDC_ADDRESS_BASE,
});
