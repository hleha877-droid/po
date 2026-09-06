import "./globals.css";
import { AppProvider } from "@/components/AppProvider";

export const metadata = {
  title: "PodMind AI — Turn any PDF into a podcast",
  description: "PodMind AI transforms PDF documents into natural AI-generated podcasts. Listen, download and share.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="antialiased">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
