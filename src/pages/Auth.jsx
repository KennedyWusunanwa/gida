import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png"; // optional logo

export default function Auth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const isSignup = mode === "signup";

  const validate = () => {
    if (!email) return "Email is required.";
    if (isSignup && fullName.trim().length < 2) return "Please enter your full name.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    const v = validate();
    if (v) return setMsg({ type: "error", text: v });

    setLoading(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        if (!data.session) {
          setMsg({
            type: "info",
            text: "Check your email to confirm your account, then log in.",
          });
          setMode("login");
        } else {
          navigate("/app/my-listings");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (data?.session) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", data.session.user.id)
            .single();

          if (profileError) throw profileError;

          if (profile?.is_admin) {
            navigate("/admin");
          } else {
            navigate("/app/my-listings");
          }
        }
      }
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/app/my-listings` },
      });
      if (error) throw error;
    } catch (err) {
      setMsg({ type: "error", text: err.message });
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) return setMsg({ type: "error", text: "Enter your email first." });
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/app`,
      });
      if (error) throw error;
      setMsg({ type: "info", text: "Password reset link sent to your email." });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseAsGuest = () => navigate("/");

  return (
    <div className="min-h-screen bg-[#F7F2E9] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 rounded-2xl shadow-xl overflow-hidden">
        {/* LEFT: form */}
        <div className="bg-[#FBF3E6] p-8 sm:p-12">
          <div className="flex items-center gap-3 mb-10">
            {logo && <img src={logo} alt="Gida" className="h-8 w-8" />}
            <span className="text-2xl font-semibold text-[#5B3A1E]">Gida</span>
          </div>

          <h1 className="text-[48px] leading-none font-extrabold text-[#5B3A1E] mb-8">
            {isSignup ? "Sign Up" : "Log In"}
          </h1>

          {msg && (
            <div
              role="status"
              className={`mb-5 rounded-lg px-4 py-3 text-sm ${
                msg.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
                placeholder="Full Name"
              />
            )}

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
              placeholder="Email"
              required
            />

            <div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-[#A6724B]"
                  placeholder="Password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-500">8+ characters</div>

              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs text-[#5B3A1E] underline underline-offset-4"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#5B3A1E] text-white py-3 font-semibold hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Please wait…" : isSignup ? "Continue" : "Log In"}
            </button>
          </form>

          <div className="flex items-center gap-4 my-6">
            <hr className="flex-1 border-[#E7E1D8]" />
            <span className="text-gray-500 text-sm">Or</span>
            <hr className="flex-1 border-[#E7E1D8]" />
          </div>

          <button
            onClick={handleOAuth}
            disabled={loading}
            className="w-full rounded-xl border border-[#E0D7C9] bg-white py-3 font-medium hover:bg-[#F7F2E9] disabled:opacity-60"
          >
            Continue with Google
          </button>

          <button
            type="button"
            onClick={handleBrowseAsGuest}
            className="w-full mt-3 rounded-xl border border-transparent bg-white py-3 font-medium text-[#5B3A1E] hover:bg-[#F7F2E9]"
          >
            Browse as guest
          </button>

          <div className="mt-8">
            {isSignup ? (
              <div className="space-y-3">
                <p className="text-base text-[#2B2B2B]">Already have an account?</p>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="w-full rounded-xl bg-[#5B3A1E] text-white py-3 font-semibold hover:opacity-95"
                >
                  Log in
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-700">
                Don’t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-[#5B3A1E] font-semibold underline underline-offset-4"
                >
                  Sign up
                </button>
              </p>
            )}
          </div>
        </div>

        {/* RIGHT: Decorative Panel */}
        <div className="relative hidden md:flex items-center justify-center bg-[#8B5E34]">
          <div className="text-white text-center px-8">
            <svg
              className="mx-auto mb-6 h-28 w-28"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M8 30L32 12L56 30V52C56 54.2091 54.2091 56 52 56H12C9.79086 56 8 54.2091 8 52V30Z" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="24" cy="36" r="4" stroke="white" strokeWidth="4"/>
              <circle cx="40" cy="36" r="4" stroke="white" strokeWidth="4"/>
              <path d="M20 48C20 42 28 42 32 42C36 42 44 42 44 48" stroke="white" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <div className="text-5xl font-extrabold">Gida</div>
            <p className="mt-3 text-white/90 max-w-xs mx-auto">
              Find roommates and rentals that fit your budget and vibe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
