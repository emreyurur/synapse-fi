# Yerel Kurulum (Runbook)

Tüm stack'i sıfırdan ayağa kaldırma. Her komut **kendi terminalinde** çalışır;
anvil / indexer / API / web açık kalmalı.

> **Neden `npx`?** `ponder`, `tsx`, `next` global değil — repo'nun
> `node_modules/.bin` klasöründeki yerel binary'ler. `npx` onları oradan bulur.
> Bu yüzden `ponder start` "command not found" verir, `npx ponder start` çalışır.

---

## 0. Ön koşullar (tek seferlik)

| Araç | Kontrol | Kurulum |
|---|---|---|
| Node 20+ | `node -v` | nodejs.org |
| Foundry | `anvil --version` | `~/.foundry/bin` PATH'te olmalı |
| Docker Desktop | `docker info` | açık olmalı |

```bash
npm install          # repo kökünde, bir kez
```

---

## 1. Postgres (Docker)

```bash
# İlk seferse container'ı yarat:
docker run -d --name synapsefi-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=synapsefi postgres:16-alpine

# Zaten varsa sadece başlat:
docker start synapsefi-pg
```

Kontrol: `docker exec synapsefi-pg pg_isready -U postgres`

## 2. Anvil (yerel zincir)

`--chain-id 5042002` **zorunlu** — `ponder.config.ts` bu id'yi bekliyor.

> **Kalıcılık:** `--state` verirsen anvil kapanışta (ve her 30 saniyede bir,
> düzensiz kapanışlara karşı) zincir durumunu `.anvil/state.json`'a yazar ve
> açılışta oradan devam eder. Yani PC'yi kapatıp açsan, hatta terminali
> zorla kapatsan bile (`taskkill /F`) kontratlar, bakiyeler, kredi hattı —
> hepsi olduğu gibi kalır. Test edildi: zorla kill sonrası aynı bloktan
> devam etti. **Bu varsa 3–6. adımları (deploy, DB temizleme, traffic seed)
> sadece ilk kurulumda yapman yeterli** — sonraki her açılışta anvil zaten
> kaldığı yerden devam eder, indexer da (`ponder_sync` cache sayesinde)
> sadece aradaki farkı senkronize eder.

**İlk kurulum** (zinciri 30 gün geçmişten başlatır — demo verisinin 30
günlük gelir geçmişi bunu ister):

```bash
anvil --chain-id 5042002 --timestamp $(( $(date +%s) - 30*86400 )) \
  --state .anvil/state.json --state-interval 30
```

**Sonraki her açılış** (`--timestamp` artık gereksiz, state zaten zamanı biliyor):

```bash
anvil --chain-id 5042002 --state .anvil/state.json --state-interval 30
```

`.anvil/` klasörünü silersen bir sonraki açılış sıfırdan başlar (fresh
genesis) — o zaman 3–6. adımları tekrar çalıştırman gerekir.

## 3. Kontratları deploy et

```bash
cd packages/contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Adresler deterministiktir — anvil her sıfırlandığında **aynı** çıkar, bu yüzden
`packages/shared/src/index.ts` ve `.env` dosyaları güncel kalır.

## 4. Indexer (Ponder)

Yalnızca **zinciri sıfırdan başlattıysan** (`.anvil/` yoksa/sildiysen, ya da
`--state` olmadan çalıştırdıysan) DB'yi temizle — eski checkpoint yeni
zincirle uyuşmaz. Zincir `--state`'ten devam ettiyse bu adımı **atla**.

```bash
docker exec synapsefi-pg psql -U postgres -d synapsefi \
  -c "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS ponder_sync CASCADE; CREATE SCHEMA public;"
```

```bash
cd packages/indexer
npx ponder start          # `ponder dev`ın TUI'si bu ortamda güvenilir değil
```

> Ponder CLI yalnızca **`.env.local`** okur, `.env` okumaz — ikisi de mevcut ve
> aynı içerikte tutulmalı.

## 5. API

```bash
cd apps/api
npm run dev               # http://localhost:3001
```

Kontrol: `curl http://localhost:3001/health`

## 6. Demo verisi üret

Sırası önemli — oracle **en son** çalışmalı (skor 1 gün sonra bayatlar,
`openLine` taze skor ister).

```bash
cd apps/api

# 6a. 29 gün boyunca job + nanopayment trafiği (her round 1 gün ileri sarar)
npm run traffic -- --rounds 29 --spread-days 1

# 6b. zinciri şimdiki zamana getir
cast rpc evm_setNextBlockTimestamp $(date +%s) --rpc-url http://localhost:8545
cast rpc evm_mine --rpc-url http://localhost:8545

# 6c. skorları hesapla ve zincire yaz
npm run oracle
```

Sonra LP likidite + kredi hattı (anvil test hesaplarıyla):

