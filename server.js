import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
// Comment out HF Hub imports as they're only used for auth/deploy features
/*
import {
  createRepo,
  uploadFiles,
  whoAmI,
  spaceInfo,
  fileExists,
} from "@huggingface/hub";
*/
import { OpenAI } from "openai";
import bodyParser from "body-parser";
import cors from "cors";

// Comment out the auth middleware
// import checkUser from "./middlewares/checkUser.js";
import { PROVIDERS } from "./utils/providers.js";
import { COLORS } from "./utils/colors.js";

// Load environment variables from .env file
dotenv.config();

const app = express();

// Comment out IP rate limiting for local usage
// const ipAddresses = new Map();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
// Comment out redirect URI as we don't need auth
// const REDIRECT_URI =
//   process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/login`;
// const MODEL_ID = "deepseek-ai/DeepSeek-V3-0324";
// const MAX_REQUESTS_PER_IP = 2;

// Add CORS middleware
app.use(cors());
app.use(express.json());

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({
    ok: false,
    message: 'Something broke!'
  });
});

app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "dist")));

const getPTag = (repoId) => {
  return `<p style="border-radius: 8px; text-align: center; font-size: 12px; color: #fff; margin-top: 16px;position: fixed; left: 8px; bottom: 8px; z-index: 10; background: rgba(0, 0, 0, 0.8); padding: 4px 8px;">Made with <img src="https://enzostvs-deepsite.hf.space/logo.svg" alt="DeepSite Logo" style="width: 16px; height: 16px; vertical-align: middle;display:inline-block;margin-right:3px;filter:brightness(0) invert(1);"><a href="https://enzostvs-deepsite.hf.space" style="color: #fff;text-decoration: underline;" target="_blank" >DeepSite</a> - 🧬 <a href="https://enzostvs-deepsite.hf.space?remix=${repoId}" style="color: #fff;text-decoration: underline;" target="_blank" >Remix</a></p>`;
};

// Comment out all auth routes
/*
app.get("/api/login", (_req, res) => {
  res.redirect(
    302,
    `https://huggingface.co/oauth/authorize?client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid%20profile%20write-repos%20manage-repos%20inference-api&prompt=consent&state=1234567890`
  );
});
app.get("/auth/login", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(302, "/");
  }
  const Authorization = `Basic ${Buffer.from(
    `${process.env.OAUTH_CLIENT_ID}:${process.env.OAUTH_CLIENT_SECRET}`
  ).toString("base64")}`;

  const request_auth = await fetch("https://huggingface.co/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const response = await request_auth.json();

  if (!response.access_token) {
    return res.redirect(302, "/");
  }

  res.cookie("hf_token", response.access_token, {
    httpOnly: false,
    secure: true,
    sameSite: "none",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return res.redirect(302, "/");
});
app.get("/auth/logout", (req, res) => {
  res.clearCookie("hf_token", {
    httpOnly: false,
    secure: true,
    sameSite: "none",
  });
  return res.redirect(302, "/");
});

app.get("/api/@me", checkUser, async (req, res) => {
  const { hf_token } = req.cookies;
  try {
    const request_user = await fetch("https://huggingface.co/oauth/userinfo", {
      headers: {
        Authorization: `Bearer ${hf_token}`,
      },
    });

    const user = await request_user.json();
    res.send(user);
  } catch (err) {
    res.clearCookie("hf_token", {
      httpOnly: false,
      secure: true,
      sameSite: "none",
    });
    res.status(401).send({
      ok: false,
      message: err.message,
    });
  }
});

// Comment out deploy endpoint as it's HF-specific
app.post("/api/deploy", checkUser, async (req, res) => {
  const { html, title, path } = req.body;
  if (!html || !title) {
    return res.status(400).send({
      ok: false,
      message: "Missing required fields",
    });
  }

  const { hf_token } = req.cookies;
  try {
    const repo = {
      type: "space",
      name: path ?? "",
    };

    let readme;
    let newHtml = html;

    if (!path || path === "") {
      const { name: username } = await whoAmI({ accessToken: hf_token });
      const newTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .split("-")
        .filter(Boolean)
        .join("-")
        .slice(0, 96);

      const repoId = `${username}/${newTitle}`;
      repo.name = repoId;

      await createRepo({
        repo,
        accessToken: hf_token,
      });
      const colorFrom = COLORS[Math.floor(Math.random() * COLORS.length)];
      const colorTo = COLORS[Math.floor(Math.random() * COLORS.length)];
      readme = `---
title: ${newTitle}
emoji: 🐳
colorFrom: ${colorFrom}
colorTo: ${colorTo}
sdk: static
pinned: false
tags:
  - deepsite
---

Check out the configuration reference at https://huggingface.co/docs/hub/spaces-config-reference`;
    }

    newHtml = html.replace(/<\/body>/, `${getPTag(repo.name)}</body>`);
    const file = new Blob([newHtml], { type: "text/html" });
    file.name = "index.html"; // Add name property to the Blob

    const files = [file];
    if (readme) {
      const readmeFile = new Blob([readme], { type: "text/markdown" });
      readmeFile.name = "README.md"; // Add name property to the Blob
      files.push(readmeFile);
    }
    await uploadFiles({
      repo,
      files,
      accessToken: hf_token,
    });
    return res.status(200).send({ ok: true, path: repo.name });
  } catch (err) {
    return res.status(500).send({
      ok: false,
      message: err.message,
    });
  }
});
*/

