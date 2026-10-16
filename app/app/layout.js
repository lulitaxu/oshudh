import "./globals.css";

export const metadata = {
  title: "Oshudh — Read your prescription",
  description:
    "Snap a photo of a handwritten prescription. Get a clean medicine list, dose schedule, and plain-language explanations.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