```bash
RPC=http://localhost:8545
USDC=0x5FbDB2315678afecb367f032d93F642f64180aa3
POOL=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
CLM=0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
LP_KEY=0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
LP=0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
A1_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
A1=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

cast send $USDC "mint(address,uint256)" $LP 80000000000 --rpc-url $RPC --private-key $LP_KEY
cast send $USDC "approve(address,uint256)" $POOL 80000000000 --rpc-url $RPC --private-key $LP_KEY
cast send $POOL "deposit(uint256,address)" 80000000000 $LP --rpc-url $RPC --private-key $LP_KEY
cast send $CLM "openLine(address)" $A1 --rpc-url $RPC --private-key $A1_KEY
cast send $CLM "draw(uint256)" 12000000000 --rpc-url $RPC --private-key $A1_KEY
```

## 7. Frontend

```bash
cd apps/web
npm run dev               # http://localhost:3000
```

`apps/web/.env.local` yerel RPC + API'yi işaret eder. Bu dosyayı
değiştirirsen dev server'ı **yeniden başlat** — `NEXT_PUBLIC_*` derleme
anında gömülür.

---

## MetaMask'i bağlama

> ⚠️ **Yerel zincir, Arc Testnet'in chain id'sini (5042002) taklit ediyor.**
> MetaMask "Arc Testnet"te olduğunu sanır ama uygulama `localhost:8545`'i okur.
> Gerçek Arc Testnet'teki USDC'n burada **görünmez** — iki ayrı zincir, aynı id.
> Yerel zincirde bakiye görmek için aşağıdaki iki yoldan biri gerekir.

Ağ ekle: RPC `http://localhost:8545`, Chain ID `5042002`, sembol `USDC`.

**A) Kendi cüzdanını fonla** (kendi adresinle test etmek için):

```bash
cd apps/api
npm run fund -- 0xSeninAdresin            # 100k USDC + 100 gas
npm run fund -- 0xSeninAdresin --usdc 5000 --gas 10
```

Sonra MetaMask'te token olarak MockUSDC'yi ekle: `0x5FbDB2315678afecb367f032d93F642f64180aa3`

Bu adresin henüz kredi hattı olmaz — Borrow sekmesinde "Apply for a line"
görürsün ama skor gerekir, o yüzden hazır demo verisi için (B)'yi kullan.

**B) Hazır anvil hesabını içe aktar** (demo verisi zaten bu hesaplarda):

- **Agent** (18.5k limit, 12k çekili, 30 günlük gelir geçmişi):
  `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
- **LP** (havuzda 80k pozisyon):
  `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a`

> Bu anahtarlar herkesçe bilinen anvil test anahtarlarıdır. **Asla gerçek
> fon tutan bir cüzdanda kullanma.**

Agent hesabıyla **Borrow**, LP hesabıyla **Earn** sekmesi dolu görünür.

## Gelir → borç akışını canlı görmek

```bash
cd apps/api && npm run traffic -- --rounds 4      # splitter'a gelir akıtır
cast send <SPLITTER_ADDR> "flush()" --rpc-url http://localhost:8545 --private-key $A1_KEY
```

`flush()` gelen USDC'nin %12'sini havuza (borç amortismanı), %88'ini agent
treasury'sine gönderir. Borç UI'da anında düşer.

Splitter adresi:
```bash
cast call 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 "splitterOf(address)(address)" $A1 --rpc-url $RPC
```

---

## Gerçek Arc Testnet'te çalıştırma (MVP)

### Canlı deployment (2026-07-17, blok 52283956)

| Kontrat | Adres |
|---|---|
| MockUSDC | `0xf308ad06F61765F7F47b6A0c67C1443DC70633E0` |
| ScoreOracle | `0x688bac7FC391492Efad97bd53801058b3c72b550` |
| InterestRateModel | `0x1e420671f1cd6300659e503B62a202895dC0E346` |
| CreditPool | `0xd52FE9eDE0B4c80cCCd16e7d43E3409243c780Eb` |
| CreditLineManager | `0xd1b961b3F4f9A54906e88A205b58ce38a501704B` |
| RevenueRouterFactory | `0xbcB73B220B98065B2Dd05008Ca2cD00c5ed9833A` |
| MockAgentRegistry | `0xB702cA80E792Ad0b04D34D9F78a8be7aF7e835D5` |
| MockJobBoard | `0x4503e5cADc62A48Ac935B05bAF1e31A5083c9795` |

Explorer: https://testnet.arcscan.app — deployer `0x602D…520b`.
Aktif/yerel konfigürasyon geçişi: `.env.arc` ↔ `.env.anvil` yedekleri
(`apps/api/.env.anvil`, `packages/indexer/.env.local.anvil`, `apps/web/.env.local.anvil`).

Kod aynı; sadece konfigürasyon değişir. Üç `.env.arc` şablonu hazır
(`packages/indexer/`, `apps/api/`, `apps/web/`) — deploy sonrası adresler
doldurulup ilgili `.env` / `.env.local` üzerine kopyalanır.

Yerelden farkları:

| Konu | Yerel (anvil) | Gerçek Arc |
|---|---|---|
| Zaman yolculuğu | `--spread-days` ile 30 günlük geçmiş | **Yok** — geçmiş gerçek zamanda birikir (günlük cron) |
| Gaz | bedava | native USDC (faucet'ten) — deployer/poster/agent cüzdanları fonlanmalı |
| USDC | MockUSDC, sınırsız mint | yine MockUSDC (mint serbest) — sadece gaz faucet'ten |
| Adresler | deterministik, sabit | deployer nonce'una bağlı, deploy sonrası env'lere yazılır |
| `PONDER_START_BLOCK` | 0 | **deploy bloğu** (zincirde ~52M blok var, 0'dan indexlemek günler sürer) |
| DB şeması | `public` | `arc` (yerel anvil verisi bozulmadan yan yana durur) |
| Oracle | elle `npm run oracle` | API içinde cron (`ORACLE_ENABLED=true`, 6 dk'da bir) |
| `npm run fund` / `seed:full` | çalışır | **çalışmaz** (anvil-özel RPC); trafik için `npm run traffic -- --rounds 2` |

Deploy (anahtarlar `.env.arc-keys`'te, gitignored):

```bash
source .env.arc-keys
cd packages/contracts
forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.network \
  --broadcast --private-key $ARC_DEPLOYER_KEY
