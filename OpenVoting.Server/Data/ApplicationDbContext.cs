using Microsoft.EntityFrameworkCore;

namespace OpenVoting.Data;

public sealed class ApplicationDbContext : DbContext
{
  public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

  public DbSet<Community> Communities => Set<Community>();
  public DbSet<CommunityMember> CommunityMembers => Set<CommunityMember>();
  public DbSet<Poll> Polls => Set<Poll>();
  public DbSet<PollEntry> PollEntries => Set<PollEntry>();
  public DbSet<Vote> Votes => Set<Vote>();
  public DbSet<VoteChoice> VoteChoices => Set<VoteChoice>();
  public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<OneTimeLoginToken> OneTimeLoginTokens => Set<OneTimeLoginToken>();

  protected override void OnModelCreating(ModelBuilder modelBuilder)
  {
    modelBuilder.Entity<Community>()
        .HasIndex(c => new { c.Platform, c.ExternalCommunityId })
        .IsUnique();

    modelBuilder.Entity<CommunityMember>()
        .HasIndex(m => new { m.CommunityId, m.Platform, m.ExternalUserId })
        .IsUnique();

    modelBuilder.Entity<Poll>()
        .HasIndex(e => new { e.CommunityId, e.Status });

    modelBuilder.Entity<Vote>()
        .HasIndex(b => new { b.PollId, b.MemberId })
        .IsUnique();

    modelBuilder.Entity<VoteChoice>()
        .HasIndex(c => new { c.VoteId, c.EntryId })
        .IsUnique();

    modelBuilder.Entity<VoteChoice>()
        .HasIndex(c => new { c.VoteId, c.Rank });

    modelBuilder.Entity<OneTimeLoginToken>()
        .HasIndex(t => t.TokenHash)
        .IsUnique();

    modelBuilder.Entity<OneTimeLoginToken>()
        .HasIndex(t => t.ExpiresAt);

    modelBuilder.Entity<OneTimeLoginToken>()
        .HasIndex(t => new { t.CommunityMemberId, t.UsedAt, t.RevokedAt, t.ExpiresAt });

    modelBuilder.Entity<OneTimeLoginToken>()
        .HasOne(t => t.CommunityMember)
        .WithMany()
        .HasForeignKey(t => t.CommunityMemberId)
        .OnDelete(DeleteBehavior.Cascade);

    modelBuilder.Entity<PollEntry>()
        .HasOne(e => e.DisqualifiedByMember)
        .WithMany()
        .HasForeignKey(e => e.DisqualifiedByMemberId)
        .OnDelete(DeleteBehavior.SetNull);

    base.OnModelCreating(modelBuilder);
  }
}