// Add conversation state management
const activeConversations = new Map();

// Add an endpoint to set the API key
app.post("/api/set-api-key", express.json(), (req, res) => {
  const { apiKey } = req.body;
  
  if (!apiKey) {
    return res.status(400).send({
      ok: false,
      message: "API key is required"
    });
  }
  
  // Store the API key in memory (don't persist to disk for security)
  process.env.DEEPSEEK_API_KEY = apiKey;
  
  res.status(200).send({
    ok: true,
    message: "API key set successfully"
  });
});

// Modify the ask-ai endpoint to check for API key
app.post("/api/ask-ai", async (req, res) => {
  const { prompt, provider, html, previousPrompt } = req.body;
  if (!prompt) {
    return res.status(400).send({
      ok: false,
      message: "Missing required fields",
    });
  }

  // Check if API key is available
  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(401).send({
      ok: false,
      message: "API key is missing. Please set your API key first.",
      needApiKey: true
    });
  }

  // Set up response headers for streaming
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const conversationId = req.headers['x-conversation-id'];
    
  // Get or create conversation state
  let conversationState = activeConversations.get(conversationId) || {
    messages: [],
    completeResponse: '',
    isComplete: false
  };

  // Initialize messages if new conversation
  if (conversationState.messages.length === 0) {
    const systemPrompt = `You are an expert web application developer creating fully functional, multi-page web applications based on user requests. 
    
    ONLY USE HTML, CSS AND JAVASCRIPT. If you want to use ICON make sure to import the library first. Try to create the best UI possible by using only HTML, CSS and JAVASCRIPT. Use as much as you can TailwindCSS for the CSS, if you can't do something with TailwindCSS, then use custom CSS (make sure to import <script src="https://cdn.tailwindcss.com"></script> in the head). Also, try to ellaborate as much as you can, to create something unique. ALWAYS GIVE THE RESPONSE INTO A SINGLE HTML FILE, You must provide a complete application with all necessary files and functionality.

    IMPORTANT: ALWAYS implement COMPLETE code with NO placeholder comments. Do NOT leave any implementation details for the user to complete. All features mentioned in the requirements MUST be fully implemented with actual, functional code. Never write comments like "// TODO" or "// Implement this function" or leave any skeleton/stub code for the user to fill in. Implement everything fully and completely.
    
    IMPORTANT: When writing JavaScript, always implement full, working functionality. Do not omit code or use placeholder functions. Any function you declare must have a complete implementation.
    
    User's request for the application:
    
    <user_request>
    {{USER_REQUEST}}
    </user_request>
    
    Carefully follow these guidelines:
    
    1. Design a complete multi-page application with all necessary functionality
    2. Create a primary index.html file that serves as the application entry point
    3. Use TailwindCSS for styling with responsive design for all screen sizes
    4. Implement all requested features, including form handling, data storage, routing, etc.
    5. Use modern JavaScript/ES6+ for robust functionality
    6. Create a professional, attractive UI matching the user's requirements
    7. All code must be production-ready and fully functional
    
    Structure your response with clearly separated files:
    
    1. First, outline your complete application architecture in <app_planning> tags:
       - List all pages/components
       - Describe data structures and state management
       - Outline user flows and navigation
       - Note technical challenges and implementation details
    
    2. Then provide ALL the necessary files for the complete application:
    
    <file path="index.html">
    [FULL HTML CODE]
    </file>
    
    <file path="js/app.js">
    [FULL JS CODE]
    </file>
    
    <file path="css/custom.css"> 
    [CSS IF NEEDED BEYOND TAILWIND]
    </file>
    
    [INCLUDE ANY OTHER NEEDED FILES]
    
    Ensure your application is complete, working, and doesn't have any missing features. Do not omit any code or files necessary for full functionality.`;

    conversationState.messages = [
      { role: "system", content: systemPrompt }
    ];
    
    if (previousPrompt) {
      conversationState.messages.push({ 
        role: "user", 
        content: previousPrompt 
      });
    }
    
    if (html) {
      conversationState.messages.push({ 
        role: "assistant", 
        content: `The current code is: ${html}.` 
      });
    }
    
    conversationState.messages.push({ 
      role: "user", 
      content: prompt 
    });
  }

  try {
    // Replace Hugging Face client with OpenAI client for DeepSeek
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
      defaultQuery: {
        context_length: 8192
      }
    });

    // Stream the response from DeepSeek
    const stream = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: conversationState.messages,
      stream: true,
      max_tokens: 8192
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        conversationState.completeResponse += content;
        res.write(content);
        
        if (conversationState.completeResponse.includes("</html>")) {
          conversationState.isComplete = true;
          break;
        }
      }
    }

    // Store conversation state
    activeConversations.set(conversationId, conversationState);

    // Handle continuation or completion
    if (conversationState.isComplete) {
      activeConversations.delete(conversationId);
      res.end();
    } else {
      res.write('\n__CONTINUE__\n');
      res.end();
    }

  } catch (error) {
    console.error("API Error:", error);
    if (!res.headersSent) {
      res.status(500).send({
        ok: false,
        message: error.message || "An error occurred while processing your request.",
      });
    } else {
      res.end();
    }
  }
});