```

Günlük veri birikimi (skorun 30 günlük penceresi gerçek günlerle dolar —
~2 haftada B+/A−, ~1 ayda A):

```bash
cd apps/api && npm run traffic -- --rounds 2   # günde bir çalıştır (cron)
```

## Sık karşılaşılan hatalar

| Belirti | Sebep / çözüm |
|---|---|
| `ponder: command not found` | `npx ponder start` kullan, ve `packages/indexer` içinde ol |
| Indexer `BlockNotFoundError` | DB eski zinciri hatırlıyor → 4. adımdaki DROP SCHEMA'yı çalıştır |
| `ScoreTooLowOrStale` | Skor 1 günden eski → `npm run oracle` tekrar çalıştır |
| UI'da her şey boş / `—` | API veya anvil kapalı; ya da web dev server `.env.local`'dan önce başlatılmış → yeniden başlat |
| Cüzdan "wrong network" | MetaMask'te chain id 5042002 seçili değil |

---

## Prod deploy (Vercel + Railway)

Vercel **sadece** `apps/web`'i host eder. Skor, agent listesi, revenue grafiği,
pool stats ve mock-onboarding hepsi `apps/api`'ye HTTP ile gidiyor — bu yüzden
API + indexer + Postgres'in de **herkese açık, sürekli çalışan** bir yerde
olması şart. İkisi de (özellikle indexer + oracle cron) sürekli process
istediği için serverless'a uymuyor — Railway kullanıyoruz.

### 1. Railway: Postgres + iki servis

Tek Railway projesinde:

1. **Postgres** eklentisi ekle (Railway otomatik `DATABASE_URL` üretir).
2. **API servisi** — aynı GitHub repo'dan, Root Directory = `/` (repo kökü,
   npm workspaces linklemesi için şart), Config File Path =
   `railway.api.json`.
3. **Indexer servisi** — aynı repo, Root Directory = `/`, Config File Path =
   `railway.indexer.json`.

Root Directory'nin repo kökünde kalması önemli: `npm install` workspace
paketlerini (`@synapsefi/shared`, `@synapsefi/indexer`) linkleyebilmek için
kökte çalışmalı; `railway.*.json` içindeki `startCommand` zaten doğru
workspace'i hedefliyor (`npm run start -w @synapsefi/api` vb.).

**API servisi env değişkenleri** (`apps/api/.env.arc` ile birebir, değerleri
`.env.arc-keys`'ten al — repo'ya asla commit'leme):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}     # Railway variable reference
RPC_URL=https://rpc.testnet.arc.network
USDC_ADDRESS=0xf308ad06F61765F7F47b6A0c67C1443DC70633E0
SCORE_ORACLE_ADDRESS=0x688bac7FC391492Efad97bd53801058b3c72b550
CREDIT_POOL_ADDRESS=0xd52FE9eDE0B4c80cCCd16e7d43E3409243c780Eb
CREDIT_LINE_MANAGER_ADDRESS=0xd1b961b3F4f9A54906e88A205b58ce38a501704B
REVENUE_ROUTER_FACTORY_ADDRESS=0xbcB73B220B98065B2Dd05008Ca2cD00c5ed9833A
AGENT_REGISTRY_ADDRESS=0xB702cA80E792Ad0b04D34D9F78a8be7aF7e835D5
JOB_BOARD_ADDRESS=0x4503e5cADc62A48Ac935B05bAF1e31A5083c9795
ORACLE_ENABLED=true
ORACLE_CRON=0 * * * *
ORACLE_PRIVATE_KEY=<gizli — oracle updater key>
```

