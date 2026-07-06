interface Props {
  canPay: boolean;
  canUnpay: boolean;
  onPay: () => void;
  onUnpay: () => void;
  onDelete: () => void;
}

export function PayControls({ canPay, canUnpay, onPay, onUnpay, onDelete }: Props) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onUnpay}
        disabled={!canUnpay}
        style={{
          border: "1px solid rgba(0,0,0,.12)",
          background: "transparent",
          color: canUnpay ? "var(--tj-muted-2)" : "#c9c5db",
          fontWeight: 700,
          fontSize: 11.5,
          padding: "7px 11px",
          borderRadius: 10,
          cursor: canUnpay ? "pointer" : "default",
        }}
      >
        − Cuota
      </button>
      <button
        onClick={onPay}
        disabled={!canPay}
        style={{
          border: "none",
          background: canPay ? "#1c1c22" : "rgba(0,0,0,.08)",
          color: canPay ? "#fff" : "#b7b3cc",
          fontWeight: 700,
          fontSize: 11.5,
          padding: "7px 12px",
          borderRadius: 10,
          cursor: canPay ? "pointer" : "default",
        }}
      >
        Pagar cuota ✓
      </button>
      <button
        onClick={onDelete}
        style={{
          border: "none",
          background: "rgba(214,69,90,.08)",
          color: "var(--tj-danger)",
          fontWeight: 700,
          fontSize: 11.5,
          padding: "7px 11px",
          borderRadius: 10,
          cursor: "pointer",
        }}
      >
        Eliminar
      </button>
    </div>
  );
}
