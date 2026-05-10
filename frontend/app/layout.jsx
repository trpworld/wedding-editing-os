import "./globals.css";

export const metadata = {
  title: "Wedding Music Collection",
  description: "A mobile-first song collection app for Bengali wedding video editors."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
