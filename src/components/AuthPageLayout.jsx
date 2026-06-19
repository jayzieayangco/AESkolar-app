import { useNavigate } from "react-router-dom";

/**
 * Sign-in / Sign-up shell. `illustrationSide` controls whether the
 * illustration is rendered on the left or right (desktop only).
 */
export default function AuthPageLayout({ children, backTo = "/", illustrationSide = "right" }) {
  const navigate = useNavigate();
  const isLeft = illustrationSide === "left";

  const handleBack = () => navigate(backTo);

  const main = (
    <div className="flex flex-col flex-1 h-full gap-4 min-w-0 items-center justify-center">
      <div className="w-full max-w-3xl">
        <div className="p-8">{children}</div>
      </div>
    </div>
  );

  const illustration = (
    <div
      className={`hidden lg:block flex-1 relative pointer-events-none overflow-visible`}
    >
      <img
        src="/signin_pic.png"
        alt=""
        className={`fixed bottom-0 object-contain opacity-90 ${isLeft ? "left-0 -translate-x-8" : "right-0 translate-x-8"} w-[700px]`}
        style={{ transformOrigin: isLeft ? "left bottom" : "right bottom" }}
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
    </div>
  );

  return (
    <div
      className={`flex h-screen w-screen bg-[#c5ecff] p-6 gap-6 font-sans overflow-hidden box-border ${
        isLeft ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {main}
      {illustration}
    </div>
  );
}

