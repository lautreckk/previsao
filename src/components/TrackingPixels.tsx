"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const STORAGE_KEY = "winify_tracking_config";

interface PlatformConfig {
  enabled: boolean;
  pixelId: string;
  measurementId?: string;
  adsId?: string;
}

interface TrackingConfig {
  meta: PlatformConfig;
  tiktok: PlatformConfig;
  google: PlatformConfig;
  kwai: PlatformConfig;
  taboola: PlatformConfig;
}

const DEFAULT: TrackingConfig = {
  meta: { enabled: true, pixelId: "1226111416400460" },
  tiktok: { enabled: false, pixelId: "" },
  google: { enabled: false, pixelId: "", measurementId: "", adsId: "" },
  kwai: { enabled: false, pixelId: "" },
  taboola: { enabled: false, pixelId: "" },
};

function loadConfig(): TrackingConfig {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT;
}

export default function TrackingPixels() {
  const [config, setConfig] = useState<TrackingConfig | null>(null);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  if (!config) return null;

  return (
    <>
      {/* META (Facebook) Pixel */}
      {config.meta.enabled && config.meta.pixelId && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${config.meta.pixelId}');
            fbq('track', 'PageView');
          `}</Script>
          <noscript>
            <img height="1" width="1" style={{ display: "none" }} src={`https://www.facebook.com/tr?id=${config.meta.pixelId}&ev=PageView&noscript=1`} alt="" />
          </noscript>
        </>
      )}

      {/* TIKTOK Pixel */}
      {config.tiktok.enabled && config.tiktok.pixelId && (
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
          ttq.load('${config.tiktok.pixelId}');
          ttq.page();
          }(window,document,'ttq');
        `}</Script>
      )}

      {/* GOOGLE ADS + GA4 */}
      {config.google.enabled && (config.google.measurementId || config.google.adsId) && (
        <>
          <Script
            id="google-gtag-src"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${config.google.measurementId || config.google.adsId}`}
          />
          <Script id="google-gtag-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            ${config.google.measurementId ? `gtag('config', '${config.google.measurementId}');` : ""}
            ${config.google.adsId ? `gtag('config', '${config.google.adsId}');` : ""}
          `}</Script>
        </>
      )}

      {/* KWAI Pixel */}
      {config.kwai.enabled && config.kwai.pixelId && (
        <Script id="kwai-pixel" strategy="afterInteractive">{`
          !function(e,t,n,r,a){if(!e.kwaiq){var i=e.kwaiq=function(){
          i.callMethod?i.callMethod.apply(i,arguments):i.queue.push(arguments)};
          i.push=i;i.loaded=!0;i.version='1.0';i.queue=[];
          var o=t.createElement(n);o.async=!0;
          o.src='https://s1.kwai.net/kos/s101/nlav11187/pixel/events.js';
          var s=t.getElementsByTagName(n)[0];s.parentNode.insertBefore(o,s)
          }}(window,document,'script');
          kwaiq.load('${config.kwai.pixelId}');
          kwaiq.page();
        `}</Script>
      )}

      {/* TABOOLA Pixel */}
      {config.taboola.enabled && config.taboola.pixelId && (
        <Script id="taboola-pixel" strategy="afterInteractive">{`
          window._tfa = window._tfa || [];
          window._tfa.push({notify: 'event', name: 'page_view', id: '${config.taboola.pixelId}'});
          !function(t,f,a,x){if(!document.getElementById(x)){
          t.async=1;t.src=a;t.id=x;f.parentNode.insertBefore(t,f);
          }}(document.createElement('script'),
          document.getElementsByTagName('script')[0],
          '//cdn.taboola.com/libtrc/unip/${config.taboola.pixelId}/tfa.js',
          'tb_tfa_script');
        `}</Script>
      )}
    </>
  );
}
