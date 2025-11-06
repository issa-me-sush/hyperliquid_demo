# Hyperliquid Trading Agent

An OpenServ agent for executing leverage trades on Hyperliquid perpetual futures.

## Features

- 🔥 **Leverage Trading**: Long/short perpetual futures with leverage
- 🔐 **Secure Credentials**: Fetches private keys from OpenServ secrets
- ⚡ **Market Orders**: IoC orders for immediate execution
- 💰 **Vault Support**: Trade via Hyperliquid vaults
- 🧪 **Testnet Support**: Test strategies on testnet

## Setup

### 1. Install Dependencies

```bash
cd hyperliquid-agent
npm install
```

### 2. Configure Environment Variables

Create a `.env` file:

```bash
# Required
OPENSERV_API_KEY=your_openserv_api_key_here

# Optional
PORT=7380
HYPERLIQUID_TESTNET=false  # set to 'true' for testnet
```

### 3. Configure OpenServ Secrets

In your OpenServ workspace, add secrets with **any names you prefer**. You'll reference these names in the `pk_name` and `vault_name` parameters when trading.

#### Examples:
- **hl_key1**: Your primary wallet private key (e.g., `0xabc123...`)
- **hl_key2**: Your secondary wallet private key
- **hl_vault1**: Vault address if trading via vault (e.g., `0xdef456...`)
- **HYPERLIQUID_PRIVATE_KEY**: Alternative naming (any name works!)

The agent is **completely dynamic** - you can use any secret names you want!

## Running the Agent

```bash
npm start
```

The agent will start on port **7380** (or the port you specify in `.env`).

## Expose Locally with ngrok

If you want to receive webhooks or access your local agent from the internet, you can expose it securely using ngrok.

1. Install ngrok
   - macOS (Homebrew):

