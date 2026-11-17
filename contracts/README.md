# Usernames on ENS (rumalatam.eth)

Each Ruma user can claim one permanent name, `daniel.rumalatam.eth`. The app
shows it as `@daniel`. ENS is the only record of who owns which name: Ruma
keeps no database of usernames. The browser caches the user's own name only so
the header can show it without waiting on an RPC.

## How it fits together

```
ETHRegistry ── rumalatam ── subregistry ──▶ UserRegistry (ours)
                                             └─ daniel → owner: user's wallet, roles: none
                                                         resolver ──▶ PermissionedResolver (ours, usernames only)
                                                                      └─ daniel.rumalatam.eth → addr (ETH, Base) = user's wallet
RumaRegistrar ── ROLE_REGISTRAR on the UserRegistry
              └─ ROLE_SET_ADDRESS on the username resolver
              └─ claimer = writer wallet (server env ENS_WRITER_PRIVATE_KEY)
```

`RumaRegistrar.claim(label, account)` does everything in one transaction:
- checks the label is 3–20 characters of a–z and 0–9;
- checks the account has no name yet, and the label has never been issued;
- registers the label (the registry itself refuses a taken label);
- writes the ETH and Base address records.

`labelOf(account)` is how the app finds a user's name from their address.

- **What a leaked writer key can do:** create new names and burn the gas ETH. It can't change existing names, can't transfer `rumalatam.eth`, and can't touch anyone's funds.
- **Revoking a leaked key:** the admin (the `rumalatam.eth` owner) calls `setClaimer(newAddress)`.
- **Name ownership:** users own their name's token, but with no roles, so they can't transfer it or repoint it.
- **Your control:** the owner keeps full root roles on the registry and the resolver, so abusive names can still be removed.

## One-time setup

1. **Renew rumalatam.eth for many years in the ENS app** (app.ens.domains).
   - It currently expires on 2027-11-06. If it expires, every username stops resolving.
   - Don't add a default address record for subnames. If you did, every unclaimed name (`anything.rumalatam.eth`) would resolve to it, and people would send money there.
2. **Create the writer wallet.** Generate a key, store it as `ENS_WRITER_PRIVATE_KEY`, and send it a little ETH on mainnet:
   ```sh
   node -e "import('viem/accounts').then(a=>{const k=a.generatePrivateKey();console.log('key',k);console.log('address',a.privateKeyToAccount(k).address)})"
   ```
3. **Preview the on-chain steps** (no key needed):
   ```sh
   OWNER_ADDRESS=0x32B2304953a56Be7eb58a5b564Be1b6A5358761A CLAIMER_ADDRESS=<writer address> node contracts/setup.mjs
   ```
4. **Run them** with the `rumalatam.eth` owner's key, passed inline for this one run:
   ```sh
   OWNER_PRIVATE_KEY=<owner key> CLAIMER_ADDRESS=<writer address> node contracts/setup.mjs --send
   ```
   This sends about seven transactions from the owner wallet:
   - deploy the UserRegistry proxy;
   - deploy the username resolver proxy;
   - deploy RumaRegistrar;
   - grant the registrar its two roles;
   - `setParent`;
   - `setSubregistry` on `rumalatam.eth`.

   It's safe to re-run: finished steps are skipped. After the registrar is deployed, pass `RUMA_REGISTRAR_ADDRESS=<address>` on any re-run.
5. **Configure the app:**
   - set `NEXT_PUBLIC_RUMA_REGISTRAR_ADDRESS`;
   - set `ENS_WRITER_PRIVATE_KEY` (server only; on Vercel: Sensitive, Production);
   - set `NEXT_PUBLIC_MAINNET_RPC_URL`, plus optionally `MAINNET_RPC_URL`.
6. **Check with one real claim** before announcing it. Claim a name in the app, then confirm it in the ENS app and from another wallet (send a small amount of USDC on Base to `name.rumalatam.eth`).

## Rebuilding the contract artifact

`out/RumaRegistrar.json` is compiled with solc 0.8.28, optimizer at 200 runs, EVM version `cancun`. If you change `RumaRegistrar.sol`, rebuild it with the same settings, for example in Foundry or with the `solc` npm package. Then verify the deployed contract on Etherscan with those settings.

The contract has not been audited. Before deploying, test it against a mainnet fork, for example with Foundry's `forge test --fork-url`.
