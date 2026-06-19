import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signUpWithEmail,
  signInWithGoogle,
  syncUserToDatabase,
  supabase,
} from "../../services/api.js";
import { isValidEmail, getAuthErrorMessage } from "../../utils/validation.js";
import { useAuthSubmitGuard } from "../../hooks/useAuthSubmitGuard.js";
import AuthPageLayout from "../../components/AuthPageLayout.jsx";

export default function Sign_up() {
  const navigate = useNavigate();
  const { loading, isBlocked, runAuthAction, applyRateLimitCooldown } =
    useAuthSubmitGuard();
  const [errorMessage, setErrorMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage("");
    const { error } = await runAuthAction(() =>
      signInWithGoogle("/role_selection"),
    );
    if (error) {
      applyRateLimitCooldown(error);
      setErrorMessage(getAuthErrorMessage(error));
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        await syncUserToDatabase(session, {
          fullName: session.user.user_metadata?.full_name || formData.username,
          role: "student",
        });
        navigate("/role_selection");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, formData.username]);

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setEmailError("");

    if (!formData.username.trim()) {
      setErrorMessage("Please enter a username.");
      return;
    }
    if (!isValidEmail(formData.email)) {
      setEmailError("Enter a valid email (e.g. name@school.com).");
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    const { data, error } = await runAuthAction(() =>
      signUpWithEmail(formData.email.trim(), formData.password, {
        full_name: formData.username,
        role: "student",
      }),
    );
    if (error) {
      applyRateLimitCooldown(error);
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }
    if (data?.session) {
      await syncUserToDatabase(data.session, {
        fullName: formData.username,
        role: "student",
      });
      navigate("/role_selection");
    } else {
      alert("Check your email to confirm your account, then sign in.");
      navigate("/sign_in");
    }
  };

  return (
    <AuthPageLayout backTo="/" illustrationSide="left">
      <div className="max-w-md ml-auto mr-40">
        <h1 className="text-5xl font-semibold text-slate-800 tracking-tight mb-2 text-right md:text-left">
          Create your Account!
        </h1>

        {(errorMessage || emailError) && (
          <p className="text-red-600 text-sm mb-3 font-medium" role="alert">
            {emailError || errorMessage}
          </p>
        )}

        <form className="space-y-5" onSubmit={handleEmailSignUp}>
          <div>
            <label className="block text-lg font-medium text-slate-700 mb-1 pl-2">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="w-full rounded-2xl border-2 border-slate-700 bg-[#e3f6ff] px-5 py-4 text-lg outline-none focus:border-blue-500 shadow-inner"
              required
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-slate-700 mb-1 pl-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full rounded-2xl border-2 border-slate-700 bg-[#e3f6ff] px-5 py-4 text-lg outline-none focus:border-blue-500 shadow-inner"
              required
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-slate-700 mb-1 pl-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full rounded-2xl border-2 border-slate-700 bg-[#e3f6ff] px-5 py-4 text-lg outline-none focus:border-blue-500 shadow-inner"
              required
            />
          </div>

          <p className="text-[13px] font-semibold text-slate-700 text-center">
            I agree to all Terms, Privacy Policy and fees
          </p>

          <button
            type="submit"
            disabled={isBlocked}
            className="btn-auth-primary"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>

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
