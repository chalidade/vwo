import { STREAM_URL_MAX, type StreamSource, streamEmbed } from "@vwo/shared";
import { StreamPlayer } from "../fair/StreamPlayer";

/** Why a pasted stream link can't be used, or null when it is empty or plays. */
export const streamLinkError = (url: string | undefined) => (url?.trim() && !streamEmbed(url) ? "Link siaran harus link video atau live YouTube (atau Vimeo)." : null);

/** "Siaran lewat": the speaker's browser (default) or a YouTube/Vimeo link, with the link and a preview
 *  of what viewers will see when the link is chosen. */
export function StreamField({ source, url, onSource, onUrl }: { source: StreamSource; url: string; onSource: (s: StreamSource) => void; onUrl: (v: string) => void }) {
  return (
    <fieldset className="org-stream cp-span">
      <legend>Siaran lewat</legend>
      <label className="org-stream-opt">
        <input type="radio" checked={source !== "link"} onChange={() => onSource("platform")} />
        <span>
          <b>Platform kita</b> (langsung dari laptop pembicara)
          <span className="muted small"> Untuk penonton sedikit: layar pembicara hanya sampai ke beberapa penonton, sisanya melihat slide.</span>
        </span>
      </label>
      <label className="org-stream-opt">
        <input type="radio" checked={source === "link"} onChange={() => onSource("link")} />
        <span>
          <b>YouTube atau Vimeo</b> (link)
          <span className="muted small">
            {" "}
            Untuk penonton banyak: siarkan ke YouTube Live (boleh Unlisted), penonton menontonnya di game tanpa batas jumlah. Chat dan Q&A tetap di game.
          </span>
        </span>
      </label>
      {source === "link" && <StreamLinkInput url={url} onUrl={onUrl} />}
    </fieldset>
  );
}

/** The link box of "Siaran lewat": the pasted link, why it can't be used, and a preview of what viewers will see.
 *  Read-only for an account that may not change the event setup. */
export function StreamLinkInput({ url, onUrl, readOnly, preview = true }: { url: string; onUrl?: (v: string) => void; readOnly?: boolean; preview?: boolean }) {
  const embed = streamEmbed(url);
  const error = streamLinkError(url);
  return (
    <>
      <label>
        Link siaran (YouTube)
        <input
          value={url}
          onChange={(e) => onUrl?.(e.target.value)}
          readOnly={readOnly}
          inputMode="url"
          maxLength={STREAM_URL_MAX}
          placeholder={readOnly ? "Belum diisi panitia" : "https://youtube.com/live/..."}
          aria-invalid={error ? true : undefined}
        />
      </label>
      {error ? <p className="org-sem-error">{error}</p> : !embed ? <p className="muted small">Belum ada link: penonton melihat "Siaran belum dimulai" sampai link diisi.</p> : null}
      {preview && embed && <StreamPlayer embed={embed} title="Pratinjau link siaran" autoplay={false} />}
    </>
  );
}