```bash
brew install ngrok/ngrok/ngrok
```

   - Or download from the ngrok website: [ngrok](https://ngrok.com/)

2. (Recommended) Authenticate with your ngrok authtoken so you get stable, higher‑limit tunnels:

```bash
ngrok config add-authtoken <your_ngrok_authtoken>
```

3. Start a tunnel to the agent's port:

```bash
# If you set a custom PORT in .env
ngrok http $PORT

# Otherwise (default 7380)
ngrok http 7380
```

4. Copy the public URL shown by ngrok (e.g., `https://<id>.ngrok-free.app`) and use it to call your endpoints:

```bash
# Test capability
curl -X POST https://<id>.ngrok-free.app/tools/test \
  -H 'Content-Type: application/json' \
  -d '{"args": {"message": "Hello Hyperliquid"}}'

# Trade capability (example)
curl -X POST https://<id>.ngrok-free.app/tools/trade \
  -H 'Content-Type: application/json' \
  -d '{
    "args": {
      "coin": "BTC",
      "side": "buy",
      "size": "0.01",
      "leverage": "5",
      "pk_name": "hl_key1"
    }
  }'
```

Keep the ngrok process running while you need the public URL. For production-grade exposure, add authentication in front of the agent or deploy behind a secure gateway.

## Capabilities

### `trade`

Places leverage buy/sell orders on Hyperliquid perpetuals.

**Parameters:**
- `coin` (string): Coin symbol (e.g., "BTC", "ETH", "SOL")
- `side` (enum): "buy" (long) or "sell" (short)
- `size` (string): Position size in coin units (e.g., "0.1")
- `leverage` (string, optional): Leverage multiplier (e.g., "5" for 5x)
- `reduceOnly` (boolean, optional): Whether to only reduce position (default: false)
- `pk_name` (string): **Secret name** containing the private key (e.g., "hl_key1", "HYPERLIQUID_PRIVATE_KEY")
- `vault_name` (string, optional): **Secret name** containing the vault address (e.g., "hl_vault1")

**Example - Direct POST:**
```bash
curl -X POST http://localhost:7380/tools/trade \
  -H 'Content-Type: application/json' \
  -d '{
    "args": {
      "coin": "BTC",
      "side": "buy",
      "size": "0.01",
      "leverage": "5",
      "pk_name": "hl_key1"
    }
  }'
```

**Example - OpenServ Trigger:**
```json
{
  "event": {
    "coin": "ETH",
    "side": "sell",
    "size": "0.1",
    "leverage": "3",
    "pk_name": "HYPERLIQUID_PRIVATE_KEY"
  },
  "summary": "Short 0.1 ETH with 3x leverage"
}
```

### `test`

Simple test capability to verify the agent is working.

```bash
curl -X POST http://localhost:7380/tools/test \
  -H 'Content-Type: application/json' \
  -d '{"args": {"message": "Hello Hyperliquid"}}'
```

## How It Works

1. **Fetches Credentials**: Securely retrieves private key from OpenServ secrets using `pk_name` parameter
2. **Initializes Client**: Creates Hyperliquid ExchangeClient with your wallet
3. **Gets Market Data**: Fetches current price for the specified coin
4. **Sets Leverage**: Updates account leverage if specified
5. **Gets Asset Metadata**: Retrieves tick size and decimals for the asset
6. **Calculates Price**: Rounds price to valid tick size for exchange acceptance
7. **Places Order**: Executes IoC (Immediate-or-Cancel) order for market-like execution
8. **Returns Result**: Detailed response with fill price, order ID, etc.

## Network Selection

### Mainnet (default)
Set in `.env`:
```
HYPERLIQUID_TESTNET=false
```

### Testnet
Set in `.env`:
```
HYPERLIQUID_TESTNET=true
```

Make sure your private key corresponds to a wallet on the correct network!

## Multiple Wallets / Accounts

The agent supports **dynamic wallet selection** via the `pk_name` parameter. This allows you to:

- **Trade with multiple wallets** from the same agent
- **Use custom secret names** (no hardcoded names!)
- **Easily switch between accounts** per trade

### Setup Multiple Wallets:

1. Go to your OpenServ workspace
2. Add secrets with descriptive names:
   - `hl_main_wallet` - Your primary trading wallet
   - `hl_test_wallet` - Your testnet wallet
   - `hl_bot_1`, `hl_bot_2` - Multiple bot wallets
   - Any names you prefer!
3. Pass the secret name in `pk_name` when trading

If you specify a secret name that doesn't exist, you'll get a helpful error listing all available secrets.

## Trading via Vault

To trade via a Hyperliquid vault:

1. Add a secret with your vault address (e.g., `hl_vault1`)
2. Set the value to your vault address (e.g., `0x...`)
3. Pass the secret name in `vault_name` when trading

## Example Trade Scenarios

### Long BTC with 10x Leverage
```json
{
  "coin": "BTC",
  "side": "buy",
  "size": "0.05",
  "leverage": "10",
  "pk_name": "hl_main_wallet"
}
```

### Short ETH with 5x Leverage (using different wallet)
```json
{
  "coin": "ETH",
  "side": "sell",
  "size": "0.2",
  "leverage": "5",
  "pk_name": "hl_bot_1"
}
```

### Close Position (Reduce Only)
```json
{
  "coin": "BTC",
  "side": "sell",
  "size": "0.05",
  "reduceOnly": true,
  "pk_name": "hl_main_wallet"
}
```

### Trade via Vault
```json
{
  "coin": "SOL",
  "side": "buy",
  "size": "1.0",
  "leverage": "3",
  "pk_name": "hl_vault_manager",
  "vault_name": "hl_vault1"
}
```

## Supported Coins

Hyperliquid supports many perpetual markets including:
- **Major**: BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX
- **Altcoins**: LINK, MATIC, UNI, ATOM, and many more
- Check [Hyperliquid](https://app.hyperliquid.xyz/) for the full list

## Security Notes

- **Never expose your private key** - always store it in OpenServ secrets
- Use **testnet first** to test strategies
- Start with **small sizes** and low leverage
- Always understand the **liquidation risk** with leverage trading

## Troubleshooting

### "Asset not found"
- Check coin symbol spelling (case-sensitive: "BTC" not "btc")
- Verify the coin is available on Hyperliquid

### "Insufficient balance"
- Add funds to your Hyperliquid wallet
- Bridge USDC to Arbitrum (Hyperliquid's L1)

### "Order failed"
- Check your account has sufficient margin
- Verify leverage settings aren't too high
- Ensure order size meets minimum requirements

## Learn More

- [Hyperliquid Docs](https://hyperliquid.gitbook.io/)
- [Hyperliquid SDK](https://github.com/nktkas/hyperliquid)
- [OpenServ Platform](https://openserv.ai/)

## License

ISC

