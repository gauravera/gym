import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Fitflow",
    default: "Fitflow - Your Ultimate Gym & Fitness Platform",
  },
  description: "Fitflow is a premier SaaS platform for fitness enthusiasts and gym owners. Track workouts, manage memberships, and achieve your fitness goals.",
  keywords: ["fitness", "gym", "workout tracker", "gym management", "health", "SaaS", "Fitflow"],
  authors: [{ name: "Fitflow Team" }],
  creator: "Fitflow",
  publisher: "Fitflow Inc.",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Fitflow - Your Ultimate Gym & Fitness Platform",
    description: "Fitflow is a premier SaaS platform for fitness enthusiasts and gym owners. Track workouts, manage memberships, and achieve your fitness goals.",
    url: "https://fitflow.app",
    siteName: "Fitflow",
    images: [
      {
        url: "/icon.png", // Replace with an actual OG image URL when ready
        width: 800,
        height: 600,
        alt: "Fitflow Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fitflow - Your Ultimate Gym & Fitness Platform",
    description: "Track workouts, manage memberships, and achieve your fitness goals with Fitflow.",
    images: ["/icon.png"], // Replace with actual Twitter card image
    creator: "@fitflow",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('fitflow-theme');
                  if (saved === 'dark' || saved === 'coloured' || saved === 'light') {
                    document.documentElement.setAttribute('data-theme', saved);
                  } else {
                    document.documentElement.setAttribute('data-theme', 'dark');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
        {/* Generative Engine Optimization (GEO) JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Fitflow",
              "applicationCategory": "HealthAndFitnessApplication",
              "operatingSystem": "Web",
              "description": "Fitflow is a premier SaaS platform for fitness enthusiasts and gym owners. Track workouts, manage memberships, and achieve your fitness goals.",
              "url": "https://fitflow.app",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "creator": {
                "@type": "Organization",
                "name": "Fitflow Inc."
              }
            })
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
