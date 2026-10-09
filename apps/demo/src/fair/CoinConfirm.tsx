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
    <div className="cc-ask" role="alertdialog" aria-labelledby="cc-ask-title" aria-describedby="cc-ask-what">
      <div className="cc-ask-head">
        <span className="cc-ask-coin" aria-hidden>
          🪙
        </span>
        <div>
          <p className="cc-ask-title" id="cc-ask-title">
            Pakai {ask.price} koin?
          </p>
          <p className="cc-ask-what" id="cc-ask-what">
            Untuk {ask.what}.
          </p>
        </div>
      </div>
      <dl className="cc-ask-sum">
        <div>
          <dt>Saldo sekarang</dt>
          <dd>{coins} 🪙</dd>
        </div>
        <div>
          <dt>Dipakai</dt>
          <dd>−{ask.price} 🪙</dd>
        </div>
        <div className="cc-ask-total">
          <dt>Sisa saldo</dt>
          <dd>{left} 🪙</dd>
        </div>
      </dl>
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
          Ya, pakai
        </button>
      </div>
    </div>
  );
}

export function CoinConfirmModal({ ask, coins, onCancel }: { ask: CoinAsk; coins: number; onCancel: () => void }) {
  return (
    <div className="mb-backdrop cc-ask-back" onPointerDown={(e) => e.stopPropagation()} onClick={onCancel}>
      <div className="rpg-box cc-ask-box" onClick={(e) => e.stopPropagation()}>
        <CoinConfirm ask={ask} coins={coins} onCancel={onCancel} />
      </div>
    </div>
  );
}
