/**
 * Hyperliquid Leverage Trading Agent Server (default port 7380)
 * 
 * Purpose:
 * - Modular architecture with pluggable capabilities
 * - Auto-registers all capabilities from ./capabilities/
 * - Executes leverage trades on Hyperliquid perpetuals
 * - Runs as a standalone Node process
 *
 * Run locally:
 *   npm install
 *   OPENSERV_API_KEY=... npm start
 *
 * Env:
 *   OPENSERV_API_KEY          (required)
 *   PORT                      (optional, defaults to 7380)
 *   HYPERLIQUID_TESTNET       (optional, set to 'true' for testnet)
 *
 * Secrets (configured in OpenServ workspace):
 *   HYPERLIQUID_PRIVATE_KEY   (required) - Wallet private key
 *   HYPERLIQUID_VAULT_ADDRESS (optional) - Vault address for trading via vault
 *
 * Adding Capabilities:
 *   See ./capabilities/README.md for instructions
 */

import 'dotenv/config'
import { Agent } from '@openserv-labs/sdk'
import { getAllCapabilities } from './capabilities/index.js'

const OPENSERV_API_KEY = process.env.OPENSERV_API_KEY || ''

if (!OPENSERV_API_KEY) {
  console.error('❌ Please set OPENSERV_API_KEY in your environment')
  process.exit(1)
}

const agent = new Agent({
  systemPrompt: 'You are a Hyperliquid leverage trading agent that executes perpetual futures orders.',
  apiKey: OPENSERV_API_KEY,
})

// Register all capabilities modularly
const capabilities = getAllCapabilities({
  env: process.env
})

capabilities.forEach(capability => {
  agent.addCapability(capability)
  console.log(`✅ Registered capability: ${capability.name}`)
})

async function main() {
  console.log('\n========================================')
  console.log('⚡ HYPERLIQUID TRADING AGENT')
  console.log('========================================')
  console.log('📋 Configuration:')
  console.log(`   PORT: ${process.env.PORT || '7380 (default)'}`)
  console.log(`   OPENSERV_API_KEY: ${OPENSERV_API_KEY.substring(0, 8)}...`)
  console.log(`   HYPERLIQUID_TESTNET: ${process.env.HYPERLIQUID_TESTNET || 'false (mainnet)'}`)
  console.log('========================================\n')

  await agent.start()

  console.log('✅ Agent listening')
  console.log(`🔧 Capabilities:    ${capabilities.length} registered`)
  capabilities.forEach(cap => {
    console.log(`   - ${cap.name}`)
  })

  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...')
    try {
      await agent.stop()
      console.log('✅ Agent stopped')
    } catch (e) {
      console.error('❌ Error while stopping agent:', e)
    } finally {
      process.exit(0)
    }
  })
}

main().catch((e) => {
  console.error('❌ Failed to start agent:', e)
  process.exit(1)
})

