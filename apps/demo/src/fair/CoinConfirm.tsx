/** What spending coins will do, asked before anything is charged, so a stray tap costs nothing. */
export interface CoinAsk {
  price: number;
  /** What the coins pay for, e.g. "Lamar Data Analyst di Kopi Kita". */
  what: string;
  run: () => void;
}

/** The question itself, as a card. Shown over everything (see CoinConfirmModal) or inside another popup. */
export function CoinConfirm({ ask, coins, onCancel }: { ask: CoinAsk; coins: number; onCancel: () => void }) {
  const left = coins - ask.price;
  return (
    <div className="cc-ask" role="alertdialog" aria-label="Konfirmasi pakai koin">
      <p className="cc-ask-q">
        Pakai <b>{ask.price} 🪙</b> untuk {ask.what}?
      </p>
      <p className="cc-ask-left">
        Saldo {coins} 🪙 → sisa {left} 🪙
      </p>
      <div className="cc-ask-row">
        <button type="button" className="ghost" onClick={onCancel}>
          Batal
        </button>
        <button
          type="button"
          className="cc-ask-yes"
          autoFocus
          onClick={() => {
            onCancel();
            ask.run();
          }}
        >
          Ya, pakai {ask.price} 🪙
        </button>
      </div>
    </div>
  );
}

export function CoinConfirmModal({ ask, coins, onCancel }: { ask: CoinAsk; coins: number; onCancel: () => void }) {
  return (
    <div className="mb-backdrop cc-ask-back" onPointerDown={(e) => e.stopPropagation()} onClick={onCancel}>
      <div className="rpg-box" onClick={(e) => e.stopPropagation()}>
        <CoinConfirm ask={ask} coins={coins} onCancel={onCancel} />
      </div>
    </div>
  );
}
