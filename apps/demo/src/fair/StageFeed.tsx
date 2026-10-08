import { useEffect, useRef, useState } from "react";
import type { StageLive } from "./stage";

/** The live broadcast in a corner of the screen while the job seeker is in the room it plays in:
 *  the speaker's shared screen and voice, without having to open the full viewer. */
export function StageFeedPanel({ live, stream, onOpen }: { live: StageLive; stream: MediaStream | null; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [small, setSmall] = useState(false);
  const video = !!stream?.getVideoTracks().length;

  useEffect(() => {
    const v = ref.current;
    if (!v || !stream) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.muted = false;
    v.play()
      .then(() => setBlocked(false))
      .catch(() => {
        // The browser wants a tap before playing sound: play muted until then.
        v.muted = true;
        setBlocked(true);
        void v.play().catch(() => {});
      });
  }, [stream]);

  const unmute = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    void v.play().then(() => setBlocked(false)).catch(() => {});
  };

  return (
    <div className="sf rpg-box" data-small={small ? "" : undefined} onPointerDown={(e) => e.stopPropagation()}>
      <div className="sf-top">
        <span className="sf-live">● LIVE</span>
        <span className="sf-title">{live.title}</span>
        <button type="button" onClick={() => setSmall(!small)} aria-label={small ? "Tampilkan siaran" : "Kecilkan siaran"}>
          {small ? "▢" : "–"}
        </button>
      </div>
      <div className="sf-stage" hidden={small}>
        <video ref={ref} autoPlay playsInline style={{ display: video ? undefined : "none" }} />
        {!video && (
          <div className="sf-wait">
            {stream ? `🎙️ ${live.speaker} sedang berbicara` : live.screen ? "Menyambungkan layar pembicara…" : `🎤 ${live.speaker}`}
          </div>
        )}
        {blocked && (
          <button type="button" className="sf-sound" onClick={unmute}>
            🔇 Nyalakan suara
          </button>
        )}
      </div>
      {!small && (
        <div className="sf-bar">
          <span>🎤 {live.speaker}</span>
          <button type="button" onClick={onOpen}>
            ⛶ Layar penuh & chat
          </button>
        </div>
      )}
    </div>
  );
}
