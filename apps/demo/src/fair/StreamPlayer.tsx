import type { StreamEmbed } from "@vwo/shared";

/** The provider's player for a stream link (YouTube, Vimeo), 16:9 at any width. The src is always
 *  rebuilt from the video id by `streamEmbed`, and the frame may not navigate the game away. */
export function StreamPlayer({ embed, title, autoplay = true, muted = false }: { embed: StreamEmbed; title: string; autoplay?: boolean; muted?: boolean }) {
  let src = autoplay ? embed.src : embed.src.replace("autoplay=1", "autoplay=0");
  // Browsers only autoplay without sound; the corner panel starts muted so it plays at all.
  if (muted) src += embed.provider === "youtube" ? "&mute=1" : "&muted=1";
  return (
    <div className="sp-embed">
      <iframe
        src={src}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      />
    </div>
  );
}
