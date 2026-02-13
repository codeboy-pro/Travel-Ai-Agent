"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  MapPin,
  Sun,
  Moon,
  Cloud,
  CloudRain,
  Snowflake,
  Wind,
  User,
  Bot,
  Loader2,
  Plane,
  Compass,
  Globe,
  Sparkles,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Image as ImageIcon,
  MessageSquare,
  History,
  Trash2,
} from "lucide-react";
import { SYSTEM_PROMPT } from "@/constants/prompts";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const router = useRouter();
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Quick suggestion buttons
  const quickSuggestions = [
    { icon: "🏖️", text: "Beach destinations" },
    { icon: "🏔️", text: "Mountain getaways" },
    { icon: "🏛️", text: "Historical places" },
    { icon: "🍜", text: "Food tourism" },
  ];

  useEffect(() => {
    const checkAuthAndInit = async () => {
      if (!window.puter) {
        setTimeout(checkAuthAndInit, 500);
        return;
      }

      if (!(await window.puter.auth.isSignedIn())) {
        router.push("/login");
        return;
      }

      // Load theme preference
      try {
        const savedTheme = await window.puter.kv.get("travelbuddy_theme");
        if (savedTheme === "dark") {
          setDarkMode(true);
        }
      } catch (e) {
        console.log("Theme load error:", e);
      }

      // Load chat history
      await loadChatHistory();

      setTimeout(() => {
        setIsLoading(false);
        detectLocation();
      }, 2500);
    };

    checkAuthAndInit();
  }, [router]);

  // Load chat history from Puter.js
  const loadChatHistory = async () => {
    try {
      const historyData = await window.puter.kv.get("travelbuddy_history");
      if (historyData) {
        const parsed = JSON.parse(historyData);
        setChatHistory(parsed.slice(0, 10)); // Keep last 10 chats
      }
    } catch (e) {
      console.log("History load error:", e);
    }
  };

  // Save current chat to history
  const saveChatToHistory = async (chatMessages) => {
    if (!chatMessages || chatMessages.length < 2) return;

    try {
      const chatId = currentChatId || Date.now().toString();
      const firstUserMsg = chatMessages.find((m) => m.role === "user");
      const title = firstUserMsg?.content?.slice(0, 40) || "New Chat";

      const newChat = {
        id: chatId,
        title: title + (title.length >= 40 ? "..." : ""),
        timestamp: new Date().toISOString(),
        messages: chatMessages,
      };

      let history = [...chatHistory];
      const existingIdx = history.findIndex((h) => h.id === chatId);

      if (existingIdx >= 0) {
        history[existingIdx] = newChat;
      } else {
        history.unshift(newChat);
      }

      history = history.slice(0, 10); // Keep only last 10
      setChatHistory(history);
      setCurrentChatId(chatId);

      await window.puter.kv.set("travelbuddy_history", JSON.stringify(history));
    } catch (e) {
      console.log("Save history error:", e);
    }
  };

  // Load a specific chat from history
  const loadChat = (chat) => {
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    setSidebarOpen(false);
  };

  // Delete a chat from history
  const deleteChat = async (chatId, e) => {
    e.stopPropagation();
    try {
      const newHistory = chatHistory.filter((h) => h.id !== chatId);
      setChatHistory(newHistory);
      await window.puter.kv.set(
        "travelbuddy_history",
        JSON.stringify(newHistory),
      );
      if (currentChatId === chatId) {
        setCurrentChatId(null);
      }
    } catch (e) {
      console.log("Delete error:", e);
    }
  };

  // Toggle dark mode
  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    try {
      await window.puter.kv.set(
        "travelbuddy_theme",
        newMode ? "dark" : "light",
      );
    } catch (e) {
      console.log("Theme save error:", e);
    }
  };

  // Handle scroll detection for scroll-to-bottom button
  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Save chat to history when messages change
  useEffect(() => {
    if (messages.length >= 2 && !isLoading) {
      saveChatToHistory(messages);
    }
  }, [messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
  };

  const detectLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            );
            const data = await response.json();
            const city =
              data.address.city ||
              data.address.town ||
              data.address.village ||
              "your area";
            setLocation(city);
            fetchWeather(city);
            startAI(city);
          } catch (error) {
            console.error("Geocoding error:", error);
            askUserIntent();
          }
        },
        (error) => {
          console.error("Location denied:", error);
          askUserIntent();
        },
      );
    } else {
      askUserIntent();
    }
  };

  const fetchWeather = async (city) => {
    const key = process.env.NEXT_PUBLIC_WEATHER_KEY;
    if (!key) return;
    try {
      const resp = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${key}&units=metric`,
      );
      const data = await resp.json();
      if (data.main) {
        setWeather({
          temp: Math.round(data.main.temp),
          description: data.weather[0].description,
          icon: data.weather[0].main,
        });
      }
    } catch (e) {
      console.error("Weather fetch failed:", e);
    }
  };

  // Fetch single image from Unsplash
  const fetchImage = async (keyword) => {
    const key = process.env.NEXT_PUBLIC_UNSPLASH_KEY;
    if (!key || !keyword) return null;
    try {
      const cleanKeyword = keyword.replace(/[^a-zA-Z\s]/g, "").trim();
      const resp = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(cleanKeyword + " travel destination")}&per_page=1&orientation=landscape&client_id=${key}`,
      );
      const data = await resp.json();
      return data.results?.[0]?.urls?.regular || null;
    } catch (e) {
      console.error("Image fetch error:", e);
      return null;
    }
  };

  // Fetch multiple images for multiple destinations - IMPROVED WITH BETTER ERROR HANDLING
  const fetchMultipleImages = async (destinations) => {
    const key = process.env.NEXT_PUBLIC_UNSPLASH_KEY;
    console.log("=== IMAGE FETCH DEBUG ===");
    console.log("Destinations to fetch:", destinations);
    console.log("Unsplash key exists:", !!key);
    console.log("Key length:", key?.length);
    
    if (!key) {
      console.error("No Unsplash API key found! Check NEXT_PUBLIC_UNSPLASH_KEY environment variable.");
      return [];
    }
    
    if (!destinations.length) {
      console.log("No destinations provided");
      return [];
    }

    const imagePromises = destinations.slice(0, 4).map(async (dest) => {
      try {
        const cleanDest = dest.replace(/[^a-zA-Z\s,]/g, "").trim();
        const searchQuery = `${cleanDest} travel landmark`;
        console.log("Searching Unsplash for:", searchQuery);
        
        const resp = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=5&orientation=landscape&client_id=${key}`,
        );
        
        console.log("Unsplash response status:", resp.status);
        
        if (!resp.ok) {
          const errorText = await resp.text();
          console.error("Unsplash API error:", resp.status, errorText);
          return { destination: dest, url: null };
        }
        
        const data = await resp.json();
        console.log("Unsplash results for", dest, ":", data.results?.length || 0, "images");
        
        if (data.results && data.results.length > 0) {
          const randomIndex = Math.floor(
            Math.random() * Math.min(3, data.results.length),
          );
          return {
            destination: dest,
            url: data.results[randomIndex]?.urls?.regular || data.results[0]?.urls?.regular,
          };
        }
        
        return { destination: dest, url: null };
      } catch (e) {
        console.error("Image fetch error for", dest, ":", e.message);
        return { destination: dest, url: null };
      }
    });

    const results = await Promise.all(imagePromises);
    console.log("Final image results:", results);
    return results;
  };

  const startAI = (city) => {
    const initialMsg = {
      role: "assistant",
      content: `👋 Welcome to TravelBuddy! I see you're in **${city}**. 📍\n\n✨ I can help you:\n• 🗺️ Discover amazing places nearby\n• ✈️ Plan your next adventure\n• 🍜 Find the best local food\n• 💰 Get budget-friendly tips\n\nWhat would you like to explore today? 🌍`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages([initialMsg]);
  };

  const askUserIntent = () => {
    const initialMsg = {
      role: "assistant",
      content: `👋 Hello and welcome to TravelBuddy! ✨\n\nI'm here to help you plan your perfect trip! 🌍\n\nTell me:\n• 🏖️ Looking for beaches?\n• 🏔️ Want mountain adventures?\n• 🏛️ Interested in historical sites?\n• 🍜 Craving food tourism?\n\nOr just tell me a destination and I'll share everything you need to know! ✈️`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages([initialMsg]);
  };

  // Extract all destination keywords from text for image fetching - IMPROVED
  const extractDestinations = (text) => {
    const destinations = [];

    // Look for [DESTINATION: Name] pattern first
    const destMatches = text.match(/\[DESTINATION:\s*([^\]]+)\]/gi) || [];
    destMatches.forEach((match) => {
      const name = match
        .replace(/\[DESTINATION:\s*/i, "")
        .replace(/\]/g, "")
        .trim();
      if (name.length > 2) destinations.push(name);
    });

    // If no DESTINATION tags, look for bold text patterns like **Place Name**
    if (destinations.length === 0) {
      const boldMatches = text.match(/\*\*([^*]+)\*\*/g) || [];
      boldMatches.forEach((match) => {
        const name = match.replace(/\*/g, "").trim();
        // Filter out non-place bold text - be more permissive
        const excludeWords = [
          "why",
          "budget",
          "tip",
          "food",
          "time",
          "best",
          "pro",
          "must",
          "visit",
          "try",
        ];
        const lowerName = name.toLowerCase();
        if (
          name.length > 2 &&
          name.length < 50 &&
          !excludeWords.some((word) => lowerName.startsWith(word))
        ) {
          destinations.push(name);
        }
      });
    }

    // Fallback: look for capitalized place names
    if (destinations.length === 0) {
      const placeMatches = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || [];
      placeMatches.slice(0, 4).forEach((place) => {
        if (!destinations.includes(place) && place.length > 3) {
          destinations.push(place);
        }
      });
    }

    console.log("Extracted destinations:", destinations);
    return destinations.slice(0, 4); // Max 4 images
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      // Build conversation for AI
      const conversationContext = messages
        .slice(-6) // Only last 6 messages for context
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");

      const fullPrompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${conversationContext}\n\nUser: ${input}\n\nAssistant:`;

      let aiText = "";
      let usedFallback = false;

      // Try Gemini AI first (faster)
      const geminiKey = process.env.NEXT_PUBLIC_GEMINI_KEY;

      if (geminiKey && geminiKey.length > 10) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                  temperature: 0.85,
                  maxOutputTokens: 1500,
                  topP: 0.9,
                },
              }),
            },
          );

          clearTimeout(timeoutId);

          if (geminiResponse.ok) {
            const geminiData = await geminiResponse.json();
            aiText =
              geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }
        } catch (geminiError) {
          console.log(
            "Gemini failed, using Puter fallback:",
            geminiError.message,
          );
        }
      }

      // Fallback to Puter AI if Gemini fails or no key
      if (!aiText && window.puter?.ai) {
        usedFallback = true;
        try {
          const response = await window.puter.ai.chat(fullPrompt, {
            model: "gpt-4o-mini",
          });
          aiText =
            typeof response === "string"
              ? response
              : response?.message?.content ||
                response?.text ||
                String(response);
        } catch (puterError) {
          console.error("Puter AI also failed:", puterError);
        }
      }

      // If both AI services fail
      if (!aiText) {
        throw new Error("Both AI services unavailable");
      }

      // Extract all destinations for images
      const destinations = extractDestinations(aiText);
      let images = [];

      // Fetch images for all mentioned destinations
      if (destinations.length > 0) {
        images = await fetchMultipleImages(destinations);
      }

      const aiMsg = {
        role: "assistant",
        content: aiText,
        images: images.filter((img) => img.url), // Only include successful image fetches
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error("AI Error:", error);

      // Provide a helpful fallback response with emojis
      const fallbackResponses = [
        "🌍 I'd love to help you with that! Could you tell me more about what kind of destination you're looking for? 🏖️ Beach, 🏔️ mountains, 🏙️ city, or something else?",
        "✨ Great question! To give you the best recommendations, could you share what type of travel experience you're after? 🎯",
        "🗺️ I'm here to help plan your trip! What's your ideal vacation - 🏃 adventure, 😌 relaxation, 🏛️ culture, or 🍜 food exploration?",
      ];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            fallbackResponses[
              Math.floor(Math.random() * fallbackResponses.length)
            ],
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleQuickSuggestion = (text) => {
    setInput(`Tell me about ${text}`);
    inputRef.current?.focus();
  };

  const handleLogout = async () => {
    await window.puter.auth.signOut();
    router.push("/login");
  };

  const getWeatherIcon = (icon) => {
    switch (icon) {
      case "Clear":
        return <Sun className="h-5 w-5 text-yellow-400" />;
      case "Rain":
        return <CloudRain className="h-5 w-5 text-blue-400" />;
      case "Snow":
        return <Snowflake className="h-5 w-5 text-sky-300" />;
      case "Wind":
        return <Wind className="h-5 w-5 text-gray-400" />;
      default:
        return <Cloud className="h-5 w-5 text-gray-400" />;
    }
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white overflow-hidden relative">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl animate-pulse [animation-delay:1s]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl animate-pulse [animation-delay:0.5s]"></div>
        </div>

        {/* Floating icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Plane className="absolute top-20 left-[20%] h-8 w-8 text-white/20 animate-bounce [animation-delay:0.2s]" />
          <Globe className="absolute top-32 right-[25%] h-6 w-6 text-white/20 animate-bounce [animation-delay:0.5s]" />
          <Compass className="absolute bottom-32 left-[30%] h-7 w-7 text-white/20 animate-bounce [animation-delay:0.8s]" />
          <MapPin className="absolute bottom-20 right-[20%] h-6 w-6 text-white/20 animate-bounce [animation-delay:1s]" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          {/* Main loader */}
          <div className="relative">
            <div className="h-28 w-28 rounded-full border-4 border-white/20 animate-[spin_3s_linear_infinite]">
              <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-white animate-[spin_1.5s_linear_infinite_reverse]"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Plane className="h-8 w-8 text-white animate-pulse" />
              </div>
            </div>
          </div>

          <h1 className="mt-10 text-4xl md:text-5xl font-bold tracking-tight text-center">
            TravelBuddy
          </h1>
          <div className="mt-3 flex items-center gap-2 text-purple-200">
            <Sparkles className="h-5 w-5" />
            <span className="text-lg">Your personal travel companion</span>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-white animate-bounce"></div>
            <div className="h-2 w-2 rounded-full bg-white animate-bounce [animation-delay:0.2s]"></div>
            <div className="h-2 w-2 rounded-full bg-white animate-bounce [animation-delay:0.4s]"></div>
          </div>
          <p className="mt-4 text-purple-200 animate-pulse">
            Getting things ready for you...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-[100dvh] transition-colors duration-300 ${darkMode ? "bg-gray-900" : "bg-gradient-to-br from-slate-50 to-blue-50/50"}`}
    >
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Beautiful Gradient Sidebar - Adapts to Dark Mode */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 ${sidebarCollapsed ? "w-20" : "w-80"} ${
          darkMode
            ? "bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 border-r border-gray-700/50"
            : "bg-gradient-to-b from-indigo-600 via-purple-600 to-pink-600"
        } shadow-2xl transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } flex flex-col`}
      >
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {darkMode ? (
            <>
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-40 -left-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
              <div className="absolute top-1/2 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl"></div>
            </>
          ) : (
            <>
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-40 -left-20 w-40 h-40 bg-pink-400/20 rounded-full blur-3xl"></div>
              <div className="absolute top-1/2 right-0 w-32 h-32 bg-cyan-400/10 rounded-full blur-2xl"></div>
            </>
          )}
        </div>

        {/* Sidebar Content - Scrollable */}
        <div className="flex flex-col h-full text-white relative z-10 overflow-hidden">
          {/* Toggle Button - Desktop */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden md:flex absolute -right-3 top-8 h-7 w-7 rounded-full shadow-lg items-center justify-center hover:scale-110 transition-all z-50 ${
              darkMode
                ? "bg-gray-700 text-purple-400 hover:bg-gray-600 border border-gray-600"
                : "bg-white text-purple-600 hover:bg-purple-50"
            }`}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          {/* Sidebar Header */}
          <div
            className={`p-4 border-b flex-shrink-0 ${darkMode ? "border-gray-700/50" : "border-white/20"}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`h-11 w-11 rounded-2xl backdrop-blur-sm flex items-center justify-center shadow-lg flex-shrink-0 ${
                    darkMode
                      ? "bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/30"
                      : "bg-white/20 border border-white/30"
                  }`}
                >
                  <Plane
                    className={`h-5 w-5 ${darkMode ? "text-purple-400" : "text-white"}`}
                  />
                </div>
                {!sidebarCollapsed && (
                  <div>
                    <h1
                      className={`font-bold text-lg tracking-tight ${darkMode ? "text-white" : ""}`}
                    >
                      TravelBuddy
                    </h1>
                    <p
                      className={`text-[10px] ${darkMode ? "text-gray-400" : "text-white/70"}`}
                    >
                      ✨ Your AI travel guide
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className={`md:hidden p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-white/10"}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Middle Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Weather Card */}
            {!sidebarCollapsed && (
              <>
                {weather && location ? (
                  <div
                    className={`mx-3 mt-3 p-3 rounded-xl backdrop-blur-md shadow-lg ${
                      darkMode
                        ? "bg-gray-800/80 border border-gray-700/50"
                        : "bg-white/15 border border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold">{weather.temp}°</p>
                        <p
                          className={`text-xs capitalize mt-1 ${darkMode ? "text-gray-400" : "text-white/80"}`}
                        >
                          {weather.description}
                        </p>
                      </div>
                      <div
                        className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                          darkMode ? "bg-gray-700/50" : "bg-white/20"
                        }`}
                      >
                        {getWeatherIcon(weather.icon)}
                      </div>
                    </div>
                    <div
                      className={`mt-3 pt-2 border-t flex items-center gap-2 ${darkMode ? "border-gray-700/50" : "border-white/20"}`}
                    >
                      <MapPin
                        className={`h-3 w-3 ${darkMode ? "text-purple-400" : "text-pink-300"}`}
                      />
                      <span
                        className={`text-xs font-medium ${darkMode ? "text-gray-300" : "text-white/90"}`}
                      >
                        {location}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`mx-3 mt-3 p-3 rounded-xl backdrop-blur-sm ${
                      darkMode
                        ? "bg-gray-800/50 border border-gray-700/50"
                        : "bg-white/10 border border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          darkMode ? "bg-gray-700/50" : "bg-white/20"
                        }`}
                      >
                        <MapPin
                          className={`h-4 w-4 ${darkMode ? "text-gray-500" : "text-white/70"}`}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium">
                          📍 Location needed
                        </p>
                        <p
                          className={`text-[10px] ${darkMode ? "text-gray-500" : "text-white/60"}`}
                        >
                          Allow access for weather
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Collapsed Weather Icon */}
            {sidebarCollapsed && weather && (
              <div
                className={`mx-auto mt-3 h-12 w-12 rounded-lg flex items-center justify-center ${
                  darkMode
                    ? "bg-gray-800/80 border border-gray-700/50"
                    : "bg-white/15 border border-white/20"
                }`}
              >
                {getWeatherIcon(weather.icon)}
              </div>
            )}

            {/* Quick Explore Section */}
            <div className={`p-3 ${sidebarCollapsed ? "px-2" : ""}`}>
              {!sidebarCollapsed && (
                <p
                  className={`text-[10px] font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? "text-gray-500" : "text-white/60"}`}
                >
                  🚀 Quick Explore
                </p>
              )}
              <div
                className={`${sidebarCollapsed ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2"}`}
              >
                {quickSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      handleQuickSuggestion(item.text);
                      setSidebarOpen(false);
                    }}
                    title={sidebarCollapsed ? item.text : undefined}
                    className={`flex ${sidebarCollapsed ? "justify-center" : "flex-col items-center gap-1"} p-2 rounded-lg transition-all text-center group hover:scale-105 ${
                      darkMode
                        ? "bg-gray-800/50 hover:bg-gray-700/80 border border-gray-700/50 hover:border-purple-500/30"
                        : "bg-white/10 hover:bg-white/25 border border-white/10 hover:border-white/30"
                    }`}
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && (
                      <span
                        className={`text-[10px] font-medium transition-colors ${
                          darkMode
                            ? "text-gray-400 group-hover:text-purple-300"
                            : "text-white/90 group-hover:text-white"
                        }`}
                      >
                        {item.text}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat History Section */}
            {!sidebarCollapsed && chatHistory.length > 0 && (
              <div className="px-3 pb-3">
                <p
                  className={`text-[10px] font-bold uppercase tracking-widest mb-2 px-1 flex items-center gap-1 ${darkMode ? "text-gray-500" : "text-white/60"}`}
                >
                  <History className="h-3 w-3" /> Recent Chats
                </p>
                <div className="space-y-1.5">
                  {chatHistory.slice(0, 7).map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => loadChat(chat)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left group ${
                        darkMode
                          ? currentChatId === chat.id
                            ? "bg-purple-500/20 border border-purple-500/30"
                            : "bg-gray-800/30 hover:bg-gray-700/50 border border-transparent hover:border-gray-600/50"
                          : currentChatId === chat.id
                            ? "bg-white/25 border border-white/30"
                            : "bg-white/5 hover:bg-white/15 border border-transparent hover:border-white/20"
                      }`}
                    >
                      <MessageSquare
                        className={`h-3.5 w-3.5 flex-shrink-0 ${darkMode ? "text-gray-500" : "text-white/60"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-medium truncate ${darkMode ? "text-gray-300" : "text-white/90"}`}
                        >
                          {chat.title}
                        </p>
                        <p
                          className={`text-[9px] ${darkMode ? "text-gray-600" : "text-white/50"}`}
                        >
                          {new Date(chat.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteChat(chat.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/30 rounded transition-all"
                        title="Delete chat"
                      >
                        <Trash2 className="h-3 w-3 text-white/60 hover:text-red-300" />
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Collapsed History Icon */}
            {sidebarCollapsed && chatHistory.length > 0 && (
              <div
                className={`mx-auto mt-2 h-10 w-10 rounded-lg flex items-center justify-center ${
                  darkMode
                    ? "bg-gray-800/50 border border-gray-700/50"
                    : "bg-white/10 border border-white/20"
                }`}
                title="Chat History"
              >
                <History
                  className={`h-4 w-4 ${darkMode ? "text-gray-500" : "text-white/70"}`}
                />
              </div>
            )}
          </div>

          {/* Fixed Bottom Section */}
          <div
            className={`p-3 border-t space-y-2 ${sidebarCollapsed ? "px-2" : ""} flex-shrink-0 ${
              darkMode
                ? "border-gray-700/50 bg-gradient-to-t from-gray-900/80 to-transparent"
                : "border-white/20 bg-gradient-to-t from-pink-600/50 to-transparent"
            }`}
          >
            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              title={
                sidebarCollapsed
                  ? darkMode
                    ? "Light Mode"
                    : "Dark Mode"
                  : undefined
              }
              className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "justify-center"} gap-2 px-3 py-2.5 rounded-lg font-medium transition-all ${
                darkMode
                  ? "bg-gray-800/80 hover:bg-gray-700 border border-gray-700 hover:border-purple-500/50"
                  : "bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/30"
              }`}
            >
              {darkMode ? (
                <Sun className="h-4 w-4 text-yellow-400" />
              ) : (
                <Moon className="h-4 w-4 text-blue-200" />
              )}
              {!sidebarCollapsed && (
                <span className={`text-xs ${darkMode ? "text-gray-300" : ""}`}>
                  {darkMode ? "Light Mode" : "Dark Mode"}
                </span>
              )}
            </button>

            {/* New Chat Button */}
            <button
              onClick={() => {
                setMessages([]);
                setCurrentChatId(null);
                if (location) startAI(location);
                else askUserIntent();
                setSidebarOpen(false);
              }}
              title={sidebarCollapsed ? "New Conversation" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "justify-center"} gap-2 px-3 py-2.5 rounded-lg font-medium transition-all hover:scale-[1.02] ${
                darkMode
                  ? "bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-500 hover:to-blue-500 border border-purple-500/30"
                  : "bg-white/20 hover:bg-white/30 border border-white/20 hover:border-white/40"
              }`}
            >
              <Sparkles
                className={`h-4 w-4 ${darkMode ? "text-purple-300" : ""}`}
              />
              {!sidebarCollapsed && (
                <span className="text-xs font-semibold">New Chat</span>
              )}
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              title={sidebarCollapsed ? "Sign Out" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "justify-center"} gap-2 px-3 py-2.5 rounded-lg transition-all ${
                darkMode
                  ? "text-gray-400 hover:text-red-400 hover:bg-red-500/20 border border-transparent hover:border-red-500/30"
                  : "text-white/80 hover:text-white hover:bg-red-500/30 border border-transparent hover:border-red-400/30"
              }`}
            >
              <LogOut className="h-4 w-4" />
              {!sidebarCollapsed && <span className="text-xs">Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className={`flex items-center justify-between px-4 md:px-6 py-4 backdrop-blur-md border-b sticky top-0 z-30 transition-colors duration-300 ${
            darkMode
              ? "bg-gray-800/90 border-gray-700"
              : "bg-white/80 border-slate-200/50"
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className={`md:hidden p-2 -ml-2 rounded-xl transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-slate-100"}`}
            >
              <Menu
                className={`h-5 w-5 ${darkMode ? "text-gray-300" : "text-slate-600"}`}
              />
            </button>
            {/* Desktop toggle button when sidebar is collapsed */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`hidden md:flex p-2 -ml-2 rounded-xl transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-slate-100"}`}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <Menu
                  className={`h-5 w-5 ${darkMode ? "text-gray-300" : "text-slate-600"}`}
                />
              ) : (
                <ChevronLeft
                  className={`h-5 w-5 ${darkMode ? "text-gray-300" : "text-slate-600"}`}
                />
              )}
            </button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 ${darkMode ? "border-gray-800" : "border-white"}`}
                ></span>
              </div>
              <div>
                <h1
                  className={`font-bold ${darkMode ? "text-white" : "text-slate-800"}`}
                >
                  TravelBuddy
                </h1>
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Online
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className={`md:hidden p-2 rounded-xl transition-colors ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-slate-100 hover:bg-slate-200"}`}
              title={darkMode ? "Light Mode" : "Dark Mode"}
            >
              {darkMode ? (
                <Sun className="h-5 w-5 text-yellow-400" />
              ) : (
                <Moon className="h-5 w-5 text-indigo-500" />
              )}
            </button>

            {/* Mobile Weather */}
            {weather && (
              <div
                className={`md:hidden flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                  darkMode
                    ? "bg-gray-700/50 border-gray-600"
                    : "bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-100"
                }`}
              >
                {getWeatherIcon(weather.icon)}
                <span
                  className={`text-sm font-semibold ${darkMode ? "text-purple-300" : "text-purple-700"}`}
                >
                  {weather.temp}°
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Messages Container */}
        <main
          ref={chatContainerRef}
          onScroll={handleScroll}
          className={`flex-1 overflow-y-auto relative transition-colors duration-300 ${darkMode ? "bg-gray-900" : ""}`}
        >
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-3 duration-500`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div
                  className={`flex gap-3 max-w-[90%] md:max-w-[80%] ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`shrink-0 ${msg.role === "user" ? "self-end" : "self-start"}`}
                  >
                    {msg.role === "user" ? (
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    ) : (
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`relative px-5 py-3.5 shadow-sm ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl rounded-br-md"
                          : darkMode
                            ? "bg-gray-800 border border-gray-700 text-gray-200 rounded-2xl rounded-bl-md shadow-lg shadow-black/20"
                            : "bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-bl-md shadow-lg shadow-slate-200/50"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                        {msg.content}
                      </p>
                      {/* Single image (legacy support) */}
                      {msg.image && (
                        <div className="mt-4 -mx-2 -mb-1 overflow-hidden rounded-xl">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.image}
                            alt="Travel destination"
                            className="w-full h-52 object-cover hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                      {/* Multiple images grid */}
                      {msg.images && msg.images.length > 0 && (
                        <div
                          className={`mt-4 -mx-2 -mb-1 grid gap-2 ${msg.images.length === 1 ? "grid-cols-1" : msg.images.length === 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`}
                        >
                          {msg.images.map((img, imgIdx) => (
                            <div
                              key={imgIdx}
                              className="overflow-hidden rounded-xl relative group"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img.url}
                                alt={img.destination}
                                className="w-full h-40 object-cover hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                <p className="text-white text-xs font-medium truncate">
                                  {img.destination}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-[11px] px-1 ${msg.role === "user" ? "text-right" : "text-left"} ${darkMode ? "text-gray-500" : "text-slate-400"}`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-3 duration-300">
                <div className="flex gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div
                    className={`px-5 py-4 rounded-2xl rounded-bl-md shadow-lg ${darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-slate-100 shadow-slate-200/50"}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 animate-bounce"></span>
                      <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 animate-bounce [animation-delay:0.15s]"></span>
                      <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 animate-bounce [animation-delay:0.3s]"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Scroll to Bottom Button */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className={`fixed bottom-28 right-6 md:right-10 h-12 w-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-20 ${
                darkMode
                  ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/50"
                  : "bg-white hover:bg-gray-50 text-purple-600 shadow-slate-300/50 border border-slate-200"
              }`}
              title="Scroll to bottom"
            >
              <ChevronDown className="h-6 w-6" />
            </button>
          )}
        </main>

        {/* Input Area */}
        <footer
          className={`sticky bottom-0 pt-4 pb-4 px-4 md:px-6 transition-colors duration-300 ${
            darkMode
              ? "bg-gradient-to-t from-gray-900 via-gray-900 to-transparent"
              : "bg-gradient-to-t from-white via-white to-transparent"
          }`}
        >
          {/* Quick Suggestions (shown when no messages from user) */}
          {messages.length <= 1 && (
            <div className="max-w-4xl mx-auto mb-4 flex flex-wrap gap-2 justify-center">
              {quickSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickSuggestion(item.text)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-sm shadow-sm ${
                    darkMode
                      ? "bg-gray-800 border-gray-700 text-gray-300 hover:border-purple-500 hover:bg-gray-700 hover:text-purple-300"
                      : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSend} className="max-w-4xl mx-auto">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Where would you like to travel?"
                className={`w-full rounded-2xl border py-4 pl-6 pr-14 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all shadow-lg ${
                  darkMode
                    ? "bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 shadow-black/20"
                    : "bg-white border-slate-200 text-slate-700 placeholder:text-slate-400 shadow-slate-200/50"
                }`}
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className={`absolute right-2 h-11 w-11 flex items-center justify-center rounded-xl transition-all duration-300 ${
                  input.trim() && !isTyping
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105"
                    : darkMode
                      ? "bg-gray-700 text-gray-500"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {isTyping ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
          </form>

          <p
            className={`mt-3 text-center text-[11px] ${darkMode ? "text-gray-500" : "text-slate-400"}`}
          >
            Always verify travel details and bookings with official sources
          </p>
        </footer>
      </div>
    </div>
  );
}
