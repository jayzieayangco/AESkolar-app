import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSession,
  syncUserToDatabase,
  updateUserRole,
} from "../../services/api.js";

export default function Role_selection() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSession().then(({ session }) => {
      if (!session) navigate("/sign_in");
      else syncUserToDatabase(session);
    });
  }, [navigate]);

  const handleSelectRole = async (role) => {
    try {
      setLoading(true);
      const { session } = await getSession();
      if (!session) {
        navigate("/sign_in");
        return;
      }
      await syncUserToDatabase(session, { role });
      const { error } = await updateUserRole(session.user.id, role);
      if (error) {
        alert(error.message || "Could not save role.");
        return;
      }
      navigate(role === "teacher" ? "/teacher_dashboard" : "/student_dashboard");
    } catch {
      alert("Failed to save role. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen w-full bg-[#c5ecff] px-6 py-12 font-sans select-none overflow-x-hidden">
      
      {/* HEADER SECTION */}
      <div className="text-center mt-6 md:mt-12 mb-10 md:mb-4">
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-normal text-slate-900 tracking-tight">
          Select your Role
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl font-medium text-slate-700 tracking-wide mt-2">
          Choose how you will use AESkolar
        </p>
      </div>

      {/* ROLES CONTAINER */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24 lg:gap-36 w-full max-w-6xl my-auto">
        
        {/* TEACHER CARD */}
        <div className="flex flex-col items-center group max-w-sm">
          <div className="w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 flex items-center justify-center p-2 transform transition-transform duration-300 group-hover:scale-105">
            <img
              src="/teacher.png"
              alt="Teacher illustration"
              className="w-full h-full object-contain"
            />
          </div>
          <button
            onClick={() => handleSelectRole("teacher")}
            disabled={loading}
            className="mt-6 w-56 sm:w-64 py-2.5 sm:py-3 border-2 border-slate-800 rounded-2xl bg-[#e3f6ff] text-xl sm:text-2xl font-medium text-slate-900 shadow-sm transition-all duration-200 hover:bg-slate-800 hover:text-white cursor-pointer disabled:opacity-50"
          >
            Teacher
          </button>
        </div>

        {/* STUDENT CARD */}
        <div className="flex flex-col items-center group max-w-sm">
          <div className="w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 flex items-center justify-center p-2 transform transition-transform duration-300 group-hover:scale-105">
            <img
              src="/student.png"
              alt="Student illustration"
              className="w-full h-full object-contain"
            />
          </div>
          <button
            onClick={() => handleSelectRole("student")}
            disabled={loading}
            className="mt-6 w-56 sm:w-64 py-2.5 sm:py-3 border-2 border-slate-800 rounded-2xl bg-[#e3f6ff] text-xl sm:text-2xl font-medium text-slate-900 shadow-sm transition-all duration-200 hover:bg-slate-800 hover:text-white cursor-pointer disabled:opacity-50"
          >
            Student
          </button>
        </div>

      </div>
    </div>
  );
}