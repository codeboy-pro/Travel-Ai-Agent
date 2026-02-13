"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is signed in with Puter
    const checkAuth = async () => {
      if (window.puter) {
        if (await window.puter.auth.isSignedIn()) {
          router.push("/chat");
        } else {
          router.push("/login");
        }
      } else {
        setTimeout(checkAuth, 500);
      }
    };
    checkAuth();
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center text-white">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent mx-auto"></div>
        <h1 className="text-2xl font-bold">AI Travel Helper Agent</h1>
        <p className="mt-2 text-blue-100">Initializing your journey...</p>
      </div>
    </div>
  );
}
