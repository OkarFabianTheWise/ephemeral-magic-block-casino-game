import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { Moonbets } from "../target/types/moonbets";
import { expect } from "chai";
import { before, it } from "node:test";
import { Testuser1, Testuser2 } from "../test-users/users";

const wallet = [
  144, 112, 15, 229, 213, 155, 175, 224, 10, 190, 15,
  240, 206, 31, 46, 22, 215, 223, 211, 17, 167, 73,
  70, 197, 160, 53, 84, 39, 35, 205, 53, 198, 11,
  254, 88, 27, 225, 64, 3, 167, 250, 25, 29, 110,
  16, 28, 144, 156, 83, 131, 241, 33, 48, 142, 22,
  232, 252, 119, 43, 109, 220, 57, 4, 88
];

// Generate a new keypair for testing as an admin
const adminKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(Testuser1));
console.log("adminKeypair public key:", adminKeypair.publicKey.toBase58());

// Generate a new keypair for testing as a player
const playerKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(Testuser2));
console.log("playerKeypair public key:", playerKeypair.publicKey.toBase58());

const devnetUrl = "https://api.devnet.solana.com";

// sleep function to wait for VRF callback
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("moonbets", () => {
  const connection = new anchor.web3.Connection(devnetUrl, "confirmed");
  const wallet_keypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(wallet));
  console.log("Wallet public key:", wallet_keypair.publicKey.toBase58());
  
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet_keypair),
    { commitment: "confirmed" }
  );
  
  anchor.setProvider(provider);
  
  const program = anchor.workspace.Moonbets as Program<Moonbets>;
  const payer = wallet_keypair.publicKey;
  console.log("Payer public key:", payer.toBase58());
  
  
  
  // Accounts and PDAs
  let platformStatsKeypair: anchor.web3.Keypair;
  let platformStatsPubkey: anchor.web3.PublicKey;
  let platformVaultPubkey: anchor.web3.PublicKey;
  let playerPubkey: anchor.web3.PublicKey;
  let adminAccountPubkey: anchor.web3.PublicKey;
  let vaultBump: number;
  let playerBump: number;
  
  // VRF related
  let programIdentityPubkey: anchor.web3.PublicKey;
  let identityBump: number;
  let oracleQueue: anchor.web3.PublicKey;
  let vrfProgramAddress: anchor.web3.PublicKey;
  
  before(async () => {
    // Find platform vault PDA
    [platformVaultPubkey, vaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("platform_vault")],
      program.programId
    );
    console.log("Platform vault:", platformVaultPubkey.toBase58());

    [platformStatsPubkey, vaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("platform_stats")],
      program.programId
    );
    console.log("Platform stats:", platformStatsPubkey.toBase58());
    
    // Find player PDA
    [playerPubkey, playerBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("playerd"), playerKeypair.publicKey.toBuffer()],
      program.programId
    );
    console.log("Player account:", playerPubkey.toBase58());
    
    // Find VRF program identity
    [programIdentityPubkey, identityBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("identity")],
      program.programId
    );

    // platformStatsKeypair = anchor.web3.Keypair.generate();
    // platformStatsPubkey = platformStatsKeypair.publicKey; // new anchor.web3.PublicKey("9coXMb4NdHqvqgyLxiKU1PFjVYWqhVvFh54uaFZaiF7x"); // platformStatsKeypair.publicKey;
    // console.log("Platform stats:", platformStatsPubkey.toBase58());
    
    // Setup VRF oracle queue
    oracleQueue = new anchor.web3.PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");

    vrfProgramAddress = new web3.PublicKey("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");

  });
  
  it("Initializes the platform", async () => {
    const [adminPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("admin"), wallet_keypair.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializePlatform()
      .accountsStrict({
        admin: payer,
        platformStats: platformStatsPubkey,
        platformVault: platformVaultPubkey,
        adminAccount: adminPda, 
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([wallet_keypair])
      .rpc();

    await sleep(2000);
    
    // Fetch and verify platform stats
    const platformStats = await program.account.platformStats.fetch(platformStatsPubkey);
    expect(platformStats.isInitialized).to.be.true;
    expect(platformStats.withdrawnToday.toNumber()).to.equal(0);
    expect(platformStats.primaryAdmin.toString()).to.equal(wallet_keypair.publicKey.toString());
    expect(platformStats.adminCount).to.equal(1);
  });
  
  // it("Initializes a player", async () => {
  //   await program.methods
  //     .initializePlayer()
  //     .accountsStrict({
  //       payer: playerKeypair.publicKey,
  //       player: playerPubkey,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     })
  //     .signers([playerKeypair])
  //     .rpc();

  //   await sleep(2000);
    
  //   // Fetch and verify player account
  //   const player = await program.account.player.fetch(playerPubkey);
  //   expect(player.lastResult).to.equal(0);
  //   expect(player.currentBet).to.equal(0);
  //   expect(player.lastBetAmount.toNumber()).to.equal(0);
  //   expect(player.pendingWithdrawal.toNumber()).to.equal(0);
  //   expect(player.wins).to.equal(0);
  //   expect(player.losses).to.equal(0);
  //   expect(player.totalGames).to.equal(0);
  // });
  
  // it("Adds a new admin", async () => {
  //   // Generate new admin account
  //   const [adminPda] = anchor.web3.PublicKey.findProgramAddressSync(
  //     [Buffer.from("admin"), adminKeypair.publicKey.toBuffer()],
  //     program.programId
  //   );

  //   console.log("Admin Pda:", adminPda)

    
  //   await program.methods
  //     .addAdmin()
  //     .accountsStrict({
  //       primaryAdmin: wallet_keypair.publicKey,
  //       platformStats: platformStatsPubkey,
  //       admin: adminPda,
  //       newAdmin: adminKeypair.publicKey,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     })
  //     .signers([wallet_keypair])
  //     .rpc();

  //   await sleep(2000);
    
  //   // Fetch and verify admin account
  //   const admin = await program.account.admin.fetch(adminPda);
  //   expect(admin.pubkey.toString()).to.equal(adminKeypair.publicKey.toString());
  //   expect(admin.isActive).to.be.true;
    
  //   // Verify admin count increased
  //   const platformStats = await program.account.platformStats.fetch(platformStatsPubkey);
  //   console.log("platformStats.adminCount:", platformStats.adminCount)
  //   // expect(platformStats.adminCount).to.equal(2);
  // });
  
  // it("Admin deposits funds to the platform", async () => {
  //   const depositAmount = new anchor.BN(10_000_000); // 0.01 SOL
    
  //   const balanceBefore = await connection.getBalance(platformVaultPubkey);
  //   console.log("Platform balanceBefore:", balanceBefore / 1_000_000_000)
    
  //   await program.methods
  //     .adminDeposit(depositAmount)
  //     .accountsStrict({
  //       admin: adminKeypair.publicKey,
  //       platformVault: platformVaultPubkey,
  //       systemProgram: web3.SystemProgram.programId,
  //     })
  //     .signers([adminKeypair])
  //     .rpc();

  //   await sleep(2000);
    
  //   const balanceAfter = await connection.getBalance(platformVaultPubkey);
  //   console.log("Platform balanceAfter:", balanceAfter / 1_000_000_000)
  //   expect(balanceAfter - balanceBefore).to.equal(depositAmount.toNumber());
  // });
  
  it("Player places a bet", async () => {
    const betChoice = 3; // Betting on 3
    const betAmount = new anchor.BN(50_000_000); // 0.05 SOL
    const clientSeed = 43; // Random client seed
    
    await program.methods
      .play(betChoice, betAmount, clientSeed)
      .accountsStrict({
        payer: playerKeypair.publicKey,
        player: playerPubkey,
        platformVault: platformVaultPubkey,
        // platformStats: platformStatsPubkey,
        oracleQueue: oracleQueue,
        programIdentity: programIdentityPubkey,
        slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
        vrfProgram: vrfProgramAddress,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([playerKeypair])
      .rpc();

    await sleep(1000);
    
    // Fetch and verify player bet info
    const player = await program.account.player.fetch(playerPubkey);
    console.log("player.currentBet:", player.currentBet)
    // expect(player.currentBet).to.equal(betChoice);
    // expect(player.lastBetAmount.toNumber()).to.equal(betAmount.toNumber());
  });
  
  it("Admin withdraws funds", async () => {
    // Generate new admin account
    const [adminPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("admin"), adminKeypair.publicKey.toBuffer()],
      program.programId
    );

    const withdrawAmount = new anchor.BN(10_000_000); // 0.01 SOL
    
    // Get admin balance before withdrawal
    const adminBalanceBefore = await connection.getBalance(adminKeypair.publicKey);
    
    await program.methods
      .adminWithdraw(withdrawAmount)
      .accountsStrict({
        admin: adminKeypair.publicKey,
        platformVault: platformVaultPubkey,
        platformStats: platformStatsPubkey,
        adminAccount: adminPda, // Required for non-primary admin
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([adminKeypair])
      .rpc();

    await sleep(1000);
    
    // Get admin balance after withdrawal
    const adminBalanceAfter = await connection.getBalance(adminKeypair.publicKey);
    
    // Verify the balance increased by the withdrawal amount (minus tx fees)
    expect(adminBalanceAfter).to.be.greaterThan(adminBalanceBefore);
  });
  
  // it("Removes an admin", async () => {
  //   // Generate new admin account
  //   const [adminPda] = anchor.web3.PublicKey.findProgramAddressSync(
  //     [Buffer.from("admin"), adminKeypair.publicKey.toBuffer()],
  //     program.programId
  //   );

  //   await program.methods
  //     .removeAdmin()
  //     .accounts({
  //       primaryAdmin: wallet_keypair.publicKey,
  //       platformStats: platformStatsPubkey,
  //       admin: adminPda,
  //     })
  //     .rpc();

  //   await sleep(1000);
    
  //   // Verify admin was deactivated
  //   const admin = await program.account.admin.fetch(adminPda);
  //   expect(admin.isActive).to.be.false;
    
  //   // Verify admin count decreased
  //   const platformStats = await program.account.platformStats.fetch(platformStatsPubkey);
  //   console.log("platformStats:", platformStats)
  //   // expect(platformStats.adminCount).to.equal(1);
  // });
  
  // Additional test cases that could be added:
  // - Test maximum bet limits
  // - Test daily withdrawal limits
  // - Test error cases (e.g., unauthorized access)
  // - Test trying to remove primary admin (should fail)
  // - Test reaching maximum admin count
});