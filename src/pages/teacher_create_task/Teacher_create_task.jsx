import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getSession,
  createAssignmentTask,
  updateAssignmentTask,
} from "../../services/api.js";

export default function Teacher_create_task() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedClass = location.state?.selectedClass || null;
  const editingTask = location.state?.editingTask || null;

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState(null); // Store as Date object or null
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [links, setLinks] = useState([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [newLink, setNewLink] = useState("");
  const [rubricUrl, setRubricUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize data if editing
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title || "");
      setInstructions(editingTask.instruction || "");
      if (editingTask.due_date) {
        // Try to parse existing due_date
        const parsedDate = new Date(editingTask.due_date);
        if (!isNaN(parsedDate.getTime())) {
          setDueDate(parsedDate);
        }
      }
      setAttachments(editingTask.attachments || []);
      setLinks(editingTask.links || []);
      setRubricUrl(editingTask.rubric_url || "");
    }
  }, [editingTask]);

  const formatDueDateDisplay = () => {
    if (!dueDate) return "No Due Date";
    return dueDate.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleDateChange = (e) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      if (dueDate) {
        // Preserve existing time if any
        newDate.setHours(dueDate.getHours(), dueDate.getMinutes());
      } else {
        // Default to 11:59 PM if no time set
        newDate.setHours(23, 59);
      }
      setDueDate(newDate);
    }
  };

  const handleTimeChange = (e) => {
    if (dueDate) {
      const [hours, minutes] = e.target.value.split(":");
      const newDate = new Date(dueDate);
      newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10));
      setDueDate(newDate);
    }
  };

  const getDateInputValue = () => {
    if (!dueDate) return "";
    return dueDate.toISOString().split("T")[0];
  };

  const getTimeInputValue = () => {
    if (!dueDate) return "23:59";
    return dueDate.toTimeString().slice(0, 5);
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map((file) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      type: file.type,
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (id) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  const handleAddLink = () => {
    if (newLink.trim()) {
      setLinks([...links, { id: Date.now(), url: newLink.trim() }]);
      setNewLink("");
      setShowLinkModal(false);
    }
  };

  const removeLink = (id) => {
    setLinks(links.filter((l) => l.id !== id));
  };

  const handleRubricUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setRubricUrl(file.name);
    } else {
      alert("Please upload a PDF file for the rubric.");
    }
  };

  const handleAssign = async () => {
    if (!title.trim()) {
      alert("Please enter a title for the assignment.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { session } = await getSession();
      if (!session) {
        navigate("/sign_in");
        return;
      }

      const taskData = {
        title: title.trim(),
        instruction: instructions.trim(),
        ...(selectedClass?.id && { class_id: selectedClass.id }),
        ...(session.user.id && { teacher_id: session.user.id }),
        ...(dueDate && { due_date: dueDate.toISOString() }),
        attachments,
        links,
        ...(rubricUrl && { rubric_url: rubricUrl }),
      };

      if (editingTask) {
        // Update existing task
        const { error } = await updateAssignmentTask(editingTask.id, taskData);

        if (error) {
          console.error("Supabase error:", error);
          alert(`Error updating assignment: ${error.message}`);
          return;
        }
        alert("Assignment updated successfully!");
      } else {
        // Create new task
        const { data, error } = await createAssignmentTask({
          ...taskData,
          created_by: session.user.id,
          status: "active",
        });

        if (error) {
          console.error("Supabase error:", error);
          alert(`Error creating assignment: ${error.message}`);
          return;
        }
        alert("Assignment created successfully!");
      }

      navigate("/teacher_dashboard");
    } catch (err) {
      console.error("Error:", err);
      alert(`Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#c5ecff] p-6 font-sans overflow-hidden box-border">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/teacher_dashboard")}
          title="Go Back"
          className="bg-transparent border-none p-0 m-0 cursor-pointer transition-all duration-200 hover:opacity-80 flex items-center focus:outline-none active:scale-95"
        >
          <img
            src="/logo.png"
            alt="AESkolar Logo - Go Back"
            className="h-16 w-auto object-contain"
          />
        </button>
        <div className="flex flex-col">
          <span className="text-[44px] font-bold text-[#1e293b] tracking-tight leading-none">
            AESkolar
          </span>
          <span className="text-xs text-[#475569] mt-0.5 ml-1">
            {editingTask ? "Edit Assignment" : "Create New Assignment"}
            {selectedClass && (
              <span className="ml-2 text-[#7ba4cc]">
                for {selectedClass.class_name}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
        {/* Left Section */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-custom">
          {/* Title Input */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <label className="block text-sm font-semibold text-[#475569] mb-2">
              Assignment Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter assignment title..."
              className="w-full text-2xl font-semibold border-none outline-none text-[#1e293b] placeholder-[#cbd5e1]"
            />
          </div>

          {/* Instructions Section */}
          <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col flex-1 min-h-[200px]">
            <label className="block text-sm font-semibold text-[#475569] mb-2">
              Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Add assignment instructions..."
              className="flex-1 w-full resize-none border-none outline-none text-sm text-[#475569] placeholder-[#cbd5e1] bg-transparent"
            />

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="mt-4 border-t border-[#cbd5e1]/50 pt-4">
                <h4 className="text-sm font-semibold text-[#475569] mb-2">
                  Attachments
                </h4>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 bg-[#f1f5f9] px-3 py-2 rounded-lg text-sm"
                    >
                      <span className="text-[#475569] truncate max-w-[200px]">
                        {a.name}
                      </span>
                      <button
                        onClick={() => removeAttachment(a.id)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Links Preview */}
            {links.length > 0 && (
              <div className="mt-4 border-t border-[#cbd5e1]/50 pt-4">
                <h4 className="text-sm font-semibold text-[#475569] mb-2">
                  Links
                </h4>
                <div className="flex flex-wrap gap-2">
                  {links.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-2 bg-[#f1f5f9] px-3 py-2 rounded-lg text-sm"
                    >
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#3b82f6] hover:underline truncate max-w-[200px]"
                      >
                        {l.url}
                      </a>
                      <button
                        onClick={() => removeLink(l.id)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Attach Section */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-[#1e293b] mb-4">Attach</h3>
            <div className="flex gap-6 justify-center">
              <label className="flex flex-col items-center gap-2 transition-transform cursor-pointer hover:scale-110">
                <div className="w-14 h-14 rounded-full border border-slate-200 flex items-center justify-center shadow-sm">
                  <img
                    src="/upload.png"
                    alt="Upload"
                    className="w-7 h-7 object-contain"
                  />
                </div>
                <span className="text-xs font-medium text-[#475569]">
                  Upload
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              <button
                onClick={() => setShowLinkModal(true)}
                className="flex flex-col items-center gap-2 transition-transform cursor-pointer hover:scale-110"
              >
                <div className="w-14 h-14 rounded-full border border-slate-200 flex items-center justify-center shadow-sm">
                  <img
                    src="/link.png"
                    alt="Link"
                    className="w-7 h-7 object-contain"
                  />
                </div>
                <span className="text-xs font-medium text-[#475569]">Link</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-white rounded-2xl p-6 flex flex-col gap-6 shadow-sm border border-slate-200">
          {/* Rubric */}
          {/* <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-[#1e293b] text-sm">
              Rubric (PDF)
            </h3>
            {rubricUrl ? (
              <div className="flex items-center justify-between bg-[#f1f5f9] p-3 rounded-lg">
                <span className="text-sm truncate">{rubricUrl}</span>
                <button
                  onClick={() => {
                    setRubricUrl("");
                  }}
                  className="text-red-500 hover:text-red-700 font-bold text-sm"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="w-full bg-white text-slate-800 font-medium py-2 px-4 border border-[#cbd5e1] rounded-lg shadow-sm text-sm hover:border-[#7ba4cc] active:scale-95 cursor-pointer transition-all text-center">
                + Upload Rubric
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleRubricUpload}
                />
              </label>
            )}
          </div> */}

          {/* Points - Fixed at 10 */}
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-[#1e293b] text-sm">Points</h3>
            <div className="relative">
              <input
                type="number"
                value={10}
                readOnly
                className="w-full p-3 border border-[#cbd5e1] rounded-lg outline-none bg-[#f8fafc] text-center text-lg font-bold text-[#1e293b]"
              />
            </div>
          </div>

          {/* Due Date */}
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-[#1e293b] text-sm">Due</h3>
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="w-full p-3 border border-[#cbd5e1] rounded-lg text-left bg-white hover:border-[#7ba4cc] cursor-pointer transition-all"
              >
                {formatDueDateDisplay()}
              </button>
              {showDatePicker && (
                <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-[#cbd5e1] rounded-lg shadow-lg p-4 w-68 flex flex-col gap-4">
                  <input
                    type="date"
                    value={getDateInputValue()}
                    onChange={handleDateChange}
                    className="w-full border p-2 rounded cursor-pointer"
                  />
                  <input
                    type="time"
                    value={getTimeInputValue()}
                    onChange={handleTimeChange}
                    className="w-[full] border p-2 rounded cursor-pointer"
                  />
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="text-sm text-slate-500 hover:text-slate-700 self-end"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Assign Button */}
          <button
            onClick={handleAssign}
            disabled={isSubmitting}
            className="mt-auto w-full bg-[#7ba4cc] text-white border-2 border-[#7ba4cc] rounded-lg py-3 font-semibold hover:bg-[#6996b3] active:scale-95 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? editingTask
                ? "Updating..."
                : "Creating..."
              : editingTask
                ? "Update"
                : "Assign"}
          </button>
        </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold text-[#1e293b] mb-4">Add Link</h3>
            <input
              type="url"
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              placeholder="Enter link URL..."
              className="w-full p-3 border border-[#cbd5e1] rounded-lg mb-4 focus:outline-none focus:border-[#7ba4cc]"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setNewLink("");
                }}
                className="px-5 py-2 rounded-lg border border-[#cbd5e1] text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLink}
                className="px-5 py-2 rounded-lg bg-[#7ba4cc] text-white hover:bg-[#6996b3]"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
