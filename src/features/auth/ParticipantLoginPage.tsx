import { FormEvent, useState } from "react";
import { AlertTriangle, ArrowRight, LockKeyhole, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../../components/ui";
import { appConfig } from "../../config/appConfig";
import { authRepository } from "../../repositories";
import { ApiError } from "../../lib/api";

function EmptyIllustration() { return <div className="book-illustration" aria-hidden="true"><span>✦</span><div>📖</div><i /></div>; }

export function ParticipantLoginPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) return setError("Kode harus terdiri dari 6 karakter.");
    setLoading(true);
    try {
      await authRepository.loginStudent(code);
      navigate("/student", { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  };
  return <div className="auth-page student-auth"><header className="public-header"><Brand /><Link to="/admin/login" className="admin-login-link"><ShieldCheck /> Masuk sebagai admin</Link></header><main className="auth-grid"><section className="auth-copy"><div className="eyebrow"><Sparkles /> Belajar jadi lebih seru</div><h1>Siap tunjukkan<br /><em>kemampuanmu?</em></h1><p>Masukkan kode peserta yang kamu dapatkan dari pengawas, lalu mulai ujianmu dengan percaya diri.</p><EmptyIllustration /></section><section className="login-card-wrap"><div className="login-card"><div className="login-icon"><UserRound /></div><h2>Hai, peserta! 👋</h2><p>Masukkan kode 6 karakter untuk melanjutkan.</p><form onSubmit={submit}><label htmlFor="code">Kode peserta</label><input id="code" className={`code-input ${error ? "input-error" : ""}`} value={code} onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)); setError(""); }} placeholder="• • • • • •" autoComplete="off" autoFocus />{error && <span className="field-error"><AlertTriangle />{error}</span>}<button className="button primary full" type="submit" disabled={loading}>{loading ? "Memeriksa kode..." : "Masuk ke ruang ujian"} <ArrowRight /></button></form><div className="login-hint"><LockKeyhole /><span>Kode ini khusus untukmu. Jangan bagikan kepada orang lain.</span></div></div></section></main><footer className="auth-footer">© {appConfig.year} {appConfig.name} <span>•</span> Platform ujian yang aman dan menyenangkan</footer></div>;
}
