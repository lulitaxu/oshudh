import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Terms of Use — Oshudh",
  description: "The terms for using Oshudh.",
};

export default function Terms() {
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
        <p className="kicker">Terms of use</p>
        <h1>Read carefully, then verify with a human.</h1>
        <p className="legal-date">Effective 19 October 2026</p>

        <h2>Not medical advice</h2>
        <p>
          Oshudh is a reading aid. It transcribes handwriting; it does not
          diagnose, prescribe, or advise. AI can misread prescriptions.
          Always verify every medicine, dose, and schedule with your
          pharmacist or doctor before taking anything. If anything looks
          wrong or unclear, trust the paper prescription and your pharmacist,
          not this app.
        </p>

        <h2>Your responsibility</h2>
        <p>
          Only upload prescriptions you own or have explicit permission to
          share. You are responsible for checking the results before acting
          on them.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Do not abuse the service, attempt to disrupt it, or use it for
          anything unlawful. Automated or bulk uploading is not allowed.
        </p>

        <h2>No warranties</h2>
        <p>
          Oshudh is provided as is, without warranties of any kind. We do
          not guarantee that readings will be accurate, complete, or
          available at all times.
        </p>

        <h2>Liability</h2>
        <p>
          To the maximum extent permitted by law, we are not liable for any
          harm arising from your use of or reliance on Oshudh, including
          reliance on a misread prescription. This is why the app tells you
          to verify with your pharmacist.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may change. Continued use of Oshudh after changes are
          posted means you accept the new terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms:{" "}
          <a href="mailto:rarafat735@proton.me">rarafat735@proton.me</a>
        </p>
      </article>

      <Footer />
    </div>
  );
}
