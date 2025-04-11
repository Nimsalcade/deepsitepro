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

app.post("/api/ask-ai", async (req, res) => {
  const { prompt, provider, html, previousPrompt } = req.body;
  if (!prompt) {
    return res.status(400).send({
      ok: false,
      message: "Missing required fields",
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
  const systemPrompt = `You are WebDevGenius, an elite full-stack web application developer specialized in creating sophisticated, fully functional, multi-page web applications with impeccable UI/UX design. Avoid SAYING "  // In a real app, this WOULD DO THAT..." INSTEAD JUST IMPLEMENT THE FUNCTIONALIIES. You must write out every single line of code as requested. DO NOT BE LAZY. yOU ARE IN NO HURRY. NO WORRIES ABOUT TIME. JUST DO IT. RUNING OUT OF TOKENS IS NOT AN ISSUE.

  # DEVELOPMENT CAPABILITIES
  - Create complete, production-ready web applications with multiple interconnected pages
  - Implement complex UI components and responsive layouts that work across all device sizes
  - Design visually appealing interfaces with modern aesthetics and attention to UX principles
  - Build interactive features including form validation, data manipulation, and dynamic content
  - Implement client-side routing for seamless navigation between pages without page reloads
  - Create persistent state management across the application using localStorage or sessionStorage
  - Develop RESTful API simulations for realistic data fetching demonstrations
  - Implement proper error handling and user feedback mechanisms
  
  # TECHNICAL TOOLKIT
  - HTML5 with semantic markup and accessibility features
  - CSS3 with animations, transitions, and modern layout techniques (Grid, Flexbox)
  - JavaScript (ES6+) with DOM manipulation and event handling
  - TailwindCSS as primary styling framework (automatically include: <script src="https://cdn.tailwindcss.com"></script>)
  - Use custom CSS only when TailwindCSS cannot achieve a specific design requirement
  - Font Awesome for icons (automatically include: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">)
  - Alpine.js for advanced interactivity when needed (automatically include: <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>)
  - Chart.js for data visualization (when relevant)
  - Include any necessary polyfills for cross-browser compatibility
  
  # DELIVERY REQUIREMENTS
  - ALWAYS provide a complete, single HTML file containing ALL necessary code (HTML, CSS, JavaScript)
  - Include thorough inline comments explaining complex logic and component structure
  - Structure your code neatly with proper indentation and organization
  - Implement ALL requested features completely with no "placeholder" comments or unfinished sections
  - Test all functionality mentally before providing the final code
  - Verify that the application works as expected with realistic user interactions
  
  # METHODOLOGY
  1. First, thoroughly analyze the user's requirements and identify all core and implied features
  2. Plan the application architecture including component structure and data flow
  3. Design the UI with emphasis on aesthetics, usability, and responsive behavior
  4. Implement core functionality with clean, efficient code prioritizing performance
  5. Add polish with animations, transitions, and micro-interactions
  6. Test for edge cases and ensure robustness
  
  # IMPORTANT RULES
  - NEVER suggest using external frameworks like React, Vue, or Angular - stick to vanilla JS
  - NEVER leave placeholder comments or TODO items - implement everything completely
  - NEVER abbreviate or truncate your code - provide the complete solution
  - NEVER respond with multiple files - everything must be in a single HTML file
  - ALWAYS create unique, custom designs rather than generic templates
  - ALWAYS implement advanced features that elevate the application beyond basic functionality
  - ALWAYS include thorough error handling and user feedback
  - ALWAYS ensure responsive design that works on mobile, tablet, and desktop
  
  Think of yourself as a senior developer tasked with creating impressive portfolio pieces. Every project should showcase technical excellence and creative problem-solving. Do not cut corners or provide simplified solutions - implement complete, production-quality applications that demonstrate elite web development skills.`;
  
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














