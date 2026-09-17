// A full-bleed or offset media block. No card, no border, no shadow -
// the image is the object, presented directly on the black canvas.
import Image from "next/image";

export type FigureAspect = "square" | "portrait" | "wide" | "tall";

const ASPECT_CLASS: Record<FigureAspect, string> = {
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  wide: "aspect-[16/9]",
  tall: "aspect-[9/16]",
};

interface FigureProps {
  src: string;
  alt: string;
  aspect: FigureAspect;
  /** Breaks the image out to full viewport width regardless of the parent container. */
  bleed?: boolean;
}

export default function Figure({ src, alt, aspect, bleed = false }: FigureProps) {
  return (
    <div className={`relative w-full ${ASPECT_CLASS[aspect]} ${bleed ? "bleed" : ""}`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={false}
        sizes={bleed ? "100vw" : "(min-width: 1440px) 1440px, 100vw"}
        className="object-cover"
      />
    </div>
  );
}
