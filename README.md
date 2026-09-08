# SplitBill AI

AI-powered restaurant bill splitting from a photograph.

## Features
- 📸 Upload a photo of your restaurant bill (single or multi-page)
- 🤖 AI-powered OCR extracts line items, taxes, discounts, and totals
- 🔍 Per-field confidence indicators — review before any math runs
- ✏️ Full manual correction of every extracted field
- 👥 Multi-person item assignment (one person, shared, or everyone)
- 📊 Proportional tax, service charge, and discount allocation
- ✅ Exact-reconciliation rounding — split always adds up to the penny
- ⚠️ Automatic detection of incorrect printed totals
- 🎮 Demo mode works without any API key

## Architecture

```
Image → Vision AI → Pydantic (integer paise) → Human Review → Assignment → Calculator → Final Split
```

The LLM is never asked "how much should Rahul pay?" — only "what does this photo say?"
All financial calculations are deterministic Python code with integer arithmetic, fully unit-tested.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic |
| AI/OCR | Vision-capable LLM (OpenAI GPT-4o / Anthropic Claude) |
| Storage | None — fully stateless |

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- A vision-capable LLM API key (for photo extraction; demo mode works without one)

### Setup

1. Clone the repository:
```bash
git clone <repo-url>
cd splitbill-ai
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API key
```

3. Install and run the backend:
```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

4. Install and run the frontend (in a new terminal):
```bash
cd frontend
npm install
npm run dev
```

5. Open http://localhost:5173

### Run Tests
```bash
python -m pytest backend/tests/ -v
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VISION_PROVIDER` | LLM provider (`openai` or `anthropic`) | `openai` |
| `VISION_API_KEY` | API key for the vision provider | — |
| `VISION_MODEL` | Model to use for vision extraction | `gpt-4o` |

⚠️ API keys are never committed to version control.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bills/extract` | Upload bill image(s), get structured extraction |
| POST | `/api/bills/validate` | Validate bill arithmetic |
| POST | `/api/bills/calculate` | Calculate per-person split |
| POST | `/api/bills/demo` | Load demo bill data |
| GET | `/api/health` | Health check |

## How It Works

1. **Upload**: Take a photo of your restaurant bill and upload it
2. **Extract**: AI reads the bill and extracts structured data (items, prices, taxes)
3. **Review**: Every field is shown with confidence indicators — correct any errors
4. **Assign**: Add people and assign each item to whoever shared it
5. **Split**: Get an exact per-person breakdown with proportional tax/discount allocation

### Key Design Decisions
- **Money as integers**: All amounts are stored as integer paise (₹1.00 = 100 paise) to avoid floating-point errors
- **Proportional allocation**: Tax, service charge, and discounts are allocated proportionally to each person's pre-discount item subtotal — never split equally by headcount
- **Exact rounding**: The "last person gets remainder" algorithm guarantees the split always sums exactly to the total
- **No server state**: Every endpoint is stateless — the frontend sends the complete bill on each request

## Demo Mode

Click "Try Demo Bill" on the upload page to see the full flow without an API key. The demo loads a pre-built bill with sample members and assignments.

## License

MIT
