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
        className="w-full h-48 sm:h-64 object-cover group-hover:scale-105 transition-transform duration-500"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#121212]/60 to-transparent" />
      <div className="absolute top-4 left-4">
        <span className="flex items-center gap-1.5 bg-[hsl(0,84%,60%)] text-white px-3 py-1 rounded-md text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          AO VIVO
        </span>
      </div>
      <div className="absolute bottom-4 right-4 text-right">
        <p className="text-2xl sm:text-4xl font-black text-[#80FF00] italic leading-tight">
          Quantos carros passa
        </p>
        <p className="text-2xl sm:text-4xl font-black text-[hsl(0,0%,95%)] italic leading-tight">
          nos próximos
        </p>
        <p className="text-3xl sm:text-5xl font-black text-[#80FF00] italic">
          5 minutos?
        </p>
      </div>
    </Link>
  );
}
