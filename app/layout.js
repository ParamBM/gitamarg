import "./globals.css";

export const metadata = {
  title: "GitaMarg — Find your path through ancient wisdom",
  description:
    "Describe a real-life problem. GitaMarg returns a Bhagavad Gita shlok, its meaning, and personalised guidance.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
