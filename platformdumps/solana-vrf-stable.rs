// programs/moonbets/src/lib.rs
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;

declare_id!("2zdSF8zfWrpaNEFTnpSPwbHmuGfFpY7jsSoRYeKeDetf");

pub const PLAYER: &[u8] = b"playerd";
pub const VAULT_SEED: &[u8] = b"platform_vault";
pub const STATS_SEED: &[u8] = b"platform_stats";

#[program]
pub mod moonbets {
    use super::*;

    pub fn initialize_platform(ctx: Context<InitializePlatform>) -> Result<()> {
        let stats = &mut ctx.accounts.platform_stats;
        let now = Clock::get()?.unix_timestamp;

        stats.is_initialized = true;
        stats.last_reset = now;
        stats.withdrawn_today = 0;
        stats.primary_admin = ctx.accounts.admin.key();
        stats.admin_count = 1;
        stats.total_bets = 0;
        stats.total_volume = 0;
        stats.total_users = 0;
        stats.daily_withdrawal = DailyWithdrawal {
            date: now,
            amount: 0,
        };
        stats.total_profit = 0;
        stats.total_owed = 0;
        stats.current_active_users = 0;
        stats.max_bet_lamports = 5_000_000_000;
        stats.daily_withdraw_limit = 15_000_000_000;

        let admin_account = &mut ctx.accounts.admin_account;
        admin_account.pubkey = ctx.accounts.admin.key();
        admin_account.is_active = true;

        Ok(())
    }

    pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
        let player = &mut ctx.accounts.player;

        player.last_result = 0;
        player.current_bet = 0;
        player.last_bet_amount = 0;
        player.pending_withdrawal = 0;
        player.wins = 0;
        player.losses = 0;
        player.total_games = 0;
        ctx.accounts.platform_stats.admin_count += 1;
        ctx.accounts.platform_stats.total_users += 1;

