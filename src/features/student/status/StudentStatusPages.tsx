import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Home,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import { StudentHeader } from "../../../components/layout";

export function WaitingReviewPage() {
  return (
    <div className="student-status-page">
      <StudentHeader minimal />
      <main className="status-content">
        <div className="status-illustration waiting">
          <span>
            <ClipboardCheck />
          </span>
          <i>✓</i>
        </div>
        <p className="status-eyebrow">UJIAN BERHASIL DIKUMPULKAN</p>
        <h1>Jawabanmu sedang menunggu koreksi</h1>
        <p>
          Admin akan memeriksa jawabanmu. Nilai tersedia setelah hasil
          diterbitkan.
        </p>
        <div className="status-note">
          <LockKeyhole />
          <p>
            Nilai sementara tidak dapat dilihat sebelum admin menerbitkannya.
          </p>
        </div>
        <Link to="/student" className="button primary">
          <Home /> Kembali ke beranda
        </Link>
      </main>
    </div>
  );
}

export function DisqualifiedPage() {
  return (
    <div className="student-status-page disqualified-page">
      <StudentHeader minimal />
      <main className="status-content">
        <div className="status-illustration danger">
          <span>
            <ShieldAlert />
          </span>
        </div>
        <p className="status-eyebrow danger-text">ATTEMPT DIHENTIKAN</p>
        <h1>Anda telah didiskualifikasi</h1>
        <p>Ujian telah dihentikan oleh pengawas dan tidak dapat dilanjutkan.</p>
        <div className="status-note">
          <CheckCircle2 />
          <p>
            Jawaban yang sudah tersimpan tetap tercatat untuk kebutuhan audit.
          </p>
        </div>
        <Link to="/student" className="button primary">
          <Home /> Kembali ke beranda
        </Link>
      </main>
    </div>
  );
}

export function SessionConflictPage() {
  return (
    <div className="student-status-page">
      <StudentHeader minimal />
      <main className="status-content">
        <div className="status-illustration conflict">
          <span>💻</span>
          <i>📱</i>
        </div>
        <p className="status-eyebrow">SESI AKTIF TERDETEKSI</p>
        <h1>Ujian sedang dibuka di perangkat lain</h1>
        <p>
          Untuk menjaga keamanan, hanya satu perangkat yang boleh mengendalikan
          sesi ujian.
        </p>
        <button className="button primary">
          <ArrowRight /> Coba pulihkan sesi
        </button>
        <Link to="/student" className="button secondary">
          Batalkan dan kembali
        </Link>
      </main>
    </div>
  );
}
