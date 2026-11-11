import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Privacy Policy — Oshudh",
  description: "How Oshudh handles your prescription photos and data.",
};

export default function Privacy() {
  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
            Oshudh<small>ওষুধ</small>
          </Link>
        </div>
      </header>

      <article className="legal">
        <p className="kicker">Privacy policy</p>
        <h1>Your prescription is yours.</h1>
        <p className="legal-date">Effective 11 November 2026</p>

        <h2>What happens to your photo</h2>
        <p>
          When you scan a prescription, the photo is sent to our server and
          then to the AI provider configured for Oshudh — Google's Gemini
          API, or the Meta Model API — which reads the handwriting and
          returns a structured medicine list. That is the only thing your
          photo is used for.
        </p>

        <h2>Interaction checks</h2>
        <p>
          If you tap "Check drug interactions", the medicine names and
          strengths from your reading (not the photo) are sent again, via
          our server, to Google's Gemini API, which checks them against
          each other. Nothing else is sent with them.
        </p>

        <h2>What we keep</h2>
        <p>
          No copy of your photo or your results is kept. Oshudh has no
          accounts and no database, and we do not store prescriptions
          anywhere. Your photo and results are processed in passing by our
          server and the AI provider while your request runs, and they are
          shown only in your browser. Like any website, our server keeps
          short-lived operational logs (for example, error reports) and
          counts requests per IP address in memory to enforce rate limits;
          these are not a record of your prescriptions and are not kept as
          one.
        </p>

        <h2>The AI providers' role</h2>
        <p>
          The handwriting is read by Google Gemini on its free API tier, or
          by the Meta Model API when that provider is configured instead.
          The provider's own data-use terms apply to what is sent to it:
          Google may use content sent to its free API tier to improve its
          products. Because of this, only scan prescriptions you own or
          have explicit permission to share. Never upload someone else's
          prescription without their consent.
        </p>

        <h2>What we don't collect</h2>
        <p>
          No name, no email, no phone number, no location. We set no
          advertising or tracking cookies. We do use Vercel Web Analytics,
          a cookieless page-view counter run by our host, Vercel: it
          records which pages are visited, along with basic device and
          country-level information from the request, and never sees your
          photos, medicines, or results.
        </p>

        <h2>Children</h2>
        <p>
          If you are scanning a prescription for a child or family member,
          make sure you have the family's permission first.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes, the new version will be posted here with a
          new effective date.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about privacy:{" "}
          <a href="mailto:contact@arafatarzu.me">contact@arafatarzu.me</a>
        </p>
      </article>

      <Footer />
    </div>
  );
}
