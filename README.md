# NexusAI — Multi-Agent AI Platform

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.x-1C3C3C)](https://langchain-ai.github.io/langgraph/)
[![MongoDB](https://img.shields.io/badge/MongoDB-9.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-DD2C00?logo=firebase&logoColor=white)](https://firebase.google.com)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white)](https://stripe.com)
[![AWS](https://img.shields.io/badge/AWS-ECS%20Fargate-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com/ecs/)
[![Docker](https://img.shields.io/badge/Docker-Container-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

**NexusAI** is a full-stack, multi-agent AI chat platform deployed on **AWS ECS Fargate** with **CloudFront + ALB**. It combines a **microservices backend** built on Node.js, Express, and LangGraph with a modern **React + Vite** frontend. Users authenticate with Google, maintain persistent conversation history in MongoDB, chat with a family of specialized AI agents, and purchase credit plans via Stripe.

---

## Live Deployment

| Component | URL |
| --------- | --- |
| **Frontend** | `https://d30q6oug5r2j6s.cloudfront.net` |
| **API Gateway** | `https://do81mr20djocq.cloudfront.net` |
| **Backend Services** | ECS Fargate (Service Connect, namespace `sahil`) |
| **Database** | MongoDB Atlas (`cluster0.dyw4d6f.mongodb.net`) |
| **Cache / Sessions** | ElastiCache Redis (`nexusai.gu9ays.ng.0001.eun1.cache.amazonaws.com`) |

---

## Key Features

- **Multi-Agent Orchestration** — A LangGraph `StateGraph` router dispatches each request to the appropriate agent (`chat`, `search`, `coding`, `pdf`, `ppt`, `vision`), or you can force a specific agent from the UI.
- **Code Generation with Live Preview** — The Coding agent produces multi-file projects as JSON artifacts. The **Artifact panel** renders them in a Monaco editor with a one-click live browser preview (HTML/CSS/JS).
- **Real-Time Web Search** — Tavily-powered search agent fetches current information and images, which the Chat agent uses as grounded context.
- **PDF & PPT Generation** — Generate downloadable PDF documents and PowerPoint presentations on demand.
- **AI Image Generation** — Vision agent generates images via Pollinations AI with prompt optimization through Gemini.
- **Conversational Memory** — Per-conversation history is cached in Redis (last 20 messages) and combined with MongoDB-persisted messages for context-aware replies.
- **Google Authentication** — Firebase Admin verifies Google ID tokens; sessions are stored in Redis and issued as HTTP-only cookies.
- **Persistent Conversations** — Conversations and messages (including images & artifacts) are persisted in MongoDB and fully restored on reload.
- **Stripe Payments** — Users can purchase credit plans via Stripe Checkout with webhook-based payment verification.
- **Modern Dark UI** — Tailwind CSS v4 design with collapsible sidebar, Markdown rendering, syntax-highlighted code blocks, image lightbox, and smooth animations.
- **CI/CD Pipeline** — GitHub Actions workflow builds and deploys backend services to ECS ECR and frontend to S3/CloudFront on every push.

---

## Architecture Overview

```
                    ┌──────────────────────────────────────────────────┐
                    │            FRONTEND (React + Vite)               │
                    │   S3 + CloudFront · Redux Toolkit · Tailwind     │
                    └─────────────────────┬────────────────────────────┘
                                          │ HTTPS (axios, withCredentials)
                                          ▼
                    ┌──────────────────────────────────────────────────┐
                    │            CloudFront → ALB (port 80)            │
                    │   SSL termination · Path-based routing           │
                    └─────────────────────┬────────────────────────────┘
                                          │
                    ┌──────────────────────────────────────────────────┐
                    │              API GATEWAY  (port 8000)            │
                    │   CORS · cookie-parser · reverse proxy           │
                    └───┬──────────┬──────────┬──────────┬─────────────┘
                        │          │          │          │
              ┌─────────▼──┐ ┌─────▼────┐ ┌──▼───────┐ ┌▼────────────┐
              │  AUTH SVC  │ │ CHAT SVC │ │AGENT SVC │ │ BILLING SVC │
              │ port 8001  │ │ port 8002│ │port 8003 │ │ port 8004   │
              │ Firebase   │ │Mongoose  │ │LangGraph │ │ Stripe      │
              │ Admin SDK  │ │ Convos & │ │Router →  │ │ Checkout +  │
              │ Session    │ │ Messages │ │ Agents   │ │ Webhooks    │
              └─────┬──────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘
                    │             │             │              │
                    ▼             ▼             ▼              ▼
             ┌────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐
             │   REDIS    │ │ MONGODB  │ │LLM PROVIDERS │ │  STRIPE  │
             │ Sessions + │ │ Atlas    │ │ Groq·Gemini  │ │ Checkout │
             │ Msg Cache  │ │          │ │ OpenRouter   │ │ Webhooks │
             └────────────┘ └──────────┘ └──────────────┘ └──────────┘
```

### How a request flows

1. The user signs in with Google; Firebase returns an ID token.
2. The frontend sends the token to `POST /api/auth/login`. The **Auth service** verifies it, upserts the user in MongoDB, and creates a Redis-backed session returned as an HTTP-only cookie.
3. Every subsequent request carries the session cookie. The **Gateway's** `protect` middleware validates it against Redis and forwards the user context via `x-user-id` header.
4. When the user sends a message, the frontend calls `POST /api/agent/chat`. The **Agent service**:
   - saves the user message to the Chat service,
   - invokes a LangGraph workflow: a **router node** selects the agent (or honors an explicit choice),
   - executes the selected agent,
   - updates Redis memory and persists the assistant reply back to the Chat service,
   - returns the answer, images, and any generated artifacts.
5. The frontend renders the Markdown response, images, and — for coding requests — an interactive artifact with a live preview.

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, Redux Toolkit, Firebase SDK |
| **Editor / Preview** | Monaco Editor, react-markdown, react-syntax-highlighter |
| **Backend** | Node.js, Express 5, `express-http-proxy` |
| **Agent Orchestration** | LangChain LangGraph, LangChain Core |
| **LLM Providers** | Groq (`gpt-oss-120b`), Google Gemini (`gemini-2.5-flash`), OpenRouter (DeepSeek) |
| **Web Search** | Tavily |
| **Image Generation** | Pollinations AI |
| **Database** | MongoDB (Mongoose 9) |
| **Cache / Sessions** | Redis (ioredis) |
| **Authentication** | Firebase Admin SDK (Google OAuth) |
| **Payments** | Stripe Checkout + Webhooks |
| **Infrastructure** | AWS ECS Fargate, CloudFront, ALB, ECR, ElastiCache |
| **CI/CD** | GitHub Actions (Docker build → ECR → ECS deploy) |

---

## Project Structure

```
nexus-ai-multi-agent-platform/
├── .github/
│   └── workflows/
│       └── deploy.yml                     # CI/CD: build → ECR → ECS + S3 → CloudFront
├── backend/
│   ├── docker-compose.yml                 # Local Redis container
│   ├── package.json                       # root backend workspace deps (ioredis)
│   ├── shared/
│   │   └── redis/
│   │       └── redis.js                   # shared ioredis client
│   ├── gateway/                           # API Gateway (port 8000)
│   │   ├── index.js                       # Express app + reverse proxies
│   │   ├── middleware/
│   │   │   └── auth.middleware.js         # Redis session protect guard
│   │   ├── controllers/
│   │   │   └── user.controllers.js        # GET /api/me
│   │   └── utils/
│   │       └── proxyWithHeader.js         # proxy + inject x-user-id
│   └── services/
│       ├── auth/                          # Auth Service (port 8001)
│       │   ├── Dockerfile
│       │   ├── index.js
│       │   ├── config/                    # db.js, firebase.js (env-based)
│       │   ├── controllers/               # login, logout
│       │   ├── models/                    # User model
│       │   └── routes/                    # /login, /logout
│       ├── chat/                          # Chat Service (port 8002)
│       │   ├── Dockerfile
│       │   ├── index.js
│       │   ├── config/                    # db.js
│       │   ├── controllers/               # conversations & messages CRUD
│       │   ├── models/                    # Conversation, Message
│       │   └── routes/                    # /create-conversation, etc.
│       ├── agent/                         # Agent Service (port 8003)
│       │   ├── Dockerfile
│       │   ├── index.js
│       │   ├── agents/                    # chat, search, coding, pdf, ppt, vision
│       │   ├── config/                    # llmmodels, memory, tavily, db, agentLimit
│       │   ├── controllers/               # /chat endpoint
│       │   ├── graph/                     # state.js, router.js, graph.js
│       │   ├── routes/                    # /chat route
│       │   └── utils/                     # getMessages, uploadToS3, getFromS3, deductCredits
│       └── billing/                       # Billing Service (port 8004)
│           ├── Dockerfile
│           ├── index.js
│           ├── config/                    # stripe.js, Plans.js, db.js
│           ├── controllers/               # createOrder, verifyPayment, stripeWebhook
│           ├── models/                    # Payment model
│           └── route/                     # /create-order, /verify-payment, /webhook
└── frontend/                              # React + Vite SPA (S3 + CloudFront)
    ├── vite.config.js
    ├── .env                               # VITE_SERVER_URL, VITE_FIREBASE_API_KEY
    ├── utils/                             # axios instance, firebase init
    └── src/
        ├── App.jsx, main.jsx
        ├── pages/Home.jsx                 # login modal + layout
        ├── components/                    # Sidebar, Nav, ChatArea, ChatInput,
        │                                  # MessageList, MessageBubble, Artifact
        ├── features/                      # API feature helpers
        └── redux/                         # user, conversation, message slices
```

---

## Getting Started (Local Development)

### Prerequisites

- **Node.js** 20+ and **npm**
- **Docker** (for Redis) or a locally running Redis instance
- **MongoDB** — local or Atlas connection string
- **Firebase project** — web app config + Admin SDK credentials
- API keys for the agent providers: **Groq**, **Google Gemini**, **OpenRouter**, and **Tavily**
- **Stripe** account with test API keys (for billing)

### 1. Clone & install dependencies

```bash
git clone <your-repo-url>
cd nexus-ai-multi-agent-platform

# Backend services
cd backend/gateway && npm install
cd ../services/auth && npm install
cd ../services/chat && npm install
cd ../services/agent && npm install
cd ../services/billing && npm install

# Frontend
cd ../../../frontend && npm install
```

### 2. Start Redis

```bash
cd backend
docker compose up -d
```

This exposes Redis on `localhost:6379` (default).

### 3. Configure environment variables

Create a `.env` file in each service directory and in `frontend/`. See the [Environment Variables](#environment-variables) section for the full reference.

For the **Auth service**, Firebase credentials can be provided via environment variables (recommended for production) or a `serviceAccountKey.json` file at:

```
backend/services/auth/serviceAccountKey.json
```

> **Note:** `serviceAccountKey.json` is gitignored. Use env vars in production.

### 4. Run the backend services

```bash
# Gateway (default port 8000)
cd backend/gateway && npm run dev

# Auth service (default port 8001)
cd backend/services/auth && npm run dev

# Chat service (default port 8002)
cd backend/services/chat && npm run dev

# Agent service (default port 8003)
cd backend/services/agent && npm run dev

# Billing service (default port 8004)
cd backend/services/billing && npm run dev
```

### 5. Run the frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`, sign in with Google, and start chatting.

---

## Environment Variables

### Gateway (`backend/gateway/.env`)

| Variable | Description | Example |
| -------- | ----------- | ------- |
| `PORT` | Gateway port | `8000` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` |
| `AUTH_SERVICE` | Auth service URL | `http://localhost:8001` |
| `CHAT_SERVICE` | Chat service URL | `http://localhost:8002` |
| `AGENT_SERVICE` | Agent service URL | `http://localhost:8003` |
| `BILLING_SERVICE` | Billing service URL | `http://localhost:8004` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |

### Auth Service (`backend/services/auth/.env`)

| Variable | Description | Example |
| -------- | ----------- | ------- |
| `PORT` | Auth service port | `8001` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/nexusai` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `nexus-ai-xxxxx` |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | `firebase-adminsdk-...@...iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | `-----BEGIN PRIVATE KEY-----\n...` |

### Chat Service (`backend/services/chat/.env`)

| Variable | Description | Example |
| -------- | ----------- | ------- |
| `PORT` | Chat service port | `8002` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/nexusai` |

### Agent Service (`backend/services/agent/.env`)

| Variable | Description | Example |
| -------- | ----------- | ------- |
| `PORT` | Agent service port | `8003` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/nexusai` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `CHAT_SERVICE` | Chat service URL | `http://localhost:8002` |
| `AUTH_SERVICE` | Auth service URL | `http://localhost:8001` |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 | `AKIA...` |
| `AWS_SECRET_KEY` | AWS secret key | `...` |
| `AWS_REGION` | AWS region | `eu-north-1` |
| `AWS_BUCKET_NAME` | S3 bucket for artifacts/images | `nexus-ai-agent-...` |
| `GROQ_API_KEY` | Groq API key (chat & search agents) | `gsk_...` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |
| `OPENROUTER_API_KEY` | OpenRouter API key (optional fallback) | `sk-or-...` |
| `TAVILY_API_KEY` | Tavily API key (search agent) | `tvly-...` |
| `GOOGLE_API_KEY` | Google API key (vision prompt generation) | `AQ.Ab...` |
| `QDRANT_API_KEY` | Qdrant vector DB API key | `eyJhbG...` |
| `QDRANT_ENGPOINT` | Qdrant endpoint URL | `https://...qdrant.io` |

### Billing Service (`backend/services/billing/.env`)

| Variable | Description | Example |
| -------- | ----------- | ------- |
| `PORT` | Billing service port | `8004` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/nexusai` |
| `AUTH_SERVICE` | Auth service URL | `http://localhost:8001` |
| `CLIENT_URL` | Frontend URL for redirects | `http://localhost:5173` |
| `STRIPE_SECRET_KEY` | Stripe secret API key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
| -------- | ----------- | ------- |
| `VITE_SERVER_URL` | Gateway base URL | `http://localhost:8000` |
| `VITE_FIREBASE_API_KEY` | Firebase web API key | `AIza...` |

---

## API Reference

All routes are proxied through the **Gateway** (`http://localhost:8000`). Routes marked with **Session** require a valid Redis session cookie; the gateway forwards the user ID via the `x-user-id` header.

### Auth

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| `POST` | `/api/auth/login` | Verify Firebase ID token, upsert user, create Redis session, set cookie | Public |
| `GET` | `/api/auth/logout` | Delete Redis session and clear cookie | Cookie |

### User

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| `GET` | `/api/me` | Return the currently authenticated user | Session |

### Chat

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| `GET` | `/api/chat/create-conversation` | Create a new conversation for the current user | Session |
| `GET` | `/api/chat/get-conversations` | List the user's conversations (newest first) | Session |
| `POST` | `/api/chat/update-conversation` | Update a conversation title (`{ id, title }`) | Session |
| `POST` | `/api/chat/save-message` | Persist a message (`{ conversationId, role, content, images?, artifacts? }`) | Session |
| `GET` | `/api/chat/get-messages/:conversationId` | Fetch all messages for a conversation | Session |

### Agent

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| `POST` | `/api/agent/chat` | Send a prompt to the agent graph (`{ prompt, conversationId, agent }`) | Session |

**Response shape (`/api/agent/chat`):**

```json
{
  "answer": "markdown response...",
  "images": ["https://..."],
  "artifacts": [
    {
      "id": 1234567890,
      "type": "Project",
      "title": "Netflix clone",
      "files": [
        { "name": "index.html", "content": "..." },
        { "name": "style.css", "content": "..." },
        { "name": "script.js", "content": "..." }
      ]
    }
  ]
}
```

### Billing

| Method | Endpoint | Description | Auth |
| ------ | -------- | ----------- | ---- |
| `POST` | `/api/billing/create-order` | Create a Stripe Checkout session (`{ plan }`) | Session |
| `GET` | `/api/billing/verify-payment?session_id=...` | Verify payment status after redirect | Session |
| `POST` | `/api/billing/webhook` | Stripe webhook (receives payment events) | Public (Stripe signature) |

**Available Plans:**

| Plan | Credits | Amount |
| ---- | ------- | ------ |
| Basic | 50 | $4.99 |
| Standard | 150 | $9.99 |
| Premium | 500 | $19.99 |

---

## Agent System

The Agent service is a **LangGraph state machine** defined in `backend/services/agent/graph/`.

### State

Each graph invocation carries an `agentState` (see `state.js`) with:

- `prompt` — the user's message
- `agent` — the selected agent (or `auto`)
- `conversationId` — for memory & persistence
- `userId` — authenticated user ID
- `aiResponse` — the final answer
- `searchResults`, `images`, `artifacts` — optional agent outputs

### Router

The router node (`router.js`) either:

- honors an explicit `agent` value passed from the frontend (Auto/Chat/Search/Coding/PDF/PPT/Image), or
- uses an LLM to classify the user's query and return one of: `chat`, `search`, `coding`, `pdf`, `ppt`, `vision`.

### Agents

| Agent | Purpose | Backing Model / Tool | Status |
| ----- | ------- | -------------------- | ------ |
| **Chat** | General conversation, explanations, learning, Q&A | Groq `gpt-oss-120b` + conversation memory | Implemented |
| **Search** | Current events, news, internet lookups | Tavily search + Groq for synthesis | Implemented |
| **Coding** | Code generation, debugging, review, full-stack projects | Groq `gpt-oss-120b` + artifact JSON output | Implemented |
| **PDF** | PDF document generation | Groq LLM + PDF generation | Implemented |
| **PPT** | PowerPoint presentation generation | Groq LLM + PPT generation | Implemented |
| **Vision** | AI image generation | Gemini (prompt) + Pollinations AI (image) | Implemented |
| **Image Analyzer** | Analyze uploaded images | Google Gemini Vision | Implemented |

The graph wires `search -> chat` so search results are synthesized into a grounded answer by the chat agent. Coding requests produce multi-file **artifacts** rendered in the frontend's Artifact panel.

### Memory

Conversation memory (`config/memory.js`) stores the last 20 messages per conversation in Redis under `messages-{conversationId}` (24h TTL). The Chat agent uses the last 6 messages as recent context.

---

## AWS Deployment

### Infrastructure

| Resource | Details |
| -------- | ------- |
| **ECS Cluster** | Fargate with Service Connect (namespace `sahil`) |
| **Task Definitions** | `gateway-task`, `auth-task`, `chat-task`, `agent-task`, `billing-task` |
| **ALB** | `nexusai-lb` — routes `/api/*` to gateway, idle timeout 300s |
| **CloudFront (Frontend)** | `d30q6oug5r2j6s.cloudfront.net` — S3 origin |
| **CloudFront (Backend)** | `do81mr20djocq.cloudfront.net` — ALB origin, 300s timeout |
| **ECR** | Docker images for each service |
| **ElastiCache Redis** | `nexusai.gu9ays.ng.0001.eun1.cache.amazonaws.com:6379` |
| **MongoDB Atlas** | `cluster0.dyw4d6f.mongodb.net` |

### CI/CD Pipeline

GitHub Actions (`.github/workflows/deploy.yml`) runs on every push to `main`:

**Backend:**
1. Builds Docker image for each service (gateway, auth, chat, agent, billing)
2. Pushes to ECR (`876225478203.dkr.ecr.eu-north-1.amazonaws.com`)
3. Updates ECS task definition and forces new deployment

**Frontend:**
1. Installs dependencies with `VITE_FIREBASE_API_KEY` and `VITE_SERVER_URL`
2. Runs `npm run build`
3. Syncs `dist/` to S3
4. Creates CloudFront invalidation

### Deploy a single service manually

```bash
# Build and push to ECR
aws ecr get-login-password --region eu-north-1 | docker login --username AWS --password-stdin 876225478203.dkr.ecr.eu-north-1.amazonaws.com
docker build -t agent-service ./backend/services/agent
docker tag agent-service:latest 876225478203.dkr.ecr.eu-north-1.amazonaws.com/agent-service:latest
docker push 876225478203.dkr.ecr.eu-north-1.amazonaws.com/agent-service:latest

# Force redeploy on ECS
aws ecs update-service --cluster nexus-cluster --service agent-service --force-new-deployment --region eu-north-1
```

---

## Roadmap

- [ ] Add streaming responses (SSE / WebSockets) for a typewriter chat experience.
- [ ] Multi-model fallback & provider switching.
- [ ] Conversation rename/delete controls.
- [ ] Docker Compose setup for full local development.
- [ ] End-to-end tests and integration tests.
- [ ] Rate limiting and abuse prevention.
- [ ] Admin dashboard for monitoring usage and credits.

---

## Contributing

Contributions are welcome! If you'd like to improve NexusAI:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-idea`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-idea`).
5. Open a Pull Request.

---

## License

This project is for **educational and demonstration purposes**. If you plan to use it commercially, replace the LLM API keys, Firebase configuration, Stripe keys, and branding with your own, and review the terms of service for each provider (Groq, Google, OpenRouter, Tavily, Stripe) used by the platform.
