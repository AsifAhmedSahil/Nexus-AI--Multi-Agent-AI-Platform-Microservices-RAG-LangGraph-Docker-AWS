import {
  Code2,
  FileText,
  Globe,
  ImageIcon,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  Presentation,
  Send,
  X,
  Zap,
} from "lucide-react";
import React, { useRef, useState } from "react";
import sendMessage from "../features/sendMessage";
import { useDispatch, useSelector } from "react-redux";
import { addMessages, setArtifacts, setMessages, setTyping } from "../redux/messageSlice";
import { createConversation } from "../features/createConversation";
import {
  addConversations,
  setConvTitle,
  setSelectedConversation,
} from "../redux/conversationSlice";
import { updateConversation } from "../features/updateConversation";
import { useEffect } from "react";

const ChatInput = () => {
  const [value, setValue] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("Auto");
  const { selectedConversation } = useSelector((state) => state.conversation);
  const { messages, typing } = useSelector((state) => state.message);
  const [selectedFile, setSelectedFile] = useState(null);
  const [listening,setListening] = useState(false)
  const recognitionRef = useRef(null)
  const fileRef = useRef(null);
  const dispatch = useDispatch();
  const textareaRef = useRef(null);

  const autoResize = (e) => {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

//   useEffect(() => {
//   const SpeechRecognition =
//     window.SpeechRecognition || window.webkitSpeechRecognition;

//   if (!SpeechRecognition) return;

//   const recognition = new SpeechRecognition();

//   recognition.lang = "en-US";
//   recognition.interimResults = true;
//   recognition.continuous = true;

//   recognition.onresult = (event) => {
//     console.log(event);
//   };

//   recognitionRef.current = recognition;
// }, []);

useEffect(() => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.log("Speech Recognition not supported");
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onresult = (event) => {
  let transcript = "";

  for (
    let index = 0;
    index < event.results.length;
    index++
  ) {
    transcript += event.results[index][0].transcript;
  }

  setValue(transcript);
};

recognition.onend=()=>{
  setListening(false)
}


  recognitionRef.current = recognition;
}, []);

const toggleMic = () => {
  if (!recognitionRef.current) {
    alert("speech recognition not supported");
    return;
  }

  if (listening) {
    recognitionRef.current.stop();
    setListening(false);
  } else {
    recognitionRef.current.start();
    setListening(true);
  }
};





const handleSendMessage = async () => {
  try {
    
    let conversation = selectedConversation;

    if (!conversation) {
      const conv = await createConversation();

      dispatch(setSelectedConversation(conv));
      dispatch(addConversations(conv));

      conversation = conv;
    }

    if (conversation.title === "New Chat") {
      await updateConversation({
        id: conversation._id,
        title: value.trim(),
      });

      dispatch(
        setConvTitle({
          conversationId: conversation._id,
          title: value.slice(0, 40),
        })
      );
    }

    const formData = new FormData();

    formData.append("prompt", value.trim());
    formData.append("conversationId", conversation._id);
    formData.append("agent", selectedAgent.toLowerCase());

    if (selectedFile) {
      formData.append("file", selectedFile);
    }

    const userImages = selectedFile?.type?.startsWith("image/")
      ? [URL.createObjectURL(selectedFile)]
      : [];

    dispatch(
      addMessages({
        role: "user",
        content: value.trim(),
        images: userImages,
        file:
          selectedFile?.type === "application/pdf"
            ? {
                name: selectedFile.name,
                size: selectedFile.size,
                url: URL.createObjectURL(selectedFile),
              }
            : undefined,
      })
    );

    setValue("");
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";

    dispatch(setTyping(true));

    const data = await sendMessage(formData);

    dispatch(setArtifacts(data?.artifacts || []));

    dispatch(
      addMessages({
        role: "assistant",
        content: data?.answer || "",
        images: data?.images || [],
      })
    );
  } catch (error) {
    console.error("Chat request failed:", error);

    let message = "Something went wrong while sending your message.";

    if (error.response?.status === 413) {
      message = "The uploaded file is too large. Please choose a smaller file.";
    }

    dispatch(
      addMessages({
        role: "assistant",
        content: message,
      })
    );
  } finally {
    dispatch(setTyping(false));
  }
};
  const agents = [
    {
      id: "auto",
      icon: Zap,
      label: "Auto",
    },
    {
      id: "chat",
      icon: MessageSquare,
      label: "Chat",
    },
    {
      id: "coding",
      icon: Code2,
      label: "Coding",
    },
    {
      id: "pdf",
      icon: FileText,
      label: "PDF",
    },
    {
      id: "ppt",
      icon: Presentation,
      label: "PPT",
    },
    {
      id: "vision",
      icon: ImageIcon,
      label: "Vision",
    },
    {
      id: "search",
      icon: Globe,
      label: "Search",
    },
  ];
  return (
    <div className="w-full max-w-full px-3 md:px-5 py-4 border-t border-white/[0.06] bg-[#0d0f14]">
      <div className="flex w-full max-w-full min-w-0 flex-col gap-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl px-4 pt-3.5 pb-3">
        <div className="flex w-full max-w-full min-w-0 flex-wrap items-center gap-2 pr-2">
          {agents.map((agent) => {
            const isActive = selectedAgent === agent.label;
            const Icon = agent.icon;

            return (
              <div
                onClick={() => setSelectedAgent(agent.label)}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-transparent shadow-[0_1px_8px_rgba(99,102,241,.35)]"
                    : "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.07]"
                }`}
              >
                <Icon
                  size={14}
                  className={isActive ? "text-white" : "text-slate-500"}
                />
                {agent.label}
              </div>
            );
          })}
        </div>

           {selectedFile && (
          <div className="my-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              {selectedFile?.type === "application/pdf" ? (
                <FileText size={16} className="text-red-400" />
              ) : (
                selectedFile?.type.startsWith("image/") && (
                  <img
                    src={URL.createObjectURL(selectedFile)}
                    alt={selectedFile.name}
                    className="w-10 h-10 rounded-md object-cover mt-3"
                  />
                )
              )}

              

              <div>
              <p className="text-xs text-white">{selectedFile?.name}</p>

              <p className="text-[10px] text-slate-500">
                {Math.ceil(selectedFile.size / 1024)} KB
              </p>
            </div>

            <button
              className="ml-2"
              onClick={() => {
                setSelectedFile(null);
                fileRef.current.value = "";
              }}
            >
              <X size={14} className="text-slate-500 hover:text-white" />
            </button>
            </div>

            
          </div>
        )}

        <textarea
          ref={textareaRef}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize(e);
          }}
          value={value}
          placeholder="Ask Anything..."
          className="w-full max-w-full min-w-0 resize-none bg-transparent outline-none text-[14px] text-slate-200 placeholder:text-slate-600 leading-relaxed disabled:opacity-50"
          rows={2}
        />
        <div className="flex w-full max-w-full min-w-0 items-center justify-between">
          <div className="flex min-w-0 items-center gap-1">
            <input
              type="file"
              accept=".pdf,image/*"
              hidden
              ref={fileRef}
              onChange={(e) => {
                const file = e.target.files[0];

                if (file) {
                  setSelectedFile(file);
                }
              }}
            />

            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all duration-150 bg-transparent cursor-pointer"
              onClick={() => fileRef.current.click()}
            >
              <Paperclip size={16} />
            </button>

            <button 
            onClick={toggleMic}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg  transition-all duration-150 bg-transparent cursor-pointer ${listening ? "bg-red-500 text-white":"text-slate-600 hover:bg-white/[0.05]"}`}>
              {
                listening? <Mic size={16} />:<MicOff size={16} />
              }
              
            </button>
          </div>
          <button
            disabled={!value && typing}
            onClick={handleSendMessage}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-none cursor-pointer transition-all duration-150 ${
              value.trim()
                ? "bg-linear-to-br from-indigo-500 to-violet-700 hover:opacity-90 text-white"
                : "bg-white/60 text-slate-600 cursor-not-allowed"
            }`}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
