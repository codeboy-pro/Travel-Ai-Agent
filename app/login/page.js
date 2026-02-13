"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      if (window.puter) {
        if (await window.puter.auth.isSignedIn()) {
          router.push("/chat");
        }
      } else {
        setTimeout(checkAuth, 500);
      }
    };
    checkAuth();
  }, [router]);

  const handleAuth = async () => {
    try {
      // Puter.auth.signIn() handles both login and signup in its UI
      await window.puter.auth.signIn();
      router.push("/chat");
    } catch (error) {
      console.error("Auth error:", error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-10 h-10"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 leading-tight">
            TravelBuddy
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your personal travel planning companion
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm">
            <button
              onClick={handleAuth}
              className="group relative flex w-full justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
            >
              Continue with Puter Account
            </button>
          </div>
          <div className="text-center text-xs text-gray-500 uppercase flex items-center gap-2 before:content-[''] before:flex-1 before:border-b before:border-gray-200 after:content-[''] after:flex-1 after:border-b after:border-gray-200">
            Secure Authentication
          </div>
        </div>
      </div>
    </div>
  );
}
