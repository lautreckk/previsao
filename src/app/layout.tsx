import type { Metadata, Viewport } from "next";
import { UserProvider } from "@/lib/UserContext";
import { ChatProvider } from "@/lib/ChatContext";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Winify - Transforme seus palpites em dinheiro",
  description: "Winify - Aposte nas suas previsoes e ganhe!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1120",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,400;0,700;0,800;1,800&family=Be+Vietnam+Pro:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        {/* ============================================================ */}
        {/* TRACKING PIXELS - Meta, TikTok, Google Ads, Kwai, Taboola   */}
        {/* Replace the IDs below with your actual pixel/tag IDs         */}
        {/* ============================================================ */}

        {/* 1. META (Facebook) Pixel */}
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '1226111416400460');
          fbq('track', 'PageView');
        `}</Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1226111416400460&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>

        {/* 2. TIKTOK Pixel */}
        {/* TODO: Replace TIKTOK_PIXEL_ID with your TikTok pixel ID */}
        <Script id="tiktok-pixel" strategy="afterInteractive">{`
          !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
          ttq.methods=["page","track","identify","instances","debug","on","off",
          "once","ready","alias","group","enableCookie","disableCookie"],
          ttq.setAndDefer=function(t,e){t[e]=function(){
          t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
          for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
          ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)
          ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){
          var i="https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},
          ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
          var o=document.createElement("script");o.type="text/javascript",
          o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
          var a=document.getElementsByTagName("script")[0];
          a.parentNode.insertBefore(o,a)};
          ttq.load('TIKTOK_PIXEL_ID');
          ttq.page();
          }(window,document,'ttq');
        `}</Script>

        {/* 3. GOOGLE ADS (gtag.js) */}
        {/* TODO: Replace G-XXXXXXXXXX with your Google Ads/GA4 tag ID */}
        {/* TODO: Replace AW-XXXXXXXXXX with your Google Ads conversion ID */}
        <Script
          id="google-gtag-src"
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
        />
        <Script id="google-gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XXXXXXXXXX');
          gtag('config', 'AW-XXXXXXXXXX');
        `}</Script>

        {/* 4. KWAI Pixel */}
        {/* TODO: Replace KWAI_PIXEL_ID with your Kwai pixel ID */}
        <Script id="kwai-pixel" strategy="afterInteractive">{`
          !function(e,t,n,r,a){if(!e.kwaiq){var i=e.kwaiq=function(){
          i.callMethod?i.callMethod.apply(i,arguments):i.queue.push(arguments)};
          i.push=i;i.loaded=!0;i.version='1.0';i.queue=[];
          var o=t.createElement(n);o.async=!0;
          o.src='https://s1.kwai.net/kos/s101/nlav11187/pixel/events.js';
          var s=t.getElementsByTagName(n)[0];s.parentNode.insertBefore(o,s)
          }}(window,document,'script');
          kwaiq.load('KWAI_PIXEL_ID');
          kwaiq.page();
        `}</Script>

        {/* 5. TABOOLA Pixel */}
        {/* TODO: Replace TABOOLA_PIXEL_ID with your Taboola pixel ID */}
        <Script id="taboola-pixel" strategy="afterInteractive">{`
          window._tfa = window._tfa || [];
          window._tfa.push({notify: 'event', name: 'page_view', id: 'TABOOLA_PIXEL_ID'});
          !function(t,f,a,x){if(!document.getElementById(x)){
          t.async=1;t.src=a;t.id=x;f.parentNode.insertBefore(t,f);
          }}(document.createElement('script'),
          document.getElementsByTagName('script')[0],
          '//cdn.taboola.com/libtrc/unip/TABOOLA_PIXEL_ID/tfa.js',
          'tb_tfa_script');
        `}</Script>
      </head>
      <body suppressHydrationWarning className="font-body antialiased overflow-x-hidden max-w-[100vw]">
        <UserProvider>
          <ChatProvider>
            {children}
          </ChatProvider>
        </UserProvider>
      </body>
    </html>
  );
}
