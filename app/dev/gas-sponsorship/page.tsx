import { notFound } from "next/navigation";
import { GasSponsorshipDiagnostics } from "./diagnostics";

/** Dev-only diagnostics for issue #33 (gas sponsorship). Never served in production builds. */
export default function GasSponsorshipPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <GasSponsorshipDiagnostics />;
}