        Ok(())
    }

    pub fn add_admin(ctx: Context<AddAdmin>) -> Result<()> {
        require!(
            ctx.accounts.platform_stats.admin_count < 10, // Arbitrary limit - you can adjust
            ErrorCode::MaxAdminsReached
        );

        let admin = &mut ctx.accounts.admin;
        admin.pubkey = ctx.accounts.new_admin.key();
        admin.is_active = true;

        // Increment admin count
        ctx.accounts.platform_stats.admin_count += 1;

        emit!(AdminAdded {
            admin: admin.pubkey,
            added_by: ctx.accounts.primary_admin.key(),
        });

        Ok(())
    }

    pub fn remove_admin(ctx: Context<RemoveAdmin>) -> Result<()> {
        let admin = &mut ctx.accounts.admin;

        // Deactivate admin
        admin.is_active = false;

        // Decrement admin count
        ctx.accounts.platform_stats.admin_count -= 1;

        emit!(AdminRemoved {
            admin: admin.pubkey,
            removed_by: ctx.accounts.primary_admin.key(),
        });

        Ok(())
    }

    pub fn play(
        ctx: Context<Play>,
        user_choice: u8,
        bet_amount: u64,
        client_seed: u8,
    ) -> Result<()> {
        require!(
            user_choice >= 1 && user_choice <= 6,
            ErrorCode::InvalidChoice
        );
        require!(bet_amount <= ctx.accounts.platform_stats.max_bet_lamports, ErrorCode::ExceedsMaxBet);

        let player = &mut ctx.accounts.player;
        player.current_bet = user_choice;
        player.last_bet_amount = bet_amount;

        // Transfer bet amount from player to vault
        invoke(
            &system_instruction::transfer(
                &ctx.accounts.payer.key(),
                &ctx.accounts.platform_vault.key(),
                bet_amount,
            ),
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.platform_vault.to_account_info(),
            ],
        )?;

        // Request randomness
        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: ID,
            callback_discriminator: instruction::CallbackRollDice::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![
                // Include player account
                SerializableAccountMeta {
                    pubkey: ctx.accounts.player.key(),
                    is_signer: false,
                    is_writable: true,
                }
            ]),
            ..Default::default()
        });

        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    pub fn callback_roll_dice(
        ctx: Context<CallbackRollDiceCtx>,
        randomness: [u8; 32],
    ) -> Result<()> {
        let player = &mut ctx.accounts.player;
        let stats = &mut ctx.accounts.platform_stats;

        let rnd_u8 = ephemeral_vrf_sdk::rnd::random_u8_with_range(&randomness, 1, 6);
        let user_choice = player.current_bet;
        let player_won = user_choice == rnd_u8;

        player.last_result = rnd_u8;
        player.total_games += 1;

        let payout = player.last_bet_amount * 2;
        
        stats.total_bets += 1;
        stats.total_volume += player.last_bet_amount;
        // track timestamped activity

        if player_won {
            player.wins += 1;
            player.pending_withdrawal += payout;
            stats.total_owed += payout;
        } else {
            player.losses += 1;
        }

        player.current_bet = 0;
        player.last_bet_amount = 0;

        emit!(DiceRolled {
            player: player.key(),
            result: rnd_u8,
            won: player_won,
            payout: if player_won { payout } else { 0 },
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let stats = &mut ctx.accounts.platform_stats;

        let amount = ctx.accounts.player.pending_withdrawal;
        require!(amount > 0, ErrorCode::NothingToWithdraw);

        let now = Clock::get()?.unix_timestamp;
        if now - stats.last_reset > 86400 {
            stats.withdrawn_today = 0;
            stats.last_reset = now;
        }
        require!(
            stats.withdrawn_today + amount <= ctx.accounts.platform_stats.daily_withdraw_limit,
            ErrorCode::DailyLimitReached
        );

        **ctx.accounts.platform_vault.try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.payer.try_borrow_mut_lamports()? += amount;

        stats.withdrawn_today += amount;
        if stats.daily_withdrawal.date == now / 86400 * 86400 {
            stats.daily_withdrawal.amount += amount;
        } else {
            stats.daily_withdrawal.date = now / 86400 * 86400;
            stats.daily_withdrawal.amount = amount;
        }
        stats.total_owed -= amount;
        stats.total_profit = stats.total_volume - stats.total_owed;

        ctx.accounts.player.pending_withdrawal = 0;
        Ok(())
    }

    pub fn admin_withdraw(ctx: Context<AdminWithdraw>, amount: u64) -> Result<()> {
        let is_primary_admin =
            ctx.accounts.admin.key() == ctx.accounts.platform_stats.primary_admin;

        // If not primary admin, need to check if they're in admin list
        if !is_primary_admin {
            // We'll require the admin account to be passed in
            let admin_account = ctx
                .accounts
                .admin_account
                .as_ref()
                .ok_or(ErrorCode::Unauthorized)?;

            require!(admin_account.is_active, ErrorCode::Unauthorized);
            require!(
                admin_account.pubkey == ctx.accounts.admin.key(),
                ErrorCode::Unauthorized
            );
        }

        **ctx.accounts.platform_vault.try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.admin.try_borrow_mut_lamports()? += amount;

        emit!(AdminWithdrawal {
            admin: ctx.accounts.admin.key(),
            amount,
        });

        Ok(())
    }

    pub fn admin_deposit(ctx: Context<AdminDeposit>, amount: u64) -> Result<()> {
        let is_primary_admin =
            ctx.accounts.admin.key() == ctx.accounts.platform_stats.primary_admin;

        // If not primary admin, need to check if they're in admin list
        if !is_primary_admin {
            // We'll require the admin account to be passed in
            let admin_account = ctx
                .accounts
                .admin_account
                .as_ref()
                .ok_or(ErrorCode::Unauthorized)?;

            require!(admin_account.is_active, ErrorCode::Unauthorized);
            require!(
                admin_account.pubkey == ctx.accounts.admin.key(),
                ErrorCode::Unauthorized
            );
        }

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.admin.key(),
                &ctx.accounts.platform_vault.key(),
                amount,
            ),
            &[
                ctx.accounts.admin.to_account_info(),
                ctx.accounts.platform_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        Ok(())
    }

    pub fn update_platform_limit(
        ctx: Context<UpdatePlatformLimit>,
        field: String,
        value: u64,
    ) -> Result<()> {
        let stats = &mut ctx.accounts.platform_stats;
         let is_primary_admin =
            ctx.accounts.admin.key() == ctx.accounts.platform_stats.primary_admin;

        // If not primary admin, need to check if they're in admin list
        if !is_primary_admin {
            // We'll require the admin account to be passed in
            let admin_account = ctx
                .accounts
                .admin_account
                .as_ref()
                .ok_or(ErrorCode::Unauthorized)?;

            require!(admin_account.is_active, ErrorCode::Unauthorized);
            require!(
                admin_account.pubkey == ctx.accounts.admin.key(),
                ErrorCode::Unauthorized
            );
        }

        match field.as_str() {
            "max_bet" => stats.max_bet_lamports = value,
            "daily_withdraw" => stats.daily_withdraw_limit = value,
            _ => return Err(error!(ErrorCode::InvalidField)),
        }

        Ok(())
    }

}

// Account structs
#[account]
pub struct Player {
    pub last_result: u8,
    pub current_bet: u8,
    pub last_bet_amount: u64,
    pub pending_withdrawal: u64,
    pub wins: u16,
    pub losses: u16,
    pub total_games: u16,
}

#[account]
pub struct PlatformStats {
    pub is_initialized: bool,
    pub last_reset: i64,
    pub withdrawn_today: u64,
    pub primary_admin: Pubkey,
    pub admin_count: u8,
    pub total_bets: u64,
    pub total_volume: u64,
    pub total_users: u64,
    pub daily_withdrawal: DailyWithdrawal,
    pub total_profit: u64,
    pub total_owed: u64,
    pub current_active_users: u64,
    pub max_bet_lamports: u64,
    pub daily_withdraw_limit: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct DailyWithdrawal {
    pub date: i64,   // The date this amount is for (start of day)
    pub amount: u64, // Total withdrawn on that date
}


#[account]
pub struct Admin {
    pub pubkey: Pubkey,
    pub is_active: bool,
}

// Account contexts
#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init, 
        payer = admin, 
        space = 8 + 716,
        seeds = [STATS_SEED],
        bump
    )]
    pub platform_stats: Account<'info, PlatformStats>,
    /// CHECK: This is a PDA that will hold platform funds
    #[account(
        init,
        payer = admin,
        space = 8, 
        seeds = [VAULT_SEED],
        bump
    )]
    pub platform_vault: AccountInfo<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 1,
        seeds = [b"admin", admin.key().as_ref()],
        bump
    )]
    pub admin_account: Account<'info, Admin>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePlayer<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + 40, // discriminator + struct size
        seeds = [PLAYER, payer.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,
    #[account(
        mut,
        seeds = [STATS_SEED],
        bump
    )]
    pub platform_stats: Account<'info, PlatformStats>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddAdmin<'info> {
    #[account(mut)]
    pub primary_admin: Signer<'info>,
    #[account(
        mut,
        constraint = platform_stats.primary_admin == primary_admin.key() @ ErrorCode::Unauthorized,
        seeds = [STATS_SEED],
        bump
    )]
    pub platform_stats: Account<'info, PlatformStats>,
    #[account(
        init,
        payer = primary_admin,
        space = 8 + 32 + 1, // discriminator + pubkey + is_active
        seeds = [b"admin", new_admin.key.as_ref()],
        bump
    )]
    pub admin: Account<'info, Admin>,
    /// CHECK: This is the new admin's public key
    pub new_admin: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveAdmin<'info> {
    #[account(mut)]
    pub primary_admin: Signer<'info>,
    #[account(
        mut,
        constraint = platform_stats.primary_admin == primary_admin.key() @ ErrorCode::Unauthorized,
        seeds = [STATS_SEED],
        bump
    )]
    pub platform_stats: Account<'info, PlatformStats>,
    #[account(
        mut,
        constraint = admin.pubkey != platform_stats.primary_admin @ ErrorCode::CannotRemovePrimaryAdmin
    )]
    pub admin: Account<'info, Admin>,
}

