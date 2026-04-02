"use client";

import Link from "next/link";

export default function LiveCard() {
  return (
    <Link
      href="/camera/cam_highway"
      className="relative rounded-xl overflow-hidden mb-5 cursor-pointer group block"
    >
      <img
        src="https://ik.imagekit.io/b4wareuuf/freepik_an-aerial-view-shows-a-highway-with-several-cars-driving-on-it.-the-road-is-divided-by-white-dashed-lines.-on-the-right-side-of-the-image-there-is-a-dark-background-with-green-and-white-t_0001.png?updatedAt=1774753670923"
        alt="Ao Vivo - Rodovia"
        className="w-full h-40 sm:h-52 object-cover group-hover:scale-105 transition-transform duration-500"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#121212]/80 via-[#121212]/40 to-transparent" />
      <div className="absolute top-4 left-4">
        <span className="flex items-center gap-1.5 bg-[hsl(0,84%,60%)] text-white px-3 py-1 rounded-md text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          AO VIVO
        </span>
      </div>
      <div className="absolute bottom-4 left-4">
        <p className="text-lg sm:text-2xl font-black text-white leading-tight">
          Quantos carros passam
        </p>
        <p className="text-lg sm:text-2xl font-black text-[#80FF00] leading-tight">
          nos próximos 5 minutos?
        </p>
      </div>
    </Link>
  );
}
