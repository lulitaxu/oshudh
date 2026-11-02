import { Fraunces } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "Oshudh — Read your prescription",
  description:
    "Snap a photo of a handwritten prescription. Get a clean medicine list, dose schedule, and plain-language explanations.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={display.variable}>
      <head>
        <meta name="google-site-verification" content="vfhJtQno49ZKVOYaHrMhe9iaQ-y8eu8-FsjHtva1QK4" />
        <script defer src="/_vercel/insights/script.js"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