#[vrf]
#[derive(Accounts)]
pub struct Play<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [PLAYER, payer.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,

    /// CHECK: PDA that holds platform funds
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub platform_vault: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [STATS_SEED],
        bump
    )]
    pub platform_stats: Account<'info, PlatformStats>,
    /// CHECK:
    #[account(mut)]
    pub oracle_queue: AccountInfo<'info>,
    /// CHECK:
    #[account(seeds = [ephemeral_vrf_sdk::consts::IDENTITY], bump)]
    pub program_identity: AccountInfo<'info>,
    /// CHECK:
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: AccountInfo<'info>,
    /// CHECK:
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_ID)]
    pub vrf_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CallbackRollDiceCtx<'info> {
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub player: Account<'info, Player>,
    #[account(
        mut,
        seeds = [STATS_SEED],
        bump
    )]
    pub platform_stats: Account<'info, PlatformStats>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER, payer.key().as_ref()], bump)]
    pub player: Account<'info, Player>,
    /// CHECK: PDA that holds platform funds
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub platform_vault: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [STATS_SEED],
        bump
    )]
    pub platform_stats: Account<'info, PlatformStats>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct AdminWithdraw<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: PDA that holds platform funds
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub platform_vault: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [STATS_SEED],
        bump
    )]
    pub platform_stats: Account<'info, PlatformStats>,
    // Optional because primary admin doesn't need it
    pub admin_account: Option<Account<'info, Admin>>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct AdminDeposit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: PDA that holds platform funds
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub platform_vault: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [STATS_SEED],
        bump
    )]
    pub platform_stats: Account<'info, PlatformStats>,
    // Optional because primary admin doesn't need it
    pub admin_account: Option<Account<'info, Admin>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePlatformLimit<'info> {
    #[account(
        mut,
        seeds = [STATS_SEED],
        bump
    )]
    pub platform_stats: Account<'info, PlatformStats>,
    // Optional because primary admin doesn't need it
    pub admin_account: Option<Account<'info, Admin>>,
}

// Events
#[event]
pub struct DiceRolled {
    pub player: Pubkey,
    pub result: u8,
    pub won: bool,
    pub payout: u64,
}

#[event]
pub struct AdminAdded {
    pub admin: Pubkey,
    pub added_by: Pubkey,
}

#[event]
pub struct AdminRemoved {
    pub admin: Pubkey,
    pub removed_by: Pubkey,
}

#[event]
pub struct AdminWithdrawal {
    pub admin: Pubkey,
    pub amount: u64,
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Choice must be between 1 and 6")]
    InvalidChoice,
    #[msg("No bet placed yet")]
    NoBetPlaced,
    #[msg("Bet exceeds max allowed")]
    ExceedsMaxBet,
    #[msg("Nothing to withdraw")]
    NothingToWithdraw,
    #[msg("Platform daily payout limit reached")]
    DailyLimitReached,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Maximum number of admins reached")]
    MaxAdminsReached,
    #[msg("Cannot remove primary admin")]
    CannotRemovePrimaryAdmin,
    #[msg("Invalid field name provided.")]
    InvalidField,
}
