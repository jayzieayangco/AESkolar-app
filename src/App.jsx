import { useState } from "react";
import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Landing_page from "./pages/landing_page/Landing_page";
import Essay from "./pages/essay/Essay";
import Sign_in from "./pages/sign_in/Sign_in";
import Sign_up from "./pages/sign_up/Sign_up";
import Role_selection from "./pages/role_selection/Role_selection";
import Teacher_Dashboard from "./pages/teacher_dashboard/Teacher_dashboard";
import Teacher_Documents from "./pages/teacher_documents/Teacher_documents";
import Teacher_Grade_Essay from "./pages/teacher_grade_essay/Teacher_grade_essay";
import Teacher_Trash from "./pages/teacher_trash/Teacher_trash";
import Student_Dashboard from "./pages/student_dashboard/Student_dashboard";
import Teacher_create_task from "./pages/teacher_create_task/Teacher_create_task";
import Student_Documents from "./pages/student_documents/Student_documents";
import Student_Trash from "./pages/student_trash/Student_trash";
import Teacher_Settings from "./pages/teacher_settings/Teacher_settings";
import Teacher_essay_editor from "./pages/teacher_essay_editor/Teacher_essay_editor";
import Student_essay_editor from "./pages/student_essay_editor/Student_essay_editor";
import Student_Settings from "./pages/student_settings/Students_settings";
function App() {
  const [count, setCount] = useState(0);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing_page />} />
        <Route path="/essay" element={<Essay />} />
        <Route path="/sign_in" element={<Sign_in />} />
        <Route path="/sign_up" element={<Sign_up />} />
        <Route path="/role_selection" element={<Role_selection />} />
        <Route path="/teacher_dashboard" element={<Teacher_Dashboard />} />
        <Route path="/teacher_documents" element={<Teacher_Documents />} />
        <Route path="/teacher_grade_essay" element={<Teacher_Grade_Essay />} />
        <Route path="/teacher_trash" element={<Teacher_Trash />} />
        <Route path="/teacher_create_task" element={<Teacher_create_task />} />
        <Route path="/student_dashboard" element={<Student_Dashboard />} />
        <Route path="/student_documents" element={<Student_Documents />} />
        <Route path="/student_trash" element={<Student_Trash />} />
        <Route path="/teacher_settings" element={<Teacher_Settings />} />
        <Route
          path="/teacher_essay_editor"
          element={<Teacher_essay_editor />}
        />
        <Route
          path="/student_essay_editor"
          element={<Student_essay_editor />}
        />
        <Route path="/student_settings" element={<Student_Settings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

// import TestFetch from "./test"; // Make sure path is correct

// function App() {
//   return (
//     <div className="App">
//       <TestFetch />
//       {/* Rest of your app here */}
//     </div>
//   );
// }

// export default App;
