import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../../supabase/client";
import { syncUserToDatabase } from "../../services/api.js";

export default function Landing_Page() {
  const navigate = useNavigate();

  // Redirect to role selection if user is already signed in
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        if (event === "SIGNED_IN") await syncUserToDatabase(session);
        navigate("/role_selection");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="relative h-screen w-full bg-[#c5ecff] overflow-hidden font-sans select-none">

      <button
        onClick={() => navigate("/sign_in")}
        className="absolute top-6 right-6 md:top-10 md:right-10 z-30 flex items-center justify-center text-lg md:text-xl rounded-2xl bg-white px-8 py-2.5 font-medium text-slate-800 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      >
        Sign in
      </button>

      <div className="absolute inset-0 z-10 flex h-full w-full items-center pl-[35%] pr-6">
        <div className="w-full max-w-4xl flex flex-col items-center md:items-start text-center md:text-left">

          <h1 className="text-[7.5rem] sm:text-[9rem] md:text-[10.5rem] lg:text-[12rem] font-semibold leading-[0.85] text-slate-900 tracking-tight">
            AESkolar
          </h1>

          <p className="text-xl sm:text-2xl md:text-3xl font-medium text-slate-700 tracking-wide mt-2 pl-39">
            Write better. Learn smarter.
          </p>

          <div className="mt-12 w-full flex justify-center md:justify-start pl-55">
            <button
              onClick={() => navigate("/essay")}
              className="flex items-center justify-center text-xl md:text-2xl tracking-wider rounded-2xl bg-white px-12 py-3.5 font-medium text-slate-900 shadow-sm border border-white/50 transition-all duration-200 hover:shadow-md hover:scale-[1.03] active:scale-[0.98] cursor-pointer uppercase"
            >
              Continue
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 z-0 w-[44%]">
        <img
          src="/front.png"
          alt="AESkolar Learning Illustration"
          className="w-full h-auto object-contain"
        />
      </div>
    </div>
  );
}