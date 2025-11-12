import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { mnemonicToPrivateKey } from "@ton/crypto"
import { TonClient, WalletContractV5R1 } from "@ton/ton"

type WalletState = "active" | "uninitialized" | "frozen" | "unknown"

function formatTonAmount(nano?: bigint | null) {
  if (nano === undefined || nano === null) {
    return null
  }

  const ton = nano / BigInt(1_000_000_000)
  const fraction = nano % BigInt(1_000_000_000)
  const fractionStr = fraction.toString().padStart(9, "0").replace(/0+$/, "")

  return fractionStr.length > 0 ? `${ton.toString()}.${fractionStr}` : ton.toString()
}

function detectWalletState(state?: string | null): WalletState {
  switch (state) {
    case "active":
      return "active"
    case "uninit":
    case "uninitialized":
      return "uninitialized"
    case "frozen":
      return "frozen"
    default:
      return "unknown"
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  let mnemonic: string | undefined
  let endpointOverride: string | undefined
  let apiKeyOverride: string | undefined

  try {
    const payload = await request.json()
    mnemonic = typeof payload?.mnemonic === "string" ? payload.mnemonic.trim() : undefined
    endpointOverride = typeof payload?.endpoint === "string" ? payload.endpoint.trim() : undefined
    apiKeyOverride = typeof payload?.apiKey === "string" ? payload.apiKey.trim() : undefined
  } catch (error) {
    return NextResponse.json({ error: "请求数据格式错误" }, { status: 400 })
  }

  if (!mnemonic) {
    return NextResponse.json({ error: "助记词不能为空" }, { status: 400 })
  }

  const words = mnemonic.split(/\s+/).filter(Boolean)
  if (words.length < 12) {
    return NextResponse.json({ error: "助记词格式不正确，至少包含 12 个单词" }, { status: 400 })
  }

  try {
    const { getAllConfig } = await import("@/src/services/configService.js")
    const config = (await getAllConfig()) as Record<string, string | undefined>

    const endpoint =
      endpointOverride ||
      (config?.["ton_endpoint"] && config["ton_endpoint"]!.trim()
        ? config["ton_endpoint"]!.trim()
        : process.env.TON_ENDPOINT?.trim() || "https://toncenter.com/api/v2/jsonRPC")

    const apiKey =
      apiKeyOverride ||
      (config?.["ton_api_key"] && config["ton_api_key"]!.trim()
        ? config["ton_api_key"]!.trim()
        : process.env.TON_API_KEY?.trim() || undefined)

    const keyPair = await mnemonicToPrivateKey(words)
    const client = new TonClient({
      endpoint,
      apiKey,
    })

    const wallet = WalletContractV5R1.create({ publicKey: keyPair.publicKey })
    const address = wallet.address
    const addressBounceable = address.toString({ bounceable: true, urlSafe: true })
    const addressNonBounceable = address.toString({ bounceable: false, urlSafe: true })
    const addressRaw = address.toRawString()

    let balance: bigint | null = null
    let seqno: number | null = null
    let state: WalletState = "unknown"
    let lastTransactionLt: string | null = null
    let lastTransactionHash: string | null = null

    try {
      balance = await client.getBalance(address)
    } catch (error) {
      // ignore
    }

    try {
      const openedWallet = client.open(wallet)
      if ("getSeqno" in openedWallet && typeof openedWallet.getSeqno === "function") {
        seqno = await openedWallet.getSeqno()
        state = "active"
      } else if ("getSeqno" in wallet && typeof (wallet as any).getSeqno === "function") {
        seqno = await (wallet as any).getSeqno(client.provider(address))
        state = "active"
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (
        message.includes("account state is not initialized") ||
        message.includes("cannot run get-method on inactive account")
      ) {
        state = "uninitialized"
        seqno = null
      }
    }

    try {
      const contractState = await client.getContractState(address)
      state = detectWalletState(contractState?.state)
      if (contractState?.balance !== undefined) {
        balance = contractState.balance
      }
      if (contractState?.lastTransaction) {
        const lt = (contractState.lastTransaction as any).lt
        const hash = (contractState.lastTransaction as any).hash
        lastTransactionLt = typeof lt === "bigint" ? lt.toString() : String(lt ?? "")
        lastTransactionHash = typeof hash === "string" ? hash : String(hash ?? "")
      }
    } catch (error) {
      // ignore
    }

    const allWalletAddresses = [
      {
        walletType: "v5r1",
        addressRaw: String(addressRaw),
        addressBounceable: String(addressBounceable),
        addressNonBounceable: String(addressNonBounceable),
        address: String(address.toString()),
      },
    ]

    // 确保所有字段都是可序列化的基本类型
    const workchainValue = (wallet as any).workchain
    const walletIdValue = (wallet as any).walletId
    
    const walletInfo = {
      address: String(address.toString()),
      addressBounceable: String(addressBounceable),
      addressNonBounceable: String(addressNonBounceable),
      addressRaw: String(addressRaw),
      workchain: typeof workchainValue === 'number' ? workchainValue : 0,
      walletId: typeof walletIdValue === 'number' ? walletIdValue : 0,
      walletType: "v5r1",
      publicKeyHex: String(Buffer.from(keyPair.publicKey).toString("hex")),
      mnemonicWords: Number(words.length),
      seqno: seqno !== null ? Number(seqno) : null,
      balanceNano: balance ? String(balance.toString()) : null,
      balanceTon: balance ? String(formatTonAmount(balance) ?? "") : null,
      state: String(state),
      lastTransactionLt: lastTransactionLt ? String(lastTransactionLt) : null,
      lastTransactionHash: lastTransactionHash ? String(lastTransactionHash) : null,
      endpoint: String(endpoint),
      hasApiKey: Boolean(apiKey),
      allVersions: allWalletAddresses,
    }

    const warnings: string[] = []
    if (!balance || balance === BigInt(0)) {
      warnings.push("钱包余额为 0 TON，请确保钱包已充值以完成自动支付。")
    }
    if (state !== "active") {
      warnings.push("钱包合约尚未激活（可能尚未部署或余额不足）。首次交易需要先往该地址转入少量 TON。")
    }

    // 确保响应中的所有数据都是可序列化的基本类型
    const response = {
      ok: true,
      wallet: walletInfo,
      warnings: warnings.map(w => String(w)),
    }
    
    // 验证响应数据不包含不可序列化的对象
    try {
      JSON.stringify(response)
    } catch (error) {
      console.error('响应数据序列化失败:', error)
      return NextResponse.json(
        {
          error: '响应数据格式错误',
        },
        { status: 500 },
      )
    }
    
    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: `无法解析助记词或查询钱包信息：${message}`,
      },
      { status: 500 },
    )
  }
}

