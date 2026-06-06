import Image from "next/image";

type ChampionAvatarProps = {
  image: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
};

export function ChampionAvatar({ image, name, size = "md" }: ChampionAvatarProps) {
  const sizeClass = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8" : "h-11 w-11";

  return (
    <div className={`${sizeClass} shrink-0 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10`}>
      {image ? (
        <Image src={image} alt={name} width={44} height={44} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-black text-stone-500">?</div>
      )}
    </div>
  );
}
