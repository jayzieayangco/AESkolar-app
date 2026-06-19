import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmail,
  signInWithGoogle,
  syncUserToDatabase,
  supabase,
} from "../../services/api.js";
import { isValidEmail, getAuthErrorMessage } from "../../utils/validation.js";
import { useAuthSubmitGuard } from "../../hooks/useAuthSubmitGuard.js";
import AuthPageLayout from "../../components/AuthPageLayout.jsx";

export default function Sign_in() {
  const navigate = useNavigate();
  const { loading, isBlocked, runAuthAction, applyRateLimitCooldown } = useAuthSubmitGuard();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleGoogleSignIn = async () => {
    setErrorMessage("");
    const { error } = await runAuthAction(() => signInWithGoogle("/role_selection"));
    if (error) {
      applyRateLimitCooldown(error);
      setErrorMessage(getAuthErrorMessage(error));
    }
  };

  const handleEmailSignIn = async (e) => {
    e?.preventDefault();
    setErrorMessage("");
    setEmailError("");

    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email (e.g. name@school.com).");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    const { data, error } = await runAuthAction(() =>
      signInWithEmail(email.trim(), password)
    );
    if (error) {
      applyRateLimitCooldown(error);
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }
    if (data?.session) {
      await syncUserToDatabase(data.session);
      navigate("/role_selection");
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        await syncUserToDatabase(session);
        navigate("/role_selection");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <AuthPageLayout backTo="/">
      <div className="ml-40 max-w-md">
        <h1 className="text-5xl font-semibold text-slate-800 tracking-tight leading-none mb-2">
          Welcome Back!
        </h1>
        <p className="text-lg font-medium text-slate-600 mb-6">Sign in to continue</p>

        {(errorMessage || emailError) && (
          <p className="text-red-600 text-sm mb-3 font-medium" role="alert">
            {emailError || errorMessage}
          </p>
        )}

        <form className="space-y-5" onSubmit={handleEmailSignIn}>
          <div>
            <label className="block text-lg font-medium text-slate-700 mb-1 pl-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              className="w-full rounded-2xl border-2 border-slate-700 bg-[#e3f6ff] px-5 py-4 text-lg text-slate-800 outline-none focus:border-blue-500 shadow-inner"
              required
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-slate-700 mb-1 pl-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border-2 border-slate-700 bg-[#e3f6ff] px-5 py-4 text-lg text-slate-800 outline-none focus:border-blue-500 shadow-inner"
              required
            />
          </div>

          <button type="submit" disabled={isBlocked} className="btn-auth-primary">
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="text-center text-base font-medium text-slate-700">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/sign_up")}
              className="text-[#3b82f6] hover:underline bg-transparent border-none cursor-pointer font-semibold"
            >
              Sign up
            </button>
          </p>

          <div className="flex items-center my-4">
            <div className="flex-grow border-t-2 border-slate-700" />
            <span className="px-4 font-bold text-slate-700">OR</span>
            <div className="flex-grow border-t-2 border-slate-700" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isBlocked}
            className="btn-auth-google"
          >
            <img src="/google.png" alt="" className="h-6 w-6 object-contain" />
            {loading ? "Signing in..." : "Continue with Google"}
          </button>
        </form>
      </div>
    </AuthPageLayout>
  );
}
