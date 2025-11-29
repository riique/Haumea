# Haumea

An open-source AI chat application built with Next.js and Firebase, featuring multiple AI models through OpenRouter.

## Features

- **Multi-Model Support**: Access various AI models through OpenRouter API
- **BYOK (Bring Your Own Key)**: Use your own API keys for direct provider access
- **Real-time Chat**: Smooth streaming responses with markdown rendering
- **Audio Support**: Voice recording and transcription capabilities
- **Debate Mode**: AI-powered debate discussions
- **Study Mode**: Guided learning experiences
- **Persona System**: Customizable AI personalities
- **Dark/Light Theme**: Full theme support
- **Firebase Integration**: Authentication, Firestore, and Cloud Functions

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS
- **Backend**: Firebase Cloud Functions
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **AI Provider**: OpenRouter API
- **Rendering**: Markdown, KaTeX (math), Mermaid (diagrams), Plotly (charts)

## Prerequisites

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project with Firestore, Authentication, and Functions enabled
- OpenRouter API key (or individual provider keys)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/haumea.git
cd haumea
```

### 2. Install dependencies

```bash
npm install
cd haumea-functions && npm install && cd ..
```

### 3. Configure Firebase

```bash
firebase login
firebase init
```

Select your Firebase project and enable:
- Firestore
- Functions
- Hosting
- Storage

### 4. Set up environment variables

Copy the example files and fill in your values:

```bash
cp .env.example .env.local
cp haumea-functions/.env.example haumea-functions/.env
```

#### Frontend (.env.local)

Get these values from your Firebase project settings:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Haumea
```

#### Backend (haumea-functions/.env)

Generate an encryption key for secure API key storage:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32
```

```env
ENCRYPTION_KEY=your_generated_64_char_hex_key
NODE_ENV=development
LOG_LEVEL=info
```

For production, use Firebase Secret Manager:

```bash
firebase functions:secrets:set ENCRYPTION_KEY
```

### 5. Deploy Firestore rules

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 7. Deploy to production

```bash
npm run deploy
```

Or deploy individually:

```bash
npm run deploy:hosting    # Frontend only
npm run deploy:functions  # Cloud Functions only
```

## Project Structure

```
haumea/
├── app/                    # Next.js app router pages
├── components/             # React components
│   ├── admin/             # Admin panel components
│   ├── common/            # Shared components
│   ├── dashboard/         # Main chat interface
│   └── modals/            # Modal dialogs
├── contexts/              # React contexts (Auth, Theme, Dashboard)
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and configurations
│   ├── config/           # App configuration
│   ├── constants/        # Constants and model definitions
│   ├── db/               # IndexedDB and caching
│   └── schemas/          # Validation schemas
├── haumea-functions/      # Firebase Cloud Functions
│   └── src/
│       ├── functions/    # Individual cloud functions
│       └── middleware/   # Function middleware
├── public/               # Static assets
├── types/                # TypeScript type definitions
└── System Prompts/       # AI system prompts
```

## Configuration

### Firestore Security Rules

The project includes pre-configured security rules in `firestore.rules`. Review and customize them for your needs.

### Storage Rules

Storage rules are in `storage.rules` for secure file uploads.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- Never commit `.env` files with real credentials
- Use Firebase Secret Manager for production secrets
- API keys are encrypted at rest using AES-256-GCM
- Review security rules before deploying

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [OpenRouter](https://openrouter.ai/) for AI model access
- [Firebase](https://firebase.google.com/) for backend services
- [Next.js](https://nextjs.org/) for the React framework
- [TailwindCSS](https://tailwindcss.com/) for styling
