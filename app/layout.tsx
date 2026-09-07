import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Lastmile",
  description: "Voice-first delivery exception reporting for last-mile drivers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F4F5F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#F4F5F2" }}>{children}</body>
    </html>
  );
}
