/**
 * Trade Capability - Hyperliquid Leverage Trading
 * Places leverage buy/sell orders on Hyperliquid perpetual futures
 */

import { z } from 'zod'
import * as hl from '@nktkas/hyperliquid'
import type { CapabilityConfig, CapabilityContext } from '../types/capability.js'

export function createTradeCapability(context: CapabilityContext): CapabilityConfig {
  const { env } = context

  return {
    name: 'trade',
    description: 'Place a leverage trade on Hyperliquid perpetuals (e.g., BTC, ETH)',
    
    schema: z.object({
      coin: z.string().describe('Coin symbol (e.g., "BTC", "ETH", "SOL")'),
      side: z.enum(['buy', 'sell']).describe('Trade side: buy (long) or sell (short)'),
      size: z.string().describe('Position size in coin units (e.g., "0.1" for 0.1 BTC)'),
      leverage: z.string().optional().describe('Leverage multiplier (e.g., "5" for 5x, default: account leverage)'),
      reduceOnly: z.boolean().optional().describe('Whether this is a reduce-only order (close position, default: false)'),
      pk_name: z.string().describe('Secret name containing the private key (e.g., "hl_key1", "HYPERLIQUID_PRIVATE_KEY")'),
      vault_name: z.string().optional().describe('Secret name containing the vault address (e.g., "hl_vault1", optional)'),
    }),
    
    async run({ args, action }) {
      try {
        console.log('\n========================================')
        console.log('⚡ HYPERLIQUID LEVERAGE TRADE')
        console.log('========================================')
        console.log(`📊 Trade Details:`)
        console.log(`   Coin: ${args.coin}`)
        console.log(`   Side: ${args.side.toUpperCase()}`)
        console.log(`   Size: ${args.size}`)
        console.log(`   Leverage: ${args.leverage || 'Default'}`)
        console.log(`   Reduce Only: ${args.reduceOnly || false}`)
        console.log(`   Private Key Secret: ${args.pk_name}`)
        if (args.vault_name) {
          console.log(`   Vault Secret: ${args.vault_name}`)
        }
        
        // Step 1: Fetch credentials from OpenServ secrets
        const workspaceId = action?.workspace?.id
        if (!workspaceId) {
          console.error('\n❌ Workspace ID not found in action context')
          return JSON.stringify({
            error: 'Workspace ID is required to fetch secrets',
            success: false
          })
        }
        
        const OPENSERV_API_KEY = env.OPENSERV_API_KEY
        const OPENSERV_API_URL = env.OPENSERV_API_URL || 'https://api.openserv.ai'
        
        if (!OPENSERV_API_KEY) {
          console.error('\n❌ OPENSERV_API_KEY not found in environment')
          return JSON.stringify({
            error: 'OPENSERV_API_KEY not configured',
            success: false
          })
        }
        
        console.log(`\n🔐 Fetching credentials from OpenServ secrets...`)
        console.log(`   Workspace ID: ${workspaceId}`)
        
        // List all secrets
        const secretsListResponse = await fetch(
          `${OPENSERV_API_URL}/workspaces/${workspaceId}/agent-secrets`,
          {
            headers: {
              'accept': 'application/json',
              'x-openserv-key': OPENSERV_API_KEY
            }
          }
        )
        
        if (!secretsListResponse.ok) {
          console.error(`❌ Failed to list secrets: ${secretsListResponse.status}`)
          return JSON.stringify({
            error: `Failed to list secrets: ${secretsListResponse.status}`,
            success: false
          })
        }
        
        const secrets = await secretsListResponse.json()
        console.log(`   Found ${secrets.length} secrets in workspace`)
        
        // Find required secrets using dynamic names
        const privateKeySecret = secrets.find((s: any) => s.name === args.pk_name)
        const vaultAddressSecret = args.vault_name 
          ? secrets.find((s: any) => s.name === args.vault_name)
          : undefined
        
        if (!privateKeySecret) {
          const availableSecrets = secrets.map((s: any) => s.name).join(', ')
          console.error(`❌ Secret "${args.pk_name}" not found`)
          console.log(`   Available secrets: ${availableSecrets}`)
          return JSON.stringify({
            error: `Secret "${args.pk_name}" not found in OpenServ workspace`,
            availableSecrets: secrets.map((s: any) => s.name),
            success: false
          })
        }
        
        console.log(`   ✅ Found "${args.pk_name}" (ID: ${privateKeySecret.id})`)
        if (args.vault_name) {
          if (vaultAddressSecret) {
            console.log(`   ✅ Found "${args.vault_name}" (ID: ${vaultAddressSecret.id})`)
          } else {
            console.log(`   ⚠️  Vault secret "${args.vault_name}" not found, continuing without vault`)
          }
        }
        
        // Fetch secret values
        console.log(`\n🔑 Fetching secret values...`)
        
        const privateKeyResponse = await fetch(
          `${OPENSERV_API_URL}/workspaces/${workspaceId}/agent-secrets/${privateKeySecret.id}/value`,
          {
            headers: { 'accept': 'application/json', 'x-openserv-key': OPENSERV_API_KEY }
          }
        )
        
        if (!privateKeyResponse.ok) {
          console.error(`❌ Failed to get "${args.pk_name}" value: ${privateKeyResponse.status}`)
          return JSON.stringify({
            error: `Failed to get "${args.pk_name}" value: ${privateKeyResponse.status}`,
            success: false
          })
        }
        
        // Parse secret values (API returns plain text strings)
        const PRIVATE_KEY = (await privateKeyResponse.text()).replace(/^"|"$/g, '')
        
        let VAULT_ADDRESS: string | undefined
        if (vaultAddressSecret) {
          const vaultResponse = await fetch(
            `${OPENSERV_API_URL}/workspaces/${workspaceId}/agent-secrets/${vaultAddressSecret.id}/value`,
            {
              headers: { 'accept': 'application/json', 'x-openserv-key': OPENSERV_API_KEY }
            }
          )
          if (vaultResponse.ok) {
            VAULT_ADDRESS = (await vaultResponse.text()).replace(/^"|"$/g, '')
          }
        }
        
        const IS_TESTNET = env.HYPERLIQUID_TESTNET === 'true'
        
        console.log(`   ✅ Successfully retrieved credentials`)
        console.log(`   Private Key: ${PRIVATE_KEY.substring(0, 10)}...${PRIVATE_KEY.substring(PRIVATE_KEY.length - 4)}`)
        if (VAULT_ADDRESS) {
          console.log(`   Vault Address: ${VAULT_ADDRESS}`)
        }
        console.log(`   Network: ${IS_TESTNET ? 'Testnet' : 'Mainnet'}`)
        
        // Step 2: Initialize Hyperliquid client
        console.log(`\n🔗 Initializing Hyperliquid Client...`)
        
        const transport = new hl.HttpTransport({
          isTestnet: IS_TESTNET,
          timeout: 30000,
        })
        
        const exchClient = new hl.ExchangeClient({
          transport,
          wallet: PRIVATE_KEY,
          defaultVaultAddress: VAULT_ADDRESS as `0x${string}` | undefined,
        })
        
        console.log(`   ✅ Client initialized`)
        
        // Step 3: Get current market price
        console.log(`\n💹 Fetching market data for ${args.coin}...`)
        
        const infoClient = new hl.InfoClient({ transport })
        const allMids = await infoClient.allMids()
        const coinPrice = allMids[args.coin]
        
        if (!coinPrice) {
          console.error(`❌ Coin "${args.coin}" not found or no price available`)
          return JSON.stringify({
            error: `Coin "${args.coin}" not found. Check symbol (e.g., "BTC", "ETH")`,
            success: false
          })
        }
        
        console.log(`   Current ${args.coin} price: $${coinPrice}`)
        
        // Step 4: Update leverage if specified
        if (args.leverage) {
          console.log(`\n⚙️  Setting leverage to ${args.leverage}x...`)
          try {
            const meta = await infoClient.meta()
            const assetIndex = meta.universe.findIndex(u => u.name === args.coin)
            
            if (assetIndex === -1) {
              console.error(`❌ Could not find asset index for ${args.coin}`)
              return JSON.stringify({
                error: `Asset ${args.coin} not found in universe`,
                success: false
              })
            }
            
            await exchClient.updateLeverage({
              asset: assetIndex,
              isCross: true,
              leverage: parseInt(args.leverage),
            })
            console.log(`   ✅ Leverage updated to ${args.leverage}x`)
          } catch (leverageError: any) {
            console.log(`   ⚠️  Leverage update failed: ${leverageError.message}`)
            console.log(`   Continuing with current account leverage...`)
          }
        }
        
        // Step 5: Get asset metadata and index
        const meta = await infoClient.meta()
        const assetIndex = meta.universe.findIndex(u => u.name === args.coin)
        
        if (assetIndex === -1) {
          console.error(`❌ Could not find asset index for ${args.coin}`)
          return JSON.stringify({
            error: `Asset ${args.coin} not found`,
            success: false
          })
        }
        
        const assetInfo = meta.universe[assetIndex]
        const szDecimals = assetInfo.szDecimals
        
        // Step 6: Calculate limit price respecting tick size
        // For buys: price slightly above current (ensures fill)
        // For sells: price slightly below current (ensures fill)
        const priceAdjustment = args.side === 'buy' ? 1.002 : 0.998 // 0.2% slippage
        const rawPrice = parseFloat(coinPrice) * priceAdjustment
        
        // Determine tick size based on szDecimals
        // For BTC (szDecimals=5), tick size is $1
        // For smaller assets, might be $0.1, $0.01, etc.
        const tickSize = szDecimals >= 5 ? 1 : szDecimals >= 4 ? 0.1 : szDecimals >= 3 ? 0.01 : 0.001
        const limitPrice = (Math.round(rawPrice / tickSize) * tickSize).toFixed(
          szDecimals >= 5 ? 0 : szDecimals >= 4 ? 1 : szDecimals >= 3 ? 2 : 3
        )
        
        console.log(`\n📝 Creating ${args.side.toUpperCase()} Order...`)
        console.log(`   Asset Decimals: ${szDecimals}`)
        console.log(`   Tick Size: $${tickSize}`)
        console.log(`   Limit Price: $${limitPrice} (rounded to valid tick)`)
        console.log(`   Size: ${args.size} ${args.coin}`)
        console.log(`   Order Type: IoC (Immediate-or-Cancel)`)
        
        // Step 7: Place order
        console.log(`\n🚀 Placing Order on Hyperliquid...`)
        
        const orderResult = await exchClient.order({
          orders: [{
            a: assetIndex,
            b: args.side === 'buy',
            p: limitPrice,
            s: args.size,
            r: args.reduceOnly || false,
            t: {
              limit: {
                tif: 'Ioc', // Immediate-or-Cancel for market-like execution
              },
            },
          }],
          grouping: 'na',
        })
        
        console.log(`\n📋 Order Result:`)
        console.log(JSON.stringify(orderResult, null, 2))
        
        if (orderResult.response.type === 'order' && orderResult.response.data?.statuses[0]) {
          const status = orderResult.response.data.statuses[0]
          
          if ('filled' in status) {
            console.log(`\n✅ SUCCESS! Trade Executed!`)
            console.log(`========================================`)
            console.log(`   Coin: ${args.coin}`)
            console.log(`   Side: ${args.side.toUpperCase()}`)
            console.log(`   Size: ${args.size}`)
            console.log(`   Avg Fill Price: $${status.filled.avgPx || limitPrice}`)
            console.log(`   Total Filled: ${status.filled.totalSz}`)
            console.log(`========================================\n`)
            
            return JSON.stringify({
              success: true,
              coin: args.coin,
              side: args.side,
              size: args.size,
              leverage: args.leverage,
              avgFillPrice: status.filled.avgPx,
              totalFilled: status.filled.totalSz,
              oid: status.filled.oid,
              message: `Successfully ${args.side === 'buy' ? 'longed' : 'shorted'} ${args.size} ${args.coin}`
            }, null, 2)
          } else if ('error' in status) {
            console.log(`\n❌ TRADE FAILED!`)
            console.log(`========================================`)
            console.log(`   Error: ${status.error}`)
            console.log(`========================================\n`)
            
            return JSON.stringify({
              success: false,
              error: status.error,
              coin: args.coin,
              side: args.side
            }, null, 2)
          } else if ('resting' in status) {
            console.log(`\n⏳ Order Resting on Book`)
            console.log(`========================================`)
            console.log(`   Order ID: ${status.resting.oid}`)
            console.log(`   This order is waiting to be filled`)
            console.log(`========================================\n`)
            
            return JSON.stringify({
              success: true,
              status: 'resting',
              oid: status.resting.oid,
              message: 'Order placed and waiting to be filled',
              coin: args.coin,
              side: args.side
            }, null, 2)
          }
        }
        
        console.log(`\n❌ Unexpected response format`)
        return JSON.stringify({
          success: false,
          error: 'Unexpected response from exchange',
          response: orderResult
        }, null, 2)
        
      } catch (err: any) {
        console.error(`\n❌ EXCEPTION CAUGHT!`)
        console.error(`========================================`)
        console.error(`   Error: ${err?.message || err}`)
        if (err?.stack) {
          console.error(`   Stack: ${err.stack.split('\n').slice(0, 3).join('\n   ')}`)
        }
        console.error(`========================================\n`)
        
        return JSON.stringify({
          error: err?.message || 'Unknown error',
          success: false
        }, null, 2)
      }
    }
  }
}

