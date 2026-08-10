import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { authRepository } from "../../repositories";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const summary = { activeStudents: "—", activeExams: "—" };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authRepository.loginAdmin(login, password);
      navigate("/admin", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Tidak dapat terhubung ke server.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-page">
      <div className="auth-side-art">
        <Brand light />
        <div className="side-art-content">
          <span className="side-badge">
            <ShieldCheck /> Area administrator
          </span>
          <h1>
            Kelola ujian dengan lebih <em>tenang.</em>
          </h1>
          <p>
            Mulai dari membuat soal hingga memantau peserta—semuanya dalam satu
            ruang kerja.
          </p>
          <div className="side-metric-row">
            <div>
              <strong>{summary.activeStudents}</strong>
              <span>peserta aktif</span>
            </div>
            <div>
              <strong>{summary.activeExams}</strong>
              <span>ujian aktif</span>
            </div>
          </div>
        </div>
      </div>
      <main className="admin-login-main">
        <Link to="/" className="back-link">
          <ArrowLeft /> Kembali ke login peserta
        </Link>
        <form className="admin-login-card" onSubmit={submit}>
          <p className="kicker">SELAMAT DATANG KEMBALI</p>
          <h2>Masuk ke Ruang Admin</h2>
          <p>Gunakan akun administrator sekolah Anda.</p>
          <label>Email atau username</label>
          <input
            type="text"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="nama@sekolah.id"
            autoComplete="username"
            required
          />
          <div className="label-row">
            <label>Kata sandi</label>
            <button type="button">Lupa kata sandi?</button>
          </div>
          <div className="password-field">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Masukkan kata sandi"
              autoComplete="current-password"
              required
            />
            <button type="button" onClick={() => setShow(!show)}>
              <Eye />
            </button>
          </div>
          {error && <span className="field-error">{error}</span>}
          <button
            className="button primary full"
            type="submit"
            disabled={loading}
          >
            {loading ? "Menghubungkan..." : "Masuk"} <ArrowRight />
          </button>
          <p className="secure-note">
            <LockKeyhole /> Sesi tersimpan di perangkat ini sampai Anda keluar.
          </p>
        </form>
      </main>
    </div>
  );
}
