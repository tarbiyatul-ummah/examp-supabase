import { AlertTriangle, Check, Circle, Flag, Send } from "lucide-react";
import { useState } from "react";

export function SubmitExamModal({
  answered,
  total,
  onClose,
  onSubmit,
  submitting = false,
  error = "",
}: {
  answered: number;
  total: number;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  error?: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="modal-backdrop">
      <div className="modal-card submit-modal">
        <div className="submit-icon">
          <Flag />
        </div>
        <h2>Yakin ingin menyelesaikan ujian?</h2>
        <p>Setelah dikumpulkan, kamu tidak dapat mengubah jawaban lagi.</p>
        <div className="submit-stats">
          <div>
            <span className="green">
              <Check />
            </span>
            <p>
              <strong>{answered}</strong>
              <small>Sudah dijawab</small>
            </p>
          </div>
          <div>
            <span className="orange">
              <Circle />
            </span>
            <p>
              <strong>{total - answered}</strong>
              <small>Belum dijawab</small>
            </p>
          </div>
        </div>
        {total - answered > 0 && (
          <div className="unanswered-warning">
            <AlertTriangle />
            <span>
              Masih ada <strong>{total - answered} soal</strong> yang belum
              dijawab.
            </span>
          </div>
        )}
        {error && (
          <div className="submit-error" role="alert">
            <AlertTriangle />
            <span>{error}</span>
          </div>
        )}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>Saya yakin ingin mengumpulkan ujian ini.</span>
        </label>
        <div className="modal-footer">
          <button
            className="button secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Periksa lagi
          </button>
          <button
            className="button primary"
            disabled={!confirmed || submitting}
            onClick={() => void onSubmit()}
          >
            <Send /> {submitting ? "Mengumpulkan..." : "Kumpulkan ujian"}
          </button>
        </div>
      </div>
    </div>
  );
}
