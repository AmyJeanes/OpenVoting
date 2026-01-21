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

    base.OnModelCreating(modelBuilder);
  }
}
