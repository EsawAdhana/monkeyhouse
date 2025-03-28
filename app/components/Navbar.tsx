import Link from "next/link";

const Navbar = () => {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const hasSurvey = true; // Replace with actual logic to determine if a survey exists

  return (
    <div className="flex space-x-4">
      <Link
        href="/dashboard"
        className={`px-4 py-2 ${
          pathname === "/dashboard"
            ? "font-bold text-accent"
            : "text-gray-800 dark:text-gray-200 hover:text-accent dark:hover:text-accent"
        }`}
      >
        Dashboard
      </Link>
      <Link
        href="/messaging"
        className={`px-4 py-2 ${
          pathname.startsWith("/messaging")
            ? "font-bold text-accent"
            : "text-gray-800 dark:text-gray-200 hover:text-accent dark:hover:text-accent"
        }`}
      >
        Messages
      </Link>
      {hasSurvey && (
        <Link
          href="/survey"
          className={`px-4 py-2 ${
            pathname === "/survey"
              ? "font-bold text-accent"
              : "text-gray-800 dark:text-gray-200 hover:text-accent dark:hover:text-accent"
          }`}
        >
          Survey
        </Link>
      )}
    </div>
  );
};

export default Navbar; 