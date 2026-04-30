import "./globals.css";

export const metadata = {
  title: "DietKu Affiliates",
  description: "DietKu affiliate dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