`DATABASE_SCHEMA` **ayarlama** — taze bir Postgres'te lokal anvil verisiyle
karışma riski yok, varsayılan `public` şeması yeterli (yerel kurulumdaki
`arc`/`public` ayrımı sadece aynı DB'yi iki zincir arasında paylaşırken
gerekliydi).

**Indexer servisi env değişkenleri** (`packages/indexer/.env.arc` ile
birebir):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
PONDER_START_BLOCK=52283956
SCORE_ORACLE_ADDRESS=0x688bac7FC391492Efad97bd53801058b3c72b550
CREDIT_POOL_ADDRESS=0xd52FE9eDE0B4c80cCCd16e7d43E3409243c780Eb
CREDIT_LINE_MANAGER_ADDRESS=0xd1b961b3F4f9A54906e88A205b58ce38a501704B
REVENUE_ROUTER_FACTORY_ADDRESS=0xbcB73B220B98065B2Dd05008Ca2cD00c5ed9833A
AGENT_REGISTRY_ADDRESS=0xB702cA80E792Ad0b04D34D9F78a8be7aF7e835D5
JOB_BOARD_ADDRESS=0x4503e5cADc62A48Ac935B05bAF1e31A5083c9795
# Birden fazla RPC → biri rate-limit'lense bile indexer diğerine döner.
PONDER_RPC_URL_ARC=https://rpc.testnet.arc.network,https://rpc.quicknode.testnet.arc.network,https://rpc.blockdaemon.testnet.arc.network
```

> **Public RPC rate limit'i:** Arc'ın paylaşımlı public RPC'si hem indexer'ı
> hem her yeni cüzdanın mock-onboarding tx'ini aynı anda vuruyor ve throttle
> ediyor (`"request limit reached"`). Yukarıdaki `PONDER_RPC_URL_ARC` rotasyonu
> indexer tarafını hafifletir; gerçek jüri trafiğinde daha sağlam olmak için
> Arc'tan (veya Alchemy/Infura destekliyorsa) özel bir RPC key almak en
> güvenilir çözüm — API tarafı (`RPC_URL`) şu an tek endpoint kullanıyor,
> rotasyon desteklemiyor.

### 2. Vercel: `apps/web`

Proje ayarlarında Root Directory = `apps/web`. Env değişkenleri
(`apps/web/.env.arc` ile birebir; `NEXT_PUBLIC_*` derleme anında gömüldüğü
için değiştirince redeploy gerekir):

```
NEXT_PUBLIC_API_URL=https://<railway-api-servisinin-public-domaini>
NEXT_PUBLIC_USDC_ADDRESS=0xf308ad06F61765F7F47b6A0c67C1443DC70633E0
NEXT_PUBLIC_CREDIT_POOL_ADDRESS=0xd52FE9eDE0B4c80cCCd16e7d43E3409243c780Eb
NEXT_PUBLIC_CREDIT_LINE_MANAGER_ADDRESS=0xd1b961b3F4f9A54906e88A205b58ce38a501704B
NEXT_PUBLIC_SCORE_ORACLE_ADDRESS=0x688bac7FC391492Efad97bd53801058b3c72b550
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0xB702cA80E792Ad0b04D34D9F78a8be7aF7e835D5
```

Railway API servisinde "Generate Domain" ile public bir URL üret, onu
`NEXT_PUBLIC_API_URL`'e yapıştır.

### 3. Devreye alma sırası

1. Railway Postgres + iki servisi kur, env'leri gir, deploy et.
2. Indexer loglarında `Started 'arc' historical sync` göründükten sonra
   `arc.agent` tablosunda satır birikmeye başlayana kadar bekle (deploy
   bloğundan bugüne kadarki geçmiş — public RPC'de biraz sürebilir).
3. `https://<api-domain>/health` ve `/agents` çalıştığını doğrula.
4. Vercel'i deploy et, `NEXT_PUBLIC_API_URL`'in Railway domainini gösterdiğini
   doğrula.
5. Canlı sitede bir cüzdan bağla → skor gauge'ının dolduğunu, "Get test USDC"
   ile mint edip Earn/Borrow'un çalıştığını doğrula.

CORS zaten açık (`app.use("*", cors())`, `apps/api/src/app.ts`) — Vercel
domaini için ekstra bir ayar gerekmiyor.
