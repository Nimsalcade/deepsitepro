/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { RiSparkling2Fill } from "react-icons/ri";
import { GrSend } from "react-icons/gr";
import classNames from "classnames";
import { toast } from "react-toastify";
import { useLocalStorage } from "react-use";
import { MdPreview } from "react-icons/md";
import { v4 as uuidv4 } from 'uuid';

import Login from "../login/login";
import { defaultHTML } from "./../../../utils/consts";
import SuccessSound from "./../../assets/success.mp3";
import Settings from "../settings/settings";
import ProModal from "../pro-modal/pro-modal";
// import SpeechPrompt from "../speech-prompt/speech-prompt";

function AskAI({
  html,
  setHtml,
  onScrollToBottom,
  isAiWorking,
  setisAiWorking,
  setView,
}: {
  html: string;
  setHtml: (html: string) => void;
  onScrollToBottom: () => void;
  isAiWorking: boolean;
  setView: React.Dispatch<React.SetStateAction<"editor" | "preview">>;
  setisAiWorking: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [hasAsked, setHasAsked] = useState(false);
  const [previousPrompt, setPreviousPrompt] = useState("");
  const [provider, setProvider] = useLocalStorage("provider", "auto");
  const [openProvider, setOpenProvider] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [openProModal, setOpenProModal] = useState(false);
  const [conversationId] = useState(() => uuidv4());

  const audio = new Audio(SuccessSound);
  audio.volume = 0.5;

  const handleStreamResponse = async (response: Response) => {
    if (!response.body) return null;
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let contentResponse = "";
    let lastRenderTime = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        // Check for continuation token
        if (chunk.includes("__CONTINUE__")) {
          // Remove continuation token from content
          contentResponse += chunk.replace("__CONTINUE__\n", "");
          
          // Request continuation
          const continueResponse = await fetch("/api/continue-response", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-conversation-id": conversationId
            }
          });

          if (!continueResponse.ok) {
            const errorText = await continueResponse.text();
            let errorMessage;
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.message || "Failed to continue response";
            } catch (e) {
              errorMessage = errorText || "Failed to continue response";
            }
            throw new Error(errorMessage);
          }

          // Process the continuation response
          await handleStreamResponse(continueResponse);
          break;
        }

        contentResponse += chunk;
        
        // Preserve existing real-time preview functionality
        const newHtml = contentResponse.match(/<!DOCTYPE html>[\s\S]*/)?.[0];
        if (newHtml) {
          let partialDoc = newHtml;
          if (!partialDoc.includes("</html>")) {
            partialDoc += "\n</html>";
          }

          const now = Date.now();
          if (now - lastRenderTime > 300) {
            setHtml(partialDoc);
            lastRenderTime = now;
          }

          if (partialDoc.length > 200) {
            onScrollToBottom();
          }
        }
      }
    } catch (error) {
      console.error("Stream processing error:", error);
      throw error;
    }

    return contentResponse;
  };

  const callAi = async () => {
    if (isAiWorking || !prompt.trim()) return;
    setisAiWorking(true);
    setProviderError("");
    
    let fullResponse = "";

    try {
      const request = await fetch("/api/ask-ai", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          provider,
          ...(html === defaultHTML ? {} : { html }),
          ...(previousPrompt ? { previousPrompt } : {})
        }),
        headers: {
          "Content-Type": "application/json",
          "x-conversation-id": conversationId
        }
      });

      if (!request.ok) {
        let errorMessage = "An error occurred";
        const responseText = await request.text();
        
        try {
          const errorResponse = JSON.parse(responseText);
          if (errorResponse.openLogin) {
            setOpen(true);
          } else if (errorResponse.openSelectProvider) {
            setOpenProvider(true);
            setProviderError(errorResponse.message);
          } else if (errorResponse.openProModal) {
            setOpenProModal(true);
          } else {
            errorMessage = errorResponse.message || errorMessage;
          }
        } catch (e) {
          errorMessage = responseText;
        }
        toast.error(errorMessage);
        setisAiWorking(false);
        return;
      }

      fullResponse = await handleStreamResponse(request) || "";
      
      const fileRegex = /<file path="(.*?)">([\s\S]*?)<\/file>/g;
      let match;
      const files = [];
      
      // Parse the complete response for multiple files
      while ((match = fileRegex.exec(fullResponse)) !== null) {
        const filePath = match[1];
        const fileContent = match[2];
        files.push({ path: filePath, content: fileContent });
      }
      
      // Use the index.html as the main preview if available
      const indexHtmlFile = files.find(file => file.path === "index.html");
      if (indexHtmlFile) {
        setHtml(indexHtmlFile.content);
      } else if (files.length > 0) {
        // Fall back to the first HTML file if no index.html
        const firstHtmlFile = files.find(file => file.path.endsWith('.html'));
        if (firstHtmlFile) {
          setHtml(firstHtmlFile.content);
        }
      }
      
      // Store all files in local storage for later access
      if (files.length > 0) {
        localStorage.setItem('generatedFiles', JSON.stringify(files));
      } else {
        // If no file structure detected, use the entire response as HTML
        const htmlContent = fullResponse.match(/<!DOCTYPE html>[\s\S]*<\/html>/)?.[0];
        if (htmlContent) {
          setHtml(htmlContent);
        }
      }

      toast.success("Application generated successfully");
      setPrompt("");
      setPreviousPrompt(prompt);
      setisAiWorking(false);
      setHasAsked(true);
      audio.play();
      setView("preview");

    } catch (error: any) {
      console.error("Request error:", error);
      setisAiWorking(false);
      toast.error(error.message || "An error occurred while processing your request");
      if (error.openLogin) {
        setOpen(true);
      }
    }
  };

  return (
    <div
      className={`bg-gray-950 rounded-xl py-2 lg:py-2.5 pl-3.5 lg:pl-4 pr-2 lg:pr-2.5 absolute lg:sticky bottom-3 left-3 lg:bottom-4 lg:left-4 w-[calc(100%-1.5rem)] lg:w-[calc(100%-2rem)] z-10 group ${
        isAiWorking ? "animate-pulse" : ""
      }`}
    >
      {defaultHTML !== html && (
        <button
          className="bg-white lg:hidden -translate-y-[calc(100%+8px)] absolute left-0 top-0 shadow-md text-gray-950 text-xs font-medium py-2 px-3 lg:px-4 rounded-lg flex items-center gap-2 border border-gray-100 hover:brightness-150 transition-all duration-100 cursor-pointer"
          onClick={() => setView("preview")}
        >
          <MdPreview className="text-sm" />
          View Preview
        </button>
      )}
      <div className="w-full relative flex items-center justify-between">
        <RiSparkling2Fill className="text-lg lg:text-xl text-gray-500 group-focus-within:text-pink-500" />
        <input
          type="text"
          disabled={isAiWorking}
          className="w-full bg-transparent max-lg:text-sm outline-none px-3 text-white placeholder:text-gray-500 font-code"
          placeholder={
            hasAsked ? "What do you want to ask AI next?" : "Ask AI anything..."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              callAi();
            }
          }}
        />
        <div className="flex items-center justify-end gap-2">
          {/* <SpeechPrompt setPrompt={setPrompt} /> */}
          <Settings
            provider={provider as string}
            onChange={setProvider}
            open={openProvider}
            error={providerError}
            onClose={setOpenProvider}
          />
          <button
            disabled={isAiWorking}
            className="relative overflow-hidden cursor-pointer flex-none flex items-center justify-center rounded-full text-sm font-semibold size-8 text-center bg-pink-500 hover:bg-pink-400 text-white shadow-sm dark:shadow-highlight/20 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-300"
            onClick={callAi}
          >
            <GrSend className="-translate-x-[1px]" />
          </button>
        </div>
      </div>
      <div
        className={classNames(
          "h-screen w-screen bg-black/20 fixed left-0 top-0 z-10",
          {
            "opacity-0 pointer-events-none": !open,
          }
        )}
        onClick={() => setOpen(false)}
      ></div>
      <div
        className={classNames(
          "absolute top-0 -translate-y-[calc(100%+8px)] right-0 z-10 w-80 bg-white border border-gray-200 rounded-lg shadow-lg transition-all duration-75 overflow-hidden",
          {
            "opacity-0 pointer-events-none": !open,
          }
        )}
      >
        <Login html={html}>
          <p className="text-gray-500 text-sm mb-3">
            You reached the limit of free AI usage. Please login to continue.
          </p>
        </Login>
      </div>
      <ProModal
        html={html}
        open={openProModal}
        onClose={() => setOpenProModal(false)}
      />
    </div>
  );
}

export default AskAI;
