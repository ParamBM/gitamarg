import "./globals.css";

export const metadata = {
  title: "GitaMarg — Find your path through ancient wisdom",
  description:
    "Describe a real-life problem. GitaMarg returns a Bhagavad Gita shlok, its meaning, and personalised guidance.",
  icons: {
    icon: [{ url: "/icon.webp", type: "image/webp" }],
    shortcut: [{ url: "/icon.webp", type: "image/webp" }],
    apple: [{ url: "/icon.webp", type: "image/webp" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
