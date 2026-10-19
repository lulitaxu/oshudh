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
        <p className="legal-date">Effective 19 October 2026</p>

        <h2>What happens to your photo</h2>
        <p>
          When you scan a prescription, the photo is sent to our server and
          then to Google's Gemini API, which reads the handwriting and returns
          a structured medicine list. That is the only thing your photo is
          used for.
        </p>

        <h2>What we keep</h2>
        <p>
          Nothing. Oshudh has no accounts, no database, and no logs of your
          prescriptions. Your photo and your results exist only in your
          browser while the page is open. Close the tab and they are gone.
        </p>

        <h2>Google's role</h2>
        <p>
          The handwriting is read by Google Gemini on its free API tier.
          Google may use content sent to its API to improve its products.
          Because of this, only scan prescriptions you own or have explicit
          permission to share. Never upload someone else's prescription
          without their consent.
        </p>

        <h2>What we don't collect</h2>
        <p>
          No name, no email, no phone number, no location. We set no
          advertising or tracking cookies.
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
