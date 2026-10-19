import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      Oshudh · built for the Meta Global AI Developer Hackathon
      <nav className="footer-nav">
        <Link href="/privacy">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms">Terms</Link>
      </nav>
    </footer>
  );
}
