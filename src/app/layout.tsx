import type { Metadata, Viewport } from "next";
import { UserProvider } from "@/lib/UserContext";
import { ChatProvider } from "@/lib/ChatContext";
import { ToastProvider } from "@/components/Toast";
import TrackingPixels from "@/components/TrackingPixels";
import "./globals.css";

export const metadata: Metadata = {
  title: "PALPITEX - Transforme seus palpites em dinheiro",
  description: "PALPITEX - Aposte nas suas previsoes e ganhe!",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PALPITEX",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#121212",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,400;0,700;0,800;1,800&family=Be+Vietnam+Pro:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            });
          }
        `}} />
      </head>
      <body suppressHydrationWarning className="font-body antialiased overflow-x-hidden max-w-[100vw]">
        <UserProvider>
          <ChatProvider>
            <ToastProvider>
              <TrackingPixels />
              {children}
            </ToastProvider>
          </ChatProvider>
        </UserProvider>
      </body>
    </html>
  );
}