// Add continuation endpoint
app.post("/api/continue-response", async (req, res) => {
  const conversationId = req.headers['x-conversation-id'];
  const conversationState = activeConversations.get(conversationId);

  if (!conversationState) {
    return res.status(404).send({
      ok: false,
      message: "Conversation not found"
    });
  }

  try {
    // Get the original system prompt
    const systemPrompt = conversationState.messages.find(m => m.role === "system")?.content || "";
    
    // Get the original user prompt (the last user message)
    const userPrompt = conversationState.messages.find(m => m.role === "user")?.content || "";
    
    // Extract the last portion of the generated content (last ~1000 tokens)
    const responseLength = conversationState.completeResponse.length;
    const lastPortion = conversationState.completeResponse.substring(
      Math.max(0, responseLength - 6000),  // Take approximately last 1000-1500 tokens
      responseLength
    );
    
    // Create a new, more compact conversation context
    const continuationMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
      { role: "assistant", content: `I was in the middle of generating the following content: ${lastPortion}` },
      { role: "user", content: "Continue exactly where you left off, maintaining the same format, style and structure. Do not repeat anything." }
    ];

    // Replace Hugging Face client with OpenAI client for DeepSeek
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
      defaultQuery: {
        context_length: 8192
      }
    });

    // Continue the stream with the more efficient context
    const stream = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: continuationMessages,
      stream: true,
      max_tokens: 8192
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        conversationState.completeResponse += content;
        res.write(content);
        
        if (content.includes("</html>")) {
          conversationState.isComplete = true;
          break;
        }
      }
    }

    if (conversationState.isComplete) {
      activeConversations.delete(conversationId);
      res.end();
    } else {
      res.write('\n__CONTINUE__\n');
      res.end();
    }

  } catch (error) {
    console.error("API Error:", error);
    if (!res.headersSent) {
      res.status(500).send({
        ok: false,
        message: error.message || "An error occurred while processing your request.",
      });
    } else {
      res.end();
    }
  }
});

// Comment out remix endpoint as it's HF-specific
/*
app.get("/api/remix/:username/:repo", async (req, res) => {
  const { username, repo } = req.params;
  const { hf_token } = req.cookies;

  const token = hf_token || process.env.DEFAULT_HF_TOKEN;

  const repoId = `${username}/${repo}`;
  const space = await spaceInfo({
    name: repoId,
  });

  if (!space || space.sdk !== "static" || space.private) {
    return res.status(404).send({
      ok: false,
      message: "Space not found",
    });
  }

  const url = `https://huggingface.co/spaces/${repoId}/raw/main/index.html`;
  const response = await fetch(url);
  if (!response.ok) {
    return res.status(404).send({
      ok: false,
      message: "Space not found",
    });
  }
  let html = await response.text();
  // remove the last p tag including this url https://enzostvs-deepsite.hf.space
  html = html.replace(getPTag(repoId), "");

  res.status(200).send({
    ok: true,
    html,
  });
});
*/

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});














