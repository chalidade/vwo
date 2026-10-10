// The friend list: who is online at the fair right now and where, requests waiting for an answer,
// and the ones we sent.
import type { Friend } from "./friends";
import { Modal } from "./Modal";

export interface FriendOnline {
  memberId: string;
  where: string;
}

export function FriendsPanel({
  friends,
  online,
  onVisit,
  onMessage,
  onAccept,
  onRemove,
  onClose,
}: {
  friends: Friend[];
  /** Friends at the fair now, by tag. */
  online: Map<string, FriendOnline>;
  onVisit: (memberId: string) => void;
  onMessage: (memberId: string) => void;
  onAccept: (f: Friend) => void;
  onRemove: (f: Friend) => void;
  onClose: () => void;
}) {
  const mutual = friends.filter((f) => f.state === "friend").sort((a, b) => Number(online.has(b.tag)) - Number(online.has(a.tag)));
  const asking = friends.filter((f) => f.state === "received");
  const sent = friends.filter((f) => f.state === "sent");
  return (
    <Modal title="👥 Teman" onClose={onClose} className="fx-games">
      <p className="sp-summary">Teman yang kamu simpan tetap ada di kunjungan berikutnya. Yang sedang online bisa langsung kamu datangi atau kirimi pesan cepat, supaya cari kerja bisa bareng.</p>
      {asking.length > 0 && (
        <>
          <h4 className="fr-h">Ingin berteman</h4>
          <ul className="fr-list">
            {asking.map((f) => (
              <li key={f.tag}>
                <span className="fr-dot" data-on={online.has(f.tag) ? "" : undefined} />
                <span className="fr-who">
                  <b>{f.name}</b>
                  <span>{online.get(f.tag)?.where ?? "Sedang offline"}</span>
                </span>
                <span className="fr-acts">
                  <button type="button" data-primary="" onClick={() => onAccept(f)}>
                    ⭐ Terima
                  </button>
                  <button type="button" onClick={() => onRemove(f)} aria-label={`Tolak ${f.name}`}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <h4 className="fr-h">
        Teman ({mutual.filter((f) => online.has(f.tag)).length} online dari {mutual.length})
      </h4>
      {mutual.length === 0 ? (
        <p className="sp-muted">Belum ada teman. Ketuk pelamar lain di job fair, lalu pilih ⭐ Simpan jadi teman.</p>
      ) : (
        <ul className="fr-list">
          {mutual.map((f) => {
            const on = online.get(f.tag);
            return (
              <li key={f.tag}>
                <span className="fr-dot" data-on={on ? "" : undefined} />
                <span className="fr-who">
                  <b>{f.name}</b>
                  <span>{on ? on.where : "Sedang offline"}</span>
                </span>
                <span className="fr-acts">
                  {on ? (
                    <>
                      <button type="button" data-primary="" onClick={() => onVisit(on.memberId)}>
                        🏃 Datangi
                      </button>
                      <button type="button" onClick={() => onMessage(on.memberId)}>
                        💬
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => onRemove(f)} aria-label={`Hapus ${f.name}`}>
                      Hapus
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {sent.length > 0 && (
        <>
          <h4 className="fr-h">Menunggu jawaban</h4>
          <ul className="fr-list">
            {sent.map((f) => (
              <li key={f.tag}>
                <span className="fr-dot" data-on={online.has(f.tag) ? "" : undefined} />
                <span className="fr-who">
                  <b>{f.name}</b>
                  <span>{online.get(f.tag)?.where ?? "Sedang offline"}</span>
                </span>
                <span className="fr-acts">
                  <button type="button" onClick={() => onRemove(f)}>
                    Batal
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
