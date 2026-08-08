import { RefreshCw, WifiOff } from "lucide-react";

export function ConnectionOverlay({
  reconnecting,
  onReconnect,
}: {
  reconnecting: boolean;
  onReconnect: () => void;
}) {
  return (
    <div className="connection-overlay">
      <div className="connection-card">
        <span className="connection-state-icon">
          <WifiOff />
        </span>
        <h2>Koneksi terputus</h2>
        <p>
          Tenang, waktu ujianmu sedang dijeda dan jawaban terakhir tetap aman.
        </p>
        <div className="paused-timer">
          <span>STATUS TIMER</span>
          <strong>Dijeda sementara</strong>
        </div>
        <button
          className="button primary full"
          onClick={onReconnect}
          disabled={reconnecting}
        >
          {reconnecting ? (
            <>
              <RefreshCw className="spin" /> Menyambungkan kembali...
            </>
          ) : (
            <>
              <RefreshCw /> Coba sambungkan
            </>
          )}
        </button>
        <small>
          Halaman akan dipulihkan dari data server sebelum timer berjalan lagi.
        </small>
      </div>
    </div>
  );
}
